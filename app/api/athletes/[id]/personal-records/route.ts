/**
 * GET /api/athletes/[id]/personal-records
 * Returns all current personal records for an athlete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatPersonalRecord } from '@/lib/personalRecords';
import { PersonalRecord, StandardDistanceLabel } from '@/types/personalRecord';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: athleteId } = await params;

    if (!athleteId) {
      return NextResponse.json({ error: 'Athlete ID is required' }, { status: 400 });
    }

    // Verify athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Get all current PRs for the athlete
    const records = await prisma.personalRecord.findMany({
      where: {
        athleteId,
        isCurrentRecord: true,
      },
      include: {
        previousRecord: {
          select: { timeSeconds: true },
        },
        activity: {
          select: {
            stravaActivityId: true,
          },
        },
      },
      orderBy: { distanceMeters: 'asc' },
    });

    // Format records for response
    const formattedRecords = records.map((record) => {
      const formatted = formatPersonalRecord({
        ...(record as unknown as PersonalRecord),
        previousRecord: record.previousRecord
          ? { timeSeconds: record.previousRecord.timeSeconds }
          : null,
      });

      return {
        ...formatted,
        stravaActivityId: record.activity.stravaActivityId?.toString(),
      };
    });

    return NextResponse.json({
      records: formattedRecords,
      count: formattedRecords.length,
    });
  } catch (error) {
    console.error('[GET /api/athletes/[id]/personal-records] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
