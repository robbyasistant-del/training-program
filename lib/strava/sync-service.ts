/**
 * Strava Sync Service
 * Servicio para sincronizar actividades y perfil desde Strava
 * Incluye rate limiting, progreso, y manejo de errores
 */

import { prisma } from '@/lib/db';
import { processBatchForPRs, processBatchForMetricPRs } from '@/lib/personalRecords';

import { fetchActivitiesPage, getAthleteProfile } from './api-service';
import { mapStravaActivity, mapStravaAthlete } from './mappers';

export interface SyncResult {
  imported: number;
  total: number;
  errors: string[];
  syncLogId?: string;
  prsDetected?: number;
  metricPRsDetected?: number;
}

export interface SyncProgress {
  percentage: number;
  processed: number;
  total: number;
  status: string;
  estimatedSecondsRemaining: number | undefined;
}

/**
 * Sincroniza actividades con seguimiento de progreso
 * Respeta rate limiting de Strava (100 req/15min)
 */
export async function syncActivitiesWithProgress(
  athleteId: string,
  limit: number = 200
): Promise<SyncResult> {
  const errors: string[] = [];
  let totalProcessed = 0;
  let prsDetected = 0;
  let metricPRsDetected = 0;
  const syncedActivities: Array<{
    id: string;
    distance: number;
    movingTime: number;
    startDate: Date;
  }> = [];
  const syncedActivitiesForMetrics: Array<{
    id: string;
    type: import('@prisma/client').ActivityType;
    distance: number;
    movingTime: number;
    elapsedTime: number;
    totalElevationGain: number;
    averageSpeed: number;
    startDate: Date;
  }> = [];

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: {
      athleteId,
      type: 'activities',
      status: 'running',
      totalRecords: limit,
      recordsProcessed: 0,
    },
  });

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore && totalProcessed < limit) {
      try {
        const { activities, hasMore: morePages } = await fetchActivitiesPage(athleteId, page, 100);

        for (const activity of activities) {
          if (totalProcessed >= limit) break;

          try {
            const mappedActivity = mapStravaActivity(activity);

            // Upsert to prevent duplicates
            await prisma.activity.upsert({
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

            totalProcessed++;

            // Store activity for PR detection
            const upsertedActivity = await prisma.activity.findUnique({
              where: { stravaActivityId: BigInt(activity.id) },
              select: { id: true, distance: true, movingTime: true, startDate: true },
            });

            if (upsertedActivity?.movingTime && upsertedActivity.movingTime > 0) {
              syncedActivities.push({
                id: upsertedActivity.id,
                distance: upsertedActivity.distance ?? 0,
                movingTime: upsertedActivity.movingTime,
                startDate: upsertedActivity.startDate,
              });

              // Store for metric PR detection
              syncedActivitiesForMetrics.push({
                id: upsertedActivity.id,
                type: mappedActivity.type,
                distance: upsertedActivity.distance ?? 0,
                movingTime: upsertedActivity.movingTime,
                elapsedTime: mappedActivity.elapsedTime ?? upsertedActivity.movingTime,
                totalElevationGain: mappedActivity.totalElevationGain ?? 0,
                averageSpeed: mappedActivity.averageSpeed ?? 0,
                startDate: upsertedActivity.startDate,
              });
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Activity ${activity.id}: ${errorMsg}`);
            // Continue with next activity
          }
        }

        // Update progress
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            recordsProcessed: totalProcessed,
            currentPage: page,
          },
        });

        hasMore = morePages && activities.length > 0;
        page++;

        // Rate limiting: 9 seconds between requests
        if (hasMore && totalProcessed < limit) {
          await sleep(9000);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'API error';
        errors.push(`Page ${page}: ${errorMsg}`);

        // If rate limited, wait and retry
        if (errorMsg.includes('Rate limit') || errorMsg.includes('429')) {
          await sleep(60000); // Wait 1 minute before retry
          continue; // Retry same page
        }

        throw error; // Other errors stop the sync
      }
    }

    // Process all synced activities for standard distance PR detection
    if (syncedActivities.length > 0) {
      const prResult = await processBatchForPRs(syncedActivities, athleteId);
      prsDetected = prResult.prsFound;
    }

    // Process all synced activities for metric PR detection
    if (syncedActivitiesForMetrics.length > 0) {
      const metricPRResult = await processBatchForMetricPRs(syncedActivitiesForMetrics, athleteId);
      metricPRsDetected = metricPRResult.prsFound;
    }

    // Mark as completed
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed: totalProcessed,
      },
    });

    return {
      imported: totalProcessed,
      total: totalProcessed,
      errors,
      syncLogId: syncLog.id,
      prsDetected,
      metricPRsDetected,
    };
  } catch (error) {
    // Mark as failed
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errors: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

/**
 * Obtiene el progreso actual de una sincronización
 */
export async function getSyncProgress(syncLogId: string): Promise<SyncProgress> {
  const syncLog = await prisma.syncLog.findUnique({
    where: { id: syncLogId },
  });

  if (!syncLog) {
    throw new Error('Sync log not found');
  }

  const percentage =
    syncLog.totalRecords > 0
      ? Math.round((syncLog.recordsProcessed / syncLog.totalRecords) * 100)
      : 0;

  // Calculate estimated time remaining
  let estimatedSecondsRemaining: number | undefined;
  if (syncLog.status === 'running' && syncLog.startedAt) {
    const elapsed = Date.now() - syncLog.startedAt.getTime();
    const itemsRemaining = syncLog.totalRecords - syncLog.recordsProcessed;
    const rate = syncLog.recordsProcessed / (elapsed / 1000);

    if (rate > 0) {
      estimatedSecondsRemaining = Math.round(itemsRemaining / rate);
    }
  }

  return {
    percentage,
    processed: syncLog.recordsProcessed,
    total: syncLog.totalRecords,
    status: syncLog.status,
    estimatedSecondsRemaining,
  };
}

/**
 * Sincroniza el perfil del atleta
 */
export async function syncProfile(athleteId: string): Promise<void> {
  const stravaProfile = await getAthleteProfile(athleteId);

  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      ...mapStravaAthlete(stravaProfile),
      updatedAt: new Date(),
    },
  });
}

/**
 * Verifica si hay duplicados en la base de datos
 */
export async function checkForDuplicates(athleteId: string): Promise<number> {
  const duplicates = await prisma.$queryRaw<Array<{ stravaActivityId: bigint; count: number }>>`
    SELECT "stravaActivityId", COUNT(*) as count
    FROM "Activity"
    WHERE "athleteId" = ${athleteId}
    GROUP BY "stravaActivityId"
    HAVING COUNT(*) > 1
  `;

  return duplicates.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
