import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getRateLimitState, isNearRateLimit, getTimeUntilReset } from '@/lib/strava/rate-limiter';

/**
 * GET /api/activities/sync/:syncJobId/progress
 * Obtiene el progreso actual de una sincronización
 * Retorna: % completado, actividades procesadas/total, estado
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    const { id: syncJobId } = await params;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const syncLog = await prisma.syncLog.findFirst({
      where: {
        id: syncJobId,
        athleteId,
      },
    });

    if (!syncLog) {
      return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
    }

    // Calculate percentage
    const percentage =
      syncLog.totalRecords > 0
        ? Math.round((syncLog.recordsProcessed / syncLog.totalRecords) * 100)
        : 0;

    // Calculate estimated completion time
    let estimatedCompletion: string | null = null;
    let estimatedSecondsRemaining: number | null = null;

    if (syncLog.status === 'running' && syncLog.startedAt) {
      const elapsed = Date.now() - syncLog.startedAt.getTime();
      const itemsRemaining = syncLog.totalRecords - syncLog.recordsProcessed;
      const rate = syncLog.recordsProcessed / (elapsed / 1000); // items per second

      if (rate > 0) {
        estimatedSecondsRemaining = Math.round(itemsRemaining / rate);
        const estimatedDate = new Date(Date.now() + estimatedSecondsRemaining * 1000);
        estimatedCompletion = estimatedDate.toISOString();
      }
    }

    // Get rate limit info
    const rateLimitState = getRateLimitState();
    const rateLimitInfo = {
      isThrottled: isNearRateLimit(),
      waitTimeRemaining: Math.ceil(getTimeUntilReset() / 1000), // Convert to seconds
      usage: rateLimitState.usage,
      limit: rateLimitState.limit,
    };

    return NextResponse.json({
      syncJobId: syncLog.id,
      status: syncLog.status,
      type: syncLog.type,
      progress: {
        percentage,
        processed: syncLog.recordsProcessed,
        total: syncLog.totalRecords,
        currentPage: syncLog.currentPage,
      },
      timestamps: {
        startedAt: syncLog.startedAt?.toISOString() || null,
        completedAt: syncLog.completedAt?.toISOString() || null,
      },
      estimatedCompletion,
      estimatedSecondsRemaining,
      error: syncLog.errors,
      rateLimitInfo,
    });
  } catch (error) {
    console.error('Get sync progress error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get progress';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
