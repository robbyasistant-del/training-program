/**
 * GET /api/athletes/[id]/personal-records/history
 * Returns complete PR history for a specific distance
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatPersonalRecord } from '@/lib/personalRecords';
import { PersonalRecord } from '@/types/personalRecord';
import { StandardDistanceLabel } from '@prisma/client';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const distanceLabel = searchParams.get('distanceLabel') as StandardDistanceLabel | null;

    if (!athleteId) {
      return NextResponse.json({ error: 'Athlete ID is required' }, { status: 400 });
    }

    // Validate distance label if provided
    // Prisma enum values: FIVE_K, TEN_K, FIFTEEN_K, HALF_MARATHON, MARATHON
    const validPrismaLabels: StandardDistanceLabel[] = [
      'FIVE_K',
      'TEN_K',
      'FIFTEEN_K',
      'HALF_MARATHON',
      'MARATHON',
    ];
    if (distanceLabel && !validPrismaLabels.includes(distanceLabel)) {
      return NextResponse.json(
        {
          error: 'Invalid distance label',
          validLabels: validPrismaLabels,
        },
        { status: 400 }
      );
    }

    // Verify athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Build query
    const whereClause: {
      athleteId: string;
      distanceLabel?: StandardDistanceLabel;
    } = { athleteId };

    if (distanceLabel) {
      whereClause.distanceLabel = distanceLabel;
    }

    // Get PR history
    const records = await prisma.personalRecord.findMany({
      where: whereClause,
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
      orderBy: [{ distanceMeters: 'asc' }, { achievedAt: 'asc' }],
    });

    // Group by distance if no specific distance requested
    // Map Prisma enum values to frontend labels
    const prismaToFrontendMap: Record<StandardDistanceLabel, { label: string; meters: number }> = {
      FIVE_K: { label: '5K', meters: 5000 },
      TEN_K: { label: '10K', meters: 10000 },
      FIFTEEN_K: { label: '15K', meters: 15000 },
      HALF_MARATHON: { label: 'HALF_MARATHON', meters: 21097.5 },
      MARATHON: { label: 'MARATHON', meters: 42195 },
    };

    if (!distanceLabel) {
      const groupedByDistance = Object.entries(prismaToFrontendMap)
        .map(([prismaLabel, frontend]) => {
          const distanceRecords = records.filter((r) => r.distanceLabel === prismaLabel);

          return {
            distanceLabel: frontend.label,
            distanceMeters: frontend.meters,
            history: distanceRecords.map((record) =>
              formatPersonalRecord({
                ...(record as unknown as PersonalRecord),
                previousRecordId: record.previousRecordId,
                previousRecord: record.previousRecord
                  ? { timeSeconds: record.previousRecord.timeSeconds }
                  : null,
              } as PersonalRecord & { previousRecord?: { timeSeconds: number } | null })
            ),
            count: distanceRecords.length,
          };
        })
        .filter((group) => group.count > 0);

      return NextResponse.json({
        distances: groupedByDistance,
        totalCount: records.length,
      });
    }

    // Return single distance history
    const formattedHistory = records.map((record) =>
      formatPersonalRecord({
        ...(record as unknown as PersonalRecord),
        previousRecordId: record.previousRecordId,
        previousRecord: record.previousRecord
          ? { timeSeconds: record.previousRecord.timeSeconds }
          : null,
      } as PersonalRecord & { previousRecord?: { timeSeconds: number } | null })
    );

    return NextResponse.json({
      distanceLabel,
      distanceMeters: distanceLabel ? prismaToFrontendMap[distanceLabel]?.meters : undefined,
      history: formattedHistory,
      count: formattedHistory.length,
    });
  } catch (error) {
    console.error('[GET /api/athletes/[id]/personal-records/history] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
