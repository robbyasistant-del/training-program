import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getAthleteProfile } from '@/lib/strava/api-service';
import { mapStravaAthlete } from '@/lib/strava/mappers';

/**
 * POST /api/strava/sync/profile
 * Sincroniza el perfil del atleta desde Strava API
 * Obtiene y almacena: nombre, foto, ubicación, peso, etc.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create sync log entry
    const syncLog = await prisma.syncLog.create({
      data: {
        athleteId,
        type: 'profile',
        status: 'running',
        totalRecords: 1,
      },
    });

    try {
      // Fetch profile from Strava API
      const stravaProfile = await getAthleteProfile(athleteId);

      // Update athlete in database
      const updatedAthlete = await prisma.athlete.update({
        where: { id: athleteId },
        data: {
          ...mapStravaAthlete(stravaProfile),
          lastSyncAt: new Date(),
          syncStatus: 'completed',
        },
      });

      // Mark sync log as completed
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          recordsProcessed: 1,
        },
      });

      return NextResponse.json({
        success: true,
        athlete: updatedAthlete,
        syncId: syncLog.id,
      });
    } catch (error) {
      // Mark sync log as failed
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
  } catch (error) {
    console.error('Sync profile error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
