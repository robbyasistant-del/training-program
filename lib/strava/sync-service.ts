/**
 * Strava Sync Service
 * Servicio para sincronizar actividades y perfil desde Strava
 * Incluye rate limiting, progreso, y manejo de errores
 */

import { prisma } from '@/lib/db';
import { processBatchForPRs, processBatchForMetricPRs } from '@/lib/personalRecords';

import { fetchActivitiesPage, getAthleteProfile, getAthleteStats } from './api-service';
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

            // Upsert to prevent duplicates - ONLY for Strava activities (positive IDs)
            // Skip manual activities (negative IDs) to preserve user-created data
            const stravaId = BigInt(activity.id);
            if (stravaId < 0) {
              console.log(`[Sync] Skipping manual activity with negative ID: ${activity.id}`);
              continue;
            }

            await prisma.activity.upsert({
              where: { stravaActivityId: stravaId },
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
                ...((mappedActivity as any).averagePower !== undefined && {
                  averagePower: (mappedActivity as any).averagePower,
                }),
                ...((mappedActivity as any).maxPower !== undefined && {
                  maxPower: (mappedActivity as any).maxPower,
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

    // Sync athlete records (PRs from Strava stats)
    await syncAthleteRecords(athleteId);

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

/**
 * Sincroniza los récords personales (PRs) del atleta desde Strava
 * Obtiene los mejores tiempos por distancia y los guarda en la BD
 */
export async function syncAthleteRecords(athleteId: string): Promise<void> {
  try {
    // Obtener el atleta para tener el stravaId
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { stravaId: true, weight: true },
    });

    if (!athlete || !athlete.stravaId) {
      throw new Error('Athlete not found or missing Strava ID');
    }

    // Obtener estadísticas del atleta desde Strava
    const stats = await getAthleteStats(athleteId, Number(athlete.stravaId));
    
    if (!stats) {
      console.log('[Sync] No stats available from Strava');
      return;
    }

    // Extraer PRs de distancia de las estadísticas
    // Nota: La API de Strava /athletes/{id}/stats no devuelve PRs directamente,
    // pero podemos inferirlos de las mejores actividades
    
    // Calcular totales
    const totalDistance = (stats.all_ride_totals?.distance || 0) + 
                         (stats.all_run_totals?.distance || 0) +
                         (stats.all_swim_totals?.distance || 0);
    const totalTime = (stats.all_ride_totals?.moving_time || 0) + 
                     (stats.all_run_totals?.moving_time || 0) +
                     (stats.all_swim_totals?.moving_time || 0);
    const totalElevation = (stats.all_ride_totals?.elevation_gain || 0) + 
                          (stats.all_run_totals?.elevation_gain || 0);
    const totalActivities = (stats.all_ride_totals?.count || 0) + 
                           (stats.all_run_totals?.count || 0) +
                           (stats.all_swim_totals?.count || 0);

    // Buscar PRs de distancia desde las actividades recientes
    const activities = await prisma.activity.findMany({
      where: { athleteId },
      orderBy: { startDate: 'desc' },
      take: 200,
    });

    // Calcular PRs de distancia
    const distances = [
      { dist: 5000, field: 'pr5k' },
      { dist: 10000, field: 'pr10k' },
      { dist: 21097.5, field: 'prHalfMarathon' },
      { dist: 42195, field: 'prMarathon' },
    ] as const;

    const prData: Record<string, number | null> = {};

    for (const { dist, field } of distances) {
      const matching = activities.filter(a => {
        if (!a.distance) return false;
        const tolerance = dist * 0.02;
        return a.distance >= dist - tolerance && a.distance <= dist + tolerance;
      });

      if (matching.length > 0) {
        const best = matching.reduce((min, a) => 
          a.movingTime && a.movingTime < (min.movingTime || Infinity) ? a : min
        );
        prData[field] = best.movingTime;
      } else {
        prData[field] = null;
      }
    }

    // Calcular PRs de potencia si hay datos
    const activitiesWithPower = activities.filter(a => a.averagePower && a.averagePower > 0);
    const powerDurations = [
      { dur: 5, field: 'power5s' },
      { dur: 15, field: 'power15s' },
      { dur: 30, field: 'power30s' },
      { dur: 60, field: 'power1m' },
      { dur: 120, field: 'power2m' },
      { dur: 180, field: 'power3m' },
      { dur: 300, field: 'power5m' },
      { dur: 480, field: 'power8m' },
      { dur: 600, field: 'power10m' },
      { dur: 900, field: 'power15m' },
      { dur: 1200, field: 'power20m' },
      { dur: 1800, field: 'power30m' },
      { dur: 2700, field: 'power45m' },
      { dur: 3600, field: 'power1h' },
      { dur: 7200, field: 'power2h' },
    ] as const;

    for (const { dur, field } of powerDurations) {
      const matching = activitiesWithPower.filter(a => {
        if (!a.movingTime) return false;
        const tolerance = dur * 0.15;
        return a.movingTime >= dur - tolerance && a.movingTime <= dur + tolerance;
      });

      if (matching.length > 0) {
        const best = matching.reduce((max, a) => 
          (a.averagePower || 0) > (max.averagePower || 0) ? a : max
        );
        prData[field] = Math.round(best.averagePower || 0);
      } else {
        prData[field] = null;
      }
    }

    // Calcular FTP
    let ftp = null;
    let ftpMethod = null;
    
    const power20m = prData['power20m'];
    if (power20m) {
      ftp = Math.round(power20m * 0.95);
      ftpMethod = '95% de 20 min';
    } else if (prData['power1h']) {
      ftp = prData['power1h'];
      ftpMethod = '1 hora';
    } else if (prData['power5m']) {
      ftp = Math.round(prData['power5m'] * 0.85);
      ftpMethod = 'Est. desde 5 min';
    }

    // Guardar o actualizar en la BD
    await prisma.athleteRecord.upsert({
      where: { athleteId },
      create: {
        athleteId,
        pr5k: prData['pr5k'],
        pr10k: prData['pr10k'],
        prHalfMarathon: prData['prHalfMarathon'],
        prMarathon: prData['prMarathon'],
        power5s: prData['power5s'],
        power15s: prData['power15s'],
        power30s: prData['power30s'],
        power1m: prData['power1m'],
        power2m: prData['power2m'],
        power3m: prData['power3m'],
        power5m: prData['power5m'],
        power8m: prData['power8m'],
        power10m: prData['power10m'],
        power15m: prData['power15m'],
        power20m: prData['power20m'],
        power30m: prData['power30m'],
        power45m: prData['power45m'],
        power1h: prData['power1h'],
        power2h: prData['power2h'],
        estimatedFTP: ftp,
        ftpMethod,
        totalDistance,
        totalTime,
        totalElevation,
        totalActivities,
      },
      update: {
        pr5k: prData['pr5k'],
        pr10k: prData['pr10k'],
        prHalfMarathon: prData['prHalfMarathon'],
        prMarathon: prData['prMarathon'],
        power5s: prData['power5s'],
        power15s: prData['power15s'],
        power30s: prData['power30s'],
        power1m: prData['power1m'],
        power2m: prData['power2m'],
        power3m: prData['power3m'],
        power5m: prData['power5m'],
        power8m: prData['power8m'],
        power10m: prData['power10m'],
        power15m: prData['power15m'],
        power20m: prData['power20m'],
        power30m: prData['power30m'],
        power45m: prData['power45m'],
        power1h: prData['power1h'],
        power2h: prData['power2h'],
        estimatedFTP: ftp,
        ftpMethod,
        totalDistance,
        totalTime,
        totalElevation,
        totalActivities,
      },
    });

    console.log('[Sync] Athlete records synced successfully');
  } catch (error) {
    console.error('[Sync] Error syncing athlete records:', error);
    // No lanzamos el error para no interrumpir la sincronización principal
  }
}
