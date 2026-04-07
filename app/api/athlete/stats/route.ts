import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * GET /api/athlete/stats
 * Obtiene estadísticas del atleta (total actividades, distancia, tiempo)
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Aggregate stats from activities
    const stats = await prisma.activity.aggregate({
      where: { athleteId },
      _sum: {
        distance: true,
        movingTime: true,
      },
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      totalDistance: stats._sum.distance || 0,
      totalMovingTime: stats._sum.movingTime || 0,
      totalActivities: stats._count.id,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
