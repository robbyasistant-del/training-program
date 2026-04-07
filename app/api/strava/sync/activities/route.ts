/**
 * Updated Strava Sync Activities Route with PR Detection
 *
 * POST /api/strava/sync/activities
 * Inicia sincronización asíncrona de actividades históricas desde Strava
 * con detección automática de récords personales.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncActivitiesWithPRDetection } from '@/services/pr-sync-service';

/**
 * POST /api/strava/sync/activities
 * Inicia sincronización asíncrona de actividades históricas desde Strava
 * Retorna inmediatamente el syncId para polling
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

    // Start sync in background with PR detection (non-blocking)
    syncActivitiesWithPRDetection(athleteId, syncLog.id, limit)
      .then((result) => {
        console.log('[Sync] Completed:', result.message);
      })
      .catch((error) => {
        console.error('[Sync] Failed:', error);
      });

    return NextResponse.json({
      success: true,
      syncId: syncLog.id,
      message: 'Sync started with PR detection',
      status: 'pending',
    });
  } catch (error) {
    console.error('Sync activities error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/strava/sync/activities?syncId=xxx
 * Obtiene el estado de una sincronización en curso
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!syncId) {
      return NextResponse.json({ error: 'syncId is required' }, { status: 400 });
    }

    const syncLog = await prisma.syncLog.findFirst({
      where: {
        id: syncId,
        athleteId,
      },
    });

    if (!syncLog) {
      return NextResponse.json({ error: 'Sync not found' }, { status: 404 });
    }

    return NextResponse.json({
      syncId: syncLog.id,
      status: syncLog.status,
      progress: {
        processed: syncLog.recordsProcessed,
        total: syncLog.totalRecords,
        currentPage: syncLog.currentPage,
      },
      errors: syncLog.errors,
      completedAt: syncLog.completedAt,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
