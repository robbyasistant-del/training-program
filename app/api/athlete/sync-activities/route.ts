import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { fetchActivitiesPage } from '@/lib/strava/api-service';
import { mapStravaActivity } from '@/lib/strava/mappers';

/**
 * POST /api/athlete/sync-activities
 * Inicia sincronización masiva de actividades desde Strava
 * Query params: ?limit=N (default: 200)
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get limit from query params (default: 200)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    // Create sync log entry
    const syncLog = await prisma.syncLog.create({
      data: {
        athleteId,
        type: 'activities',
        status: 'pending',
        totalRecords: limit,
      },
    });

    // Update athlete sync status
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { syncStatus: 'pending' },
    });

    // Start sync in background (non-blocking)
    syncActivitiesInBackground(athleteId, syncLog.id, limit);

    return NextResponse.json({
      success: true,
      syncId: syncLog.id,
      message: 'Sync started',
    });
  } catch (error) {
    console.error('Sync activities error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Sincroniza actividades en segundo plano
 */
async function syncActivitiesInBackground(
  athleteId: string,
  syncLogId: string,
  limit: number
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

    let page = 1;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore && totalProcessed < limit) {
      const { activities, hasMore: morePages } = await fetchActivitiesPage(athleteId, page, 200);

      for (const activity of activities) {
        if (totalProcessed >= limit) break;

        // Upsert activity (avoid duplicates)
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
