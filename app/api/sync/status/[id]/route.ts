import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * GET /api/sync/status/:syncId
 * Obtiene el estado actual de una sincronización con progreso detallado
 * Incluye: status, progress (current, total, percentage), timestamps, estimated completion
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    const { id: syncId } = await params;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Calculate percentage
    const percentage =
      syncLog.totalRecords > 0
        ? Math.round((syncLog.recordsProcessed / syncLog.totalRecords) * 100)
        : 0;

    // Calculate estimated completion time
    let estimatedCompletion: string | null = null;
    if (syncLog.status === 'running' && syncLog.startedAt) {
      const elapsed = Date.now() - syncLog.startedAt.getTime();
      const itemsRemaining = syncLog.totalRecords - syncLog.recordsProcessed;
      const rate = syncLog.recordsProcessed / (elapsed / 1000); // items per second

      if (rate > 0) {
        const remainingSeconds = itemsRemaining / rate;
        const estimatedDate = new Date(Date.now() + remainingSeconds * 1000);
        estimatedCompletion = estimatedDate.toISOString();
      }
    }

    return NextResponse.json({
      status: syncLog.status,
      progress: {
        current: syncLog.recordsProcessed,
        total: syncLog.totalRecords,
        percentage,
      },
      startedAt: syncLog.startedAt?.toISOString() || null,
      completedAt: syncLog.completedAt?.toISOString() || null,
      estimatedCompletion,
      errors: syncLog.errors,
      type: syncLog.type,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
