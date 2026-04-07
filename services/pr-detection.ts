/**
 * PR Detection Service
 *
 * Central service for detecting personal records on activities.
 * Used by the sync flow and API endpoints.
 */

import { prisma } from '@/lib/db';
import { detectPersonalRecord } from '@/lib/personalRecords/prService';
import { detectMetricPRs } from '@/lib/personalRecords/metricPRService';
import { ActivityType } from '@/types/metricPR';

export interface PRDetectionResult {
  standardPRs: number;
  metricPRs: number;
  newRecords: Array<{
    type: 'standard' | 'metric';
    metricType: string | undefined;
    value: number;
    improvement: number | undefined;
  }>;
}

/**
 * Detect PRs for a single activity
 * @param activityId - ID of the activity to check
 * @param athleteId - ID of the athlete
 * @returns Detection results
 */
export async function detectPRsForActivity(
  activityId: string,
  athleteId: string
): Promise<PRDetectionResult> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });

  if (!activity) {
    throw new Error('Activity not found');
  }

  // Verify activity belongs to athlete
  if (activity.athleteId !== athleteId) {
    throw new Error('Activity does not belong to athlete');
  }

  let standardPRs = 0;
  let metricPRs = 0;
  const newRecords: PRDetectionResult['newRecords'] = [];

  // Check for standard distance PR (RUN only)
  if (
    activity.type === 'RUN' &&
    activity.distance &&
    activity.distance > 0 &&
    activity.movingTime &&
    activity.movingTime > 0
  ) {
    const result = await detectPersonalRecord(
      {
        id: activity.id,
        distance: activity.distance,
        movingTime: activity.movingTime,
        startDate: activity.startDate,
      },
      athleteId
    );

    if (result.isPR && result.record) {
      standardPRs++;
      newRecords.push({
        type: 'standard',
        metricType: undefined,
        value: result.record.timeSeconds,
        improvement: result.previousRecord
          ? result.previousRecord.timeSeconds - result.record.timeSeconds
          : undefined,
      });
    }
  }

  // Check for metric-based PRs (all activity types with valid data)
  const metricResults = await detectMetricPRs(
    {
      id: activity.id,
      type: activity.type as ActivityType,
      distance: activity.distance ?? 0,
      movingTime: activity.movingTime ?? 0,
      elapsedTime: activity.elapsedTime ?? 0,
      totalElevationGain: activity.totalElevationGain ?? 0,
      averageSpeed: activity.averageSpeed ?? 0,
      startDate: activity.startDate,
    },
    athleteId
  );

  for (const metricResult of metricResults) {
    if (metricResult.isPR && metricResult.record) {
      metricPRs++;
      newRecords.push({
        type: 'metric',
        metricType: metricResult.record.metricType,
        value: metricResult.record.metricValue,
        improvement: metricResult.previousRecord
          ? (metricResult.record.improvementPercent ?? undefined)
          : undefined,
      });
    }
  }

  return {
    standardPRs,
    metricPRs,
    newRecords,
  };
}

/**
 * Detect PRs for a batch of activities
 * Processes activities in chronological order to build proper PR history
 * @param activityIds - Array of activity IDs to check
 * @param athleteId - ID of the athlete
 * @returns Batch detection results
 */
export async function detectPRsForBatch(
  activityIds: string[],
  athleteId: string
): Promise<{
  totalProcessed: number;
  totalStandardPRs: number;
  totalMetricPRs: number;
  results: Array<{
    activityId: string;
    standardPRs: number;
    metricPRs: number;
  }>;
}> {
  // Fetch activities in chronological order
  const activities = await prisma.activity.findMany({
    where: {
      id: { in: activityIds },
      athleteId,
    },
    orderBy: { startDate: 'asc' },
  });

  let totalStandardPRs = 0;
  let totalMetricPRs = 0;
  const results: Array<{
    activityId: string;
    standardPRs: number;
    metricPRs: number;
  }> = [];

  for (const activity of activities) {
    const result = await detectPRsForActivity(activity.id, athleteId);

    totalStandardPRs += result.standardPRs;
    totalMetricPRs += result.metricPRs;

    results.push({
      activityId: activity.id,
      standardPRs: result.standardPRs,
      metricPRs: result.metricPRs,
    });
  }

  return {
    totalProcessed: activities.length,
    totalStandardPRs,
    totalMetricPRs,
    results,
  };
}

/**
 * Re-detect all PRs for an athlete
 * Useful after fixing detection bugs or changing PR criteria
 * WARNING: This will delete existing PR records and re-detect from scratch
 * @param athleteId - ID of the athlete
 * @returns Summary of re-detection
 */
export async function redetectAllPRs(athleteId: string): Promise<{
  success: boolean;
  message: string;
  standardPRsFound: number;
  metricPRsFound: number;
  activitiesProcessed: number;
}> {
  const startTime = Date.now();

  try {
    // Get all activities for the athlete, ordered by date
    const activities = await prisma.activity.findMany({
      where: { athleteId },
      orderBy: { startDate: 'asc' },
    });

    // Clear existing PR records in a transaction
    await prisma.$transaction([
      prisma.personalRecord.deleteMany({ where: { athleteId } }),
      prisma.metricPR.deleteMany({ where: { athleteId } }),
      prisma.pRNotification.deleteMany({ where: { athleteId } }),
    ]);

    let standardPRsFound = 0;
    let metricPRsFound = 0;

    // Re-detect PRs for each activity
    for (const activity of activities) {
      const result = await detectPRsForActivity(activity.id, athleteId);
      standardPRsFound += result.standardPRs;
      metricPRsFound += result.metricPRs;
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      message: `Re-detección completada en ${duration}ms`,
      standardPRsFound,
      metricPRsFound,
      activitiesProcessed: activities.length,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[redetectAllPRs] Error:', error);

    return {
      success: false,
      message: `Error en re-detección: ${errorMsg}`,
      standardPRsFound: 0,
      metricPRsFound: 0,
      activitiesProcessed: 0,
    };
  }
}
