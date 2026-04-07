import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * GET /api/athlete/sync-status/:syncId
 * Obtiene el estado de una sincronización
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

    return NextResponse.json({
      status: syncLog.status,
      processed: syncLog.recordsProcessed,
      total: syncLog.totalRecords,
      percentage,
      currentPage: syncLog.currentPage,
      completedAt: syncLog.completedAt,
      errors: syncLog.errors,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
