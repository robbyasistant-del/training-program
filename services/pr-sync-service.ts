/**
 * Updated Strava Sync Service with PR Detection
 *
 * This service extends the existing sync functionality to automatically
 * detect personal records after activities are imported from Strava.
 */

import { prisma } from '@/lib/db';
import { fetchActivitiesPage } from '@/lib/strava/api-service';
import { mapStravaActivity } from '@/lib/strava/mappers';
import { detectPersonalRecord, processBatchForPRs } from '@/lib/personalRecords/prService';
import { detectMetricPRs, processBatchForMetricPRs } from '@/lib/personalRecords/metricPRService';
import { ActivityType, MetricType } from '@/types/metricPR';

export interface SyncProgress {
  totalProcessed: number;
  totalRecords: number;
  currentPage: number;
  prsFound: number;
  metricPRsFound: number;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  prsFound: number;
  metricPRsFound: number;
  message: string;
}

/**
 * Sincroniza actividades de Strava con detección de PRs
 * @param athleteId - ID del atleta
 * @param syncLogId - ID del log de sincronización
 * @param limit - Límite de actividades a sincronizar
 * @returns Resultado de la sincronización
 */
export async function syncActivitiesWithPRDetection(
  athleteId: string,
  syncLogId: string,
  limit: number = 200
): Promise<SyncResult> {
  const errors: string[] = [];
  let totalProcessed = 0;
  let prsFound = 0;
  let metricPRsFound = 0;

  try {
    // Update status to running
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: { status: 'running' },
    });

    await prisma.athlete.update({
      where: { id: athleteId },
      data: { syncStatus: 'running' },
    });

    let page = 1;
    let hasMore = true;
    const allActivities: Array<{
      id: string;
      type: ActivityType;
      distance: number;
      movingTime: number;
      elapsedTime: number;
      totalElevationGain: number;
      averageSpeed: number;
      startDate: Date;
    }> = [];

    // Fetch all activities first
    while (hasMore && totalProcessed < limit) {
      try {
        const { activities, hasMore: morePages } = await fetchActivitiesPage(athleteId, page, 100);

        for (const activity of activities) {
          if (totalProcessed >= limit) break;

          // Upsert activity (avoid duplicates by stravaActivityId)
          const mappedActivity = mapStravaActivity(activity);
          const savedActivity = await prisma.activity.upsert({
            where: { stravaActivityId: BigInt(activity.id) },
            create: {
              ...mappedActivity,
              athleteId,
            },
            update: {
              name: mappedActivity.name,
              type: mappedActivity.type,
              distance: mappedActivity.distance,
              movingTime: mappedActivity.movingTime,
              elapsedTime: mappedActivity.elapsedTime,
              totalElevationGain: mappedActivity.totalElevationGain,
              startDate: mappedActivity.startDate,
              averageSpeed: mappedActivity.averageSpeed,
              maxSpeed: mappedActivity.maxSpeed,
              ...(mappedActivity.averageHeartrate !== undefined && {
                averageHeartrate: mappedActivity.averageHeartrate,
              }),
              ...(mappedActivity.maxHeartrate !== undefined && {
                maxHeartrate: mappedActivity.maxHeartrate,
              }),
            },
          });

          // Collect activity for batch PR detection
          allActivities.push({
            id: savedActivity.id,
            type: savedActivity.type as ActivityType,
            distance: savedActivity.distance ?? 0,
            movingTime: savedActivity.movingTime ?? 0,
            elapsedTime: savedActivity.elapsedTime ?? 0,
            totalElevationGain: savedActivity.totalElevationGain ?? 0,
            averageSpeed: savedActivity.averageSpeed ?? 0,
            startDate: savedActivity.startDate,
          });

          totalProcessed++;
        }

        // Update progress
        await prisma.syncLog.update({
          where: { id: syncLogId },
          data: {
            recordsProcessed: totalProcessed,
            currentPage: page,
          },
        });

        hasMore = morePages && activities.length > 0;
        page++;

        // Rate limiting: wait 9 seconds between requests (100 req / 15 min)
        if (hasMore && totalProcessed < limit) {
          await sleep(9000);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error fetching page';
        errors.push(`Page ${page}: ${errorMsg}`);
        console.error(`[Sync] Error fetching page ${page}:`, error);
        // Continue with next page instead of failing completely
        page++;
        if (page > 10) break; // Prevent infinite loops on persistent errors
      }
    }

    // Process batch for standard distance PRs (only for RUN activities)
    const runActivities = allActivities.filter(
      (a) => a.type === ActivityType.RUN && a.distance > 0 && a.movingTime > 0
    );

    if (runActivities.length > 0) {
      const standardPRResult = await processBatchForPRs(
        runActivities.map((a) => ({
          id: a.id,
          distance: a.distance,
          movingTime: a.movingTime,
          startDate: a.startDate,
        })),
        athleteId
      );
      prsFound = standardPRResult.prsFound;
    }

    // Process batch for metric-based PRs (all activity types)
    const validActivities = allActivities.filter(
      (a) => a.distance > 0 || a.movingTime > 0 || a.totalElevationGain > 0
    );

    if (validActivities.length > 0) {
      const metricPRResult = await processBatchForMetricPRs(validActivities, athleteId);
      metricPRsFound = metricPRResult.prsFound;
    }

    // Mark as completed
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed: totalProcessed,
        errors: errors.length > 0 ? errors.join('\n') : null,
      },
    });

    await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        syncStatus: 'completed',
        lastSyncAt: new Date(),
      },
    });

    return {
      success: true,
      syncedCount: totalProcessed,
      prsFound,
      metricPRsFound,
      message: `Sincronización completada: ${totalProcessed} actividades, ${prsFound} récords de distancia, ${metricPRsFound} récords de métricas`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync] Background sync error:', error);

    // Mark as failed
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errors: `${errorMessage}\n${errors.join('\n')}`,
      },
    });

    await prisma.athlete.update({
      where: { id: athleteId },
      data: { syncStatus: 'failed' },
    });

    return {
      success: false,
      syncedCount: totalProcessed,
      prsFound,
      metricPRsFound,
      message: `Error en sincronización: ${errorMessage}`,
    };
  }
}

/**
 * Detecta PRs para una única actividad recién sincronizada
 * @param activityId - ID de la actividad
 * @param athleteId - ID del atleta
 */
export async function detectPRsForActivity(
  activityId: string,
  athleteId: string
): Promise<{
  standardPRs: number;
  metricPRs: number;
}> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });

  if (!activity) {
    throw new Error('Activity not found');
  }

  let standardPRs = 0;
  let metricPRs = 0;

  // Check for standard distance PR (RUN only)
  if (activity.type === 'RUN' && activity.distance && activity.movingTime) {
    const result = await detectPersonalRecord(
      {
        id: activity.id,
        distance: activity.distance,
        movingTime: activity.movingTime,
        startDate: activity.startDate,
      },
      athleteId
    );
    if (result.isPR) standardPRs++;
  }

  // Check for metric-based PRs
  const metricResults = await detectMetricPRs(
    {
      id: activity.id,
      type: activity.type as ActivityType,
      distance: activity.distance ?? 0,
      movingTime: activity.movingTime ?? 0,
      elapsedTime: activity.elapsedTime ?? 0,
      totalElevationGain: activity.totalElevationGain ?? 0,
      averageSpeed: activity.averageSpeed ?? 0,
      startDate: activity.startDate,
    },
    athleteId
  );

  metricPRs = metricResults.filter((r) => r.isPR).length;

  return { standardPRs, metricPRs };
}

/**
 * Sincroniza una única actividad desde Strava (para webhooks)
 * @param stravaActivityId - ID de la actividad en Strava
 * @param athleteId - ID del atleta
 */
export async function syncSingleActivity(
  stravaActivityId: bigint,
  athleteId: string
): Promise<{
  success: boolean;
  isNew: boolean;
  prsDetected: number;
}> {
  try {
    // Check if activity already exists
    const existingActivity = await prisma.activity.findUnique({
      where: { stravaActivityId },
    });

    // Import activity from Strava
    const { fetchActivityById } = await import('@/lib/strava/api-service');
    const stravaActivity = await fetchActivityById(athleteId, stravaActivityId);

    if (!stravaActivity) {
      return { success: false, isNew: false, prsDetected: 0 };
    }

    const mappedActivity = mapStravaActivity(stravaActivity);

    // Save activity
    const savedActivity = await prisma.activity.upsert({
      where: { stravaActivityId },
      create: {
        ...mappedActivity,
        athleteId,
      },
      update: {
        name: mappedActivity.name,
        distance: mappedActivity.distance,
        movingTime: mappedActivity.movingTime,
        elapsedTime: mappedActivity.elapsedTime,
        totalElevationGain: mappedActivity.totalElevationGain,
        averageSpeed: mappedActivity.averageSpeed,
        maxSpeed: mappedActivity.maxSpeed,
      },
    });

    // Detect PRs for the new/updated activity
    const { standardPRs, metricPRs } = await detectPRsForActivity(savedActivity.id, athleteId);

    return {
      success: true,
      isNew: !existingActivity,
      prsDetected: standardPRs + metricPRs,
    };
  } catch (error) {
    console.error('[Sync] Error syncing single activity:', error);
    return { success: false, isNew: false, prsDetected: 0 };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
