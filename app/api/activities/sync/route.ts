import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { fetchActivitiesPage, getAthleteProfile } from '@/lib/strava/api-service';
import { mapStravaActivity, mapStravaAthlete } from '@/lib/strava/mappers';

/**
 * POST /api/activities/sync
 * Inicia sincronización manual de actividades y perfil del atleta
 * Retorna inmediatamente el syncJobId para trackear progreso
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get options from body
    let options = { syncProfile: true, syncActivities: true, limit: 200 };
    try {
      const body = await request.json();
      options = { ...options, ...body };
    } catch {
      // Use defaults if no body
    }

    // Create sync log entry
    const syncLog = await prisma.syncLog.create({
      data: {
        athleteId,
        type:
          options.syncProfile && options.syncActivities
            ? 'full'
            : options.syncProfile
              ? 'profile'
              : 'activities',
        status: 'pending',
        totalRecords: options.syncActivities ? options.limit : 1,
      },
    });

    // Update athlete sync status
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { syncStatus: 'pending' },
    });

    // Start sync in background (non-blocking)
    syncInBackground(athleteId, syncLog.id, options);

    return NextResponse.json({
      success: true,
      syncJobId: syncLog.id,
      message: 'Sync started successfully',
      status: 'pending',
      type:
        options.syncProfile && options.syncActivities
          ? 'full'
          : options.syncProfile
            ? 'profile'
            : 'activities',
    });
  } catch (error) {
    console.error('Sync activities error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface SyncOptions {
  syncProfile: boolean;
  syncActivities: boolean;
  limit: number;
}

/**
 * Sincroniza perfil y/o actividades en segundo plano
 */
async function syncInBackground(
  athleteId: string,
  syncLogId: string,
  options: SyncOptions
): Promise<void> {
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

    let totalProcessed = 0;

    // Sync profile if requested
    if (options.syncProfile) {
      await syncProfile(athleteId);
      totalProcessed += 1;

      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: { recordsProcessed: totalProcessed },
      });
    }

    // Sync activities if requested
    if (options.syncActivities) {
      const activitiesProcessed = await syncActivities(athleteId, syncLogId, options.limit);
      totalProcessed += activitiesProcessed;
    }

    // Mark as completed
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed: totalProcessed,
      },
    });

    await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        syncStatus: 'completed',
        lastSyncAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Background sync error:', error);

    // Mark as failed
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errors: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    await prisma.athlete.update({
      where: { id: athleteId },
      data: { syncStatus: 'failed' },
    });
  }
}

/**
 * Sincroniza el perfil del atleta desde Strava
 */
async function syncProfile(athleteId: string): Promise<void> {
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
 * Sincroniza actividades históricas con rate limiting
 */
async function syncActivities(
  athleteId: string,
  syncLogId: string,
  limit: number
): Promise<number> {
  let page = 1;
  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore && totalProcessed < limit) {
    const { activities, hasMore: morePages } = await fetchActivitiesPage(athleteId, page, 100);

    for (const activity of activities) {
      if (totalProcessed >= limit) break;

      // Upsert activity (avoid duplicates by stravaActivityId)
      const mappedActivity = mapStravaActivity(activity);
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
  }

  return totalProcessed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
