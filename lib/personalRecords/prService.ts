/**
 * Personal Record Service
 * Detects, stores, and manages PRs for standard distances
 */

import { StandardDistanceLabel, PersonalRecord } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  STANDARD_DISTANCES,
  PRDetectionResult,
  PRActivityData,
  FormattedPersonalRecord,
  PR_EVENTS,
} from '@/types/personalRecord';

import { emitPREvent } from './prEventEmitter';

// Map frontend distance labels to Prisma enum values
const FRONTEND_TO_PRISMA_LABEL_MAP: Record<string, StandardDistanceLabel> = {
  '5K': 'FIVE_K',
  '10K': 'TEN_K',
  '15K': 'FIFTEEN_K',
  HALF_MARATHON: 'HALF_MARATHON',
  MARATHON: 'MARATHON',
};

/**
 * Detects if an activity matches a standard distance within tolerance
 * @param distance - Distance in meters
 * @returns The matching standard distance or null
 */
export function detectStandardDistance(
  distance: number
): { label: StandardDistanceLabel; targetMeters: number } | null {
  for (const std of STANDARD_DISTANCES) {
    const tolerance = std.meters * std.tolerancePercent;
    const minDistance = std.meters - tolerance;
    const maxDistance = std.meters + tolerance;

    if (distance >= minDistance && distance <= maxDistance) {
      const prismaLabel = FRONTEND_TO_PRISMA_LABEL_MAP[std.label];
      if (!prismaLabel) return null;
      return { label: prismaLabel, targetMeters: std.meters };
    }
  }
  return null;
}

/**
 * Calculates pace per km in seconds
 * @param timeSeconds - Total time in seconds
 * @param distanceMeters - Distance in meters
 * @returns Pace per km in seconds
 */
export function calculatePacePerKm(timeSeconds: number, distanceMeters: number): number {
  if (distanceMeters <= 0) return 0;
  return (timeSeconds / distanceMeters) * 1000;
}

/**
 * Formats time in seconds to HH:MM:SS or MM:SS
 */
export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formats pace in seconds/km to MM:SS
 */
export function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formats a personal record for display
 */
export function formatPersonalRecord(
  record: PersonalRecord & { previousRecord?: { timeSeconds: number } | null }
): FormattedPersonalRecord {
  const formatted: FormattedPersonalRecord = {
    ...record,
    formattedTime: formatTime(record.timeSeconds),
    formattedPace: `${formatPace(record.pacePerKm)}/km`,
    formattedDistance: record.distanceLabel.replace('_', ' '),
  };

  if (record.improvementSeconds && record.previousRecord) {
    formatted.improvementPercent =
      (record.improvementSeconds / record.previousRecord.timeSeconds) * 100;
  }

  return formatted;
}

/**
 * Detects if an activity is a personal record
 * @param activity - Activity data
 * @param athleteId - Athlete ID
 * @returns Detection result
 */
export async function detectPersonalRecord(
  activity: PRActivityData,
  athleteId: string
): Promise<PRDetectionResult> {
  // Check if activity matches a standard distance
  const standardDistance = detectStandardDistance(activity.distance);
  if (!standardDistance) {
    return { isPR: false };
  }

  // Get current PR for this distance
  const currentPR = await prisma.personalRecord.findFirst({
    where: {
      athleteId,
      distanceLabel: standardDistance.label,
      isCurrentRecord: true,
    },
    orderBy: { achievedAt: 'desc' },
  });

  // If no current PR, this is automatically a PR
  if (!currentPR) {
    const pacePerKm = calculatePacePerKm(activity.movingTime, activity.distance);

    const newRecord = await prisma.personalRecord.create({
      data: {
        athleteId,
        distanceLabel: standardDistance.label,
        distanceMeters: activity.distance,
        timeSeconds: activity.movingTime,
        pacePerKm,
        activityId: activity.id,
        achievedAt: activity.startDate,
        isCurrentRecord: true,
      },
    });

    // Emit event for first PR
    await emitPREvent(PR_EVENTS.RECORD_CREATED, {
      athleteId,
      record: newRecord as PersonalRecord,
      previousRecord: null,
    });

    return {
      isPR: true,
      record: newRecord as PersonalRecord,
      previousRecord: null,
    };
  }

  // Check if this activity is faster than current PR
  if (activity.movingTime < currentPR.timeSeconds) {
    const pacePerKm = calculatePacePerKm(activity.movingTime, activity.distance);
    const improvementSeconds = currentPR.timeSeconds - activity.movingTime;

    // Mark current PR as not current
    await prisma.personalRecord.update({
      where: { id: currentPR.id },
      data: { isCurrentRecord: false },
    });

    // Create new PR
    const newRecord = await prisma.personalRecord.create({
      data: {
        athleteId,
        distanceLabel: standardDistance.label,
        distanceMeters: activity.distance,
        timeSeconds: activity.movingTime,
        pacePerKm,
        activityId: activity.id,
        achievedAt: activity.startDate,
        previousRecordId: currentPR.id,
        improvementSeconds,
        isCurrentRecord: true,
      },
    });

    // Emit RECORD_BROKEN event
    await emitPREvent(PR_EVENTS.RECORD_BROKEN, {
      athleteId,
      record: newRecord as PersonalRecord,
      previousRecord: currentPR as PersonalRecord,
    });

    return {
      isPR: true,
      record: newRecord as PersonalRecord,
      previousRecord: currentPR as PersonalRecord,
    };
  }

  // Not a PR
  return { isPR: false, previousRecord: currentPR as PersonalRecord };
}

/**
 * Gets all current personal records for an athlete
 * @param athleteId - Athlete ID
 * @returns Array of formatted personal records
 */
export async function getCurrentPersonalRecords(
  athleteId: string
): Promise<FormattedPersonalRecord[]> {
  const records = await prisma.personalRecord.findMany({
    where: {
      athleteId,
      isCurrentRecord: true,
    },
    include: {
      previousRecord: {
        select: { timeSeconds: true },
      },
    },
    orderBy: { distanceMeters: 'asc' },
  });

  return records.map(formatPersonalRecord);
}

/**
 * Gets the history of PRs for a specific distance
 * @param athleteId - Athlete ID
 * @param distanceLabel - Distance label
 * @returns Array of PRs ordered chronologically
 */
export async function getPersonalRecordHistory(
  athleteId: string,
  distanceLabel: StandardDistanceLabel
): Promise<FormattedPersonalRecord[]> {
  const records = await prisma.personalRecord.findMany({
    where: {
      athleteId,
      distanceLabel,
    },
    include: {
      previousRecord: {
        select: { timeSeconds: true },
      },
    },
    orderBy: { achievedAt: 'asc' },
  });

  return records.map(formatPersonalRecord);
}

/**
 * Processes a batch of activities for PR detection
 * Used during initial import of historical activities
 * @param activities - Array of activity data
 * @param athleteId - Athlete ID
 * @returns Summary of PRs found
 */
export async function processBatchForPRs(
  activities: PRActivityData[],
  athleteId: string
): Promise<{
  totalProcessed: number;
  prsFound: number;
  records: PersonalRecord[];
}> {
  // Sort by date (oldest first) to build proper PR history
  const sortedActivities = [...activities].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  let prsFound = 0;
  const records: PersonalRecord[] = [];

  for (const activity of sortedActivities) {
    const result = await detectPersonalRecord(activity, athleteId);
    if (result.isPR && result.record) {
      prsFound++;
      records.push(result.record);
    }
  }

  return {
    totalProcessed: sortedActivities.length,
    prsFound,
    records,
  };
}

/**
 * Checks if an activity is a PR without creating/updating records
 * Useful for preview/detection without persistence
 * @param activity - Activity data
 * @param athleteId - Athlete ID
 * @returns Whether it would be a PR and current record info
 */
export async function previewPersonalRecord(
  activity: PRActivityData,
  athleteId: string
): Promise<{ wouldBePR: boolean; currentRecordTime?: number; improvementSeconds?: number }> {
  const standardDistance = detectStandardDistance(activity.distance);
  if (!standardDistance) {
    return { wouldBePR: false };
  }

  const currentPR = await prisma.personalRecord.findFirst({
    where: {
      athleteId,
      distanceLabel: standardDistance.label,
      isCurrentRecord: true,
    },
  });

  if (!currentPR) {
    return { wouldBePR: true };
  }

  if (activity.movingTime < currentPR.timeSeconds) {
    return {
      wouldBePR: true,
      currentRecordTime: currentPR.timeSeconds,
      improvementSeconds: currentPR.timeSeconds - activity.movingTime,
    };
  }

  return {
    wouldBePR: false,
    currentRecordTime: currentPR.timeSeconds,
  };
}
