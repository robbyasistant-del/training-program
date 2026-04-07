/**
 * GET /api/athletes/[id]/metric-prs/history
 * Returns PR history for a specific metric and activity type
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMetricPRHistory, formatMetricPR } from '@/lib/personalRecords';
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

    if (!activityType || !metricType) {
      return NextResponse.json(
        { error: 'activityType and metricType are required' },
        { status: 400 }
      );
    }

    // Validate enum values
    const validActivityTypes = Object.values(ActivityType);
    const validMetricTypes = Object.values(MetricType);

    if (!validActivityTypes.includes(activityType)) {
      return NextResponse.json(
        { error: 'Invalid activityType', validTypes: validActivityTypes },
        { status: 400 }
      );
    }

    if (!validMetricTypes.includes(metricType)) {
      return NextResponse.json(
        { error: 'Invalid metricType', validTypes: validMetricTypes },
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

    // Get PR history
    const records = await getMetricPRHistory(athleteId, activityType, metricType);

    // Format records for response
    const formattedRecords = records.map(formatMetricPR);

    return NextResponse.json({
      activityType,
      metricType,
      history: formattedRecords,
      count: formattedRecords.length,
    });
  } catch (error) {
    console.error('[GET /api/athletes/[id]/metric-prs/history] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
