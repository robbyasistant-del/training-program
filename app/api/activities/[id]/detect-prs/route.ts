/**
 * POST /api/activities/[id]/detect-prs
 * Manual trigger for PR detection on a specific activity
 * For admin/testing purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectPRsForActivity } from '@/services/pr-detection';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: activityId } = await params;

    // Get athlete ID from cookie or request body
    const athleteId = request.cookies.get('athlete_id')?.value;
    const body = await request.json().catch(() => ({}));
    const requestedAthleteId = body.athleteId || athleteId;

    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 });
    }

    if (!requestedAthleteId) {
      return NextResponse.json({ error: 'Athlete ID is required' }, { status: 400 });
    }

    // Verify activity exists and belongs to the athlete
    const activity = await prisma.activity.findFirst({
      where: {
        id: activityId,
        athleteId: requestedAthleteId,
      },
    });

    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found or does not belong to athlete' },
        { status: 404 }
      );
    }

    // Run PR detection
    const startTime = Date.now();
    const result = await detectPRsForActivity(activityId, requestedAthleteId);
    const detectionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      activityId,
      athleteId: requestedAthleteId,
      prsDetected: result.standardPRs + result.metricPRs,
      standardPRs: result.standardPRs,
      metricPRs: result.metricPRs,
      detectionTimeMs: detectionTime,
      message: `Detección completada: ${result.standardPRs} récords de distancia, ${result.metricPRs} récords de métricas`,
    });
  } catch (error) {
    console.error('[POST /api/activities/[id]/detect-prs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
