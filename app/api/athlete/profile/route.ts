import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * GET /api/athlete/profile
 * Obtiene el perfil del atleta autenticado desde la base de datos local
 * No llama a Strava directamente para no consumir rate limits
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch athlete profile from local database
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        _count: {
          select: {
            activities: true,
          },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Check if Strava connection exists
    const stravaConnection = await prisma.stravaConnection.findUnique({
      where: { athleteId },
      select: {
        expiresAt: true,
        updatedAt: true,
      },
    });

    const isStravaConnected = !!stravaConnection && stravaConnection.expiresAt > new Date();

    // Calculate activity stats
    const stats = await prisma.activity.aggregate({
      where: { athleteId },
      _sum: {
        distance: true,
        movingTime: true,
      },
    });

    // Return normalized profile data
    return NextResponse.json({
      id: athlete.id,
      stravaId: athlete.stravaId.toString(),
      email: athlete.email,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      profileImage: athlete.profileImage,
      city: athlete.city,
      country: athlete.country,
      sex: athlete.sex,
      weight: athlete.weight,
      lastSyncAt: athlete.lastSyncAt,
      syncStatus: athlete.syncStatus,
      createdAt: athlete.createdAt,
      updatedAt: athlete.updatedAt,
      stats: {
        totalActivities: athlete._count.activities,
        totalDistance: stats._sum.distance || 0,
        totalMovingTime: stats._sum.movingTime || 0,
      },
      connection: {
        isConnected: isStravaConnected,
        lastConnectionAt: stravaConnection?.updatedAt || null,
      },
    });
  } catch (error) {
    console.error('Get athlete profile error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get athlete profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
