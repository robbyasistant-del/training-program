/**
 * GET /api/athletes/[id]/metric-prs
 * Returns current metric PRs for an athlete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentMetricPRs, formatMetricPR } from '@/lib/personalRecords';
import { MetricType, ActivityType } from '@/types/metricPR';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const activityType = searchParams.get('activityType') as ActivityType | null;
    const metricType = searchParams.get('metricType') as MetricType | null;

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

    // Get current metric PRs
    const records = await getCurrentMetricPRs(
      athleteId,
      activityType ?? undefined,
      metricType ?? undefined
    );

    // Format records for response
    const formattedRecords = records.map(formatMetricPR);

    // Group by activity type and metric type for easier consumption
    const grouped = formattedRecords.reduce(
      (acc, record) => {
        if (!acc[record.activityType]) {
          acc[record.activityType] = {};
        }
        if (!acc[record.activityType]![record.metricType]) {
          acc[record.activityType]![record.metricType] = [];
        }
        acc[record.activityType]![record.metricType]!.push(record);
        return acc;
      },
      {} as Record<string, Record<string, typeof formattedRecords>>
    );

    return NextResponse.json({
      records: formattedRecords,
      grouped,
      count: formattedRecords.length,
    });
  } catch (error) {
    console.error('[GET /api/athletes/[id]/metric-prs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
