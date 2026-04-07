import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * GET /api/athlete/activities
 * Obtiene las actividades del atleta autenticado
 * Query params: ?limit=N (default: 10)
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get limit from query params (default: 10)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Fetch activities from database
    const activities = await prisma.activity.findMany({
      where: { athleteId },
      orderBy: { startDate: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        startDate: true,
        distance: true,
        movingTime: true,
      },
    });

    return NextResponse.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Get activities error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get activities';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
