import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getAthleteProfile } from '@/lib/strava/api-service';
import { mapStravaAthlete } from '@/lib/strava/mappers';

/**
 * POST /api/athlete/sync-profile
 * Sincroniza el perfil del atleta desde Strava
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch profile from Strava
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

    return NextResponse.json({
      success: true,
      athlete: updatedAthlete,
    });
  } catch (error) {
    console.error('Sync profile error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
