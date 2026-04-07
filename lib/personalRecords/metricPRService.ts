/**
 * Metric PR Detection Service
 * Detects, stores, and manages metric-based PRs for any metric type
 */

import { prisma } from '@/lib/db';
import {
  MetricType,
  ActivityType,
  MetricPR,
  MetricPRActivityData,
  MetricPRDetectionResult,
  FormattedMetricPR,
  MetricPRWithActivity,
  METRIC_CONFIGS,
  METRIC_PR_EVENTS,
  MetricPREventPayload,
} from '@/types/metricPR';

/**
 * Calculate pace in m/s from distance and time
 */
export function calculatePace(distanceMeters: number, timeSeconds: number): number {
  if (timeSeconds <= 0 || distanceMeters <= 0) return 0;
  return distanceMeters / timeSeconds;
}

/**
 * Check if a value beats the current record
 * @param newValue - New metric value
 * @param currentValue - Current record value
 * @param higherIsBetter - Whether higher values are better for this metric
 * @returns True if new value is better
 */
export function isBetterValue(
  newValue: number,
  currentValue: number,
  higherIsBetter: boolean
): boolean {
  if (higherIsBetter) {
    return newValue > currentValue;
  }
  return newValue < currentValue;
}

/**
 * Calculate improvement percentage
 * @param newValue - New metric value
 * @param oldValue - Previous record value
 * @param higherIsBetter - Whether higher values are better
 * @returns Improvement percentage (positive = improvement)
 */
export function calculateImprovementPercent(
  newValue: number,
  oldValue: number,
  higherIsBetter: boolean
): number {
  if (oldValue === 0) return 0;
  const diff = newValue - oldValue;
  const percent = (diff / oldValue) * 100;
  // For metrics where lower is better, invert the sign
  return higherIsBetter ? percent : -percent;
}

/**
 * Extract metric value from activity based on metric type
 * @param activity - Activity data
 * @param metricType - Type of metric to extract
 * @returns Metric value or null if not applicable
 */
export function extractMetricValue(
  activity: MetricPRActivityData,
  metricType: MetricType
): number | null {
  switch (metricType) {
    case MetricType.DISTANCE:
      return activity.distance > 0 ? activity.distance : null;
    case MetricType.PACE:
      return activity.distance > 0 && activity.movingTime > 0
        ? calculatePace(activity.distance, activity.movingTime)
        : null;
    case MetricType.DURATION:
      return activity.movingTime > 0 ? activity.movingTime : null;
    case MetricType.ELEVATION_GAIN:
      return activity.totalElevationGain > 0 ? activity.totalElevationGain : null;
    default:
      return null;
  }
}

/**
 * Check if an activity value is a PR for a specific metric
 * @param value - New metric value
 * @param currentRecord - Current PR value
 * @param metricType - Type of metric
 * @returns Whether this is a PR
 */
export function isMetricPR(
  value: number,
  currentRecord: number | null,
  metricType: MetricType
): boolean {
  // First record is always a PR
  if (currentRecord === null) return true;

  const config = METRIC_CONFIGS[metricType];
  if (!config) {
    throw new Error(`Unknown metric type: ${metricType}`);
  }
  return isBetterValue(value, currentRecord, config.higherIsBetter);
}

/**
 * Detect all metric PRs for an activity
 * @param activity - Activity data
 * @param athleteId - Athlete ID
 * @returns Array of detection results for each metric
 */
export async function detectMetricPRs(
  activity: MetricPRActivityData,
  athleteId: string
): Promise<MetricPRDetectionResult[]> {
  const results: MetricPRDetectionResult[] = [];

  // Check each metric type
  for (const metricType of Object.values(MetricType)) {
    const metricValue = extractMetricValue(activity, metricType);

    if (metricValue === null) continue;

    // Get current PR for this metric and activity type
    const currentPR = await prisma.metricPR.findFirst({
      where: {
        athleteId,
        activityType: activity.type,
        metricType,
        isCurrent: true,
      },
    });

    const isPR = isMetricPR(metricValue, currentPR?.metricValue ?? null, metricType);

    if (isPR) {
      // Calculate improvement
      let improvementPercent: number | undefined;
      if (currentPR) {
        improvementPercent = calculateImprovementPercent(
          metricValue,
          currentPR.metricValue,
          METRIC_CONFIGS[metricType].higherIsBetter
        );
      }

      // Mark current PR as not current if exists
      if (currentPR) {
        await prisma.metricPR.update({
          where: { id: currentPR.id },
          data: { isCurrent: false },
        });
      }

      // Create new PR record
      const newRecord = await prisma.metricPR.create({
        data: {
          athleteId,
          activityId: activity.id,
          activityType: activity.type,
          metricType,
          metricValue,
          recordDate: activity.startDate,
          previousRecordId: currentPR?.id ?? null,
          isCurrent: true,
          improvementPercent: improvementPercent ?? null,
        },
      });

      results.push({
        isPR: true,
        record: newRecord,
        previousRecord: currentPR,
      });

      // Emit event for notification
      await emitMetricPREvent(
        currentPR ? METRIC_PR_EVENTS.METRIC_RECORD_BROKEN : METRIC_PR_EVENTS.METRIC_RECORD_CREATED,
        {
          athleteId,
          record: newRecord,
          previousRecord: currentPR,
        }
      );
    } else {
      results.push({
        isPR: false,
        previousRecord: currentPR,
      });
    }
  }

  return results;
}

/**
 * Get all current metric PRs for an athlete
 * @param athleteId - Athlete ID
 * @param activityType - Optional filter by activity type
 * @param metricType - Optional filter by metric type
 * @returns Array of current metric PRs
 */
export async function getCurrentMetricPRs(
  athleteId: string,
  activityType?: ActivityType,
  metricType?: MetricType
): Promise<MetricPRWithActivity[]> {
  const where: {
    athleteId: string;
    isCurrent: boolean;
    activityType?: ActivityType;
    metricType?: MetricType;
  } = {
    athleteId,
    isCurrent: true,
  };

  if (activityType) where.activityType = activityType;
  if (metricType) where.metricType = metricType;

  const records = await prisma.metricPR.findMany({
    where,
    include: {
      activity: {
        select: {
          id: true,
          name: true,
          distance: true,
          movingTime: true,
          totalElevationGain: true,
          averageSpeed: true,
          startDate: true,
        },
      },
      previousRecord: {
        select: { metricValue: true },
      },
    },
    orderBy: [{ activityType: 'asc' }, { metricType: 'asc' }],
  });

  return records;
}

/**
 * Get PR history for a specific metric and activity type
 * @param athleteId - Athlete ID
 * @param activityType - Activity type
 * @param metricType - Metric type
 * @returns Array of PRs ordered chronologically
 */
export async function getMetricPRHistory(
  athleteId: string,
  activityType: ActivityType,
  metricType: MetricType
): Promise<MetricPRWithActivity[]> {
  const records = await prisma.metricPR.findMany({
    where: {
      athleteId,
      activityType,
      metricType,
    },
    include: {
      activity: {
        select: {
          id: true,
          name: true,
          distance: true,
          movingTime: true,
          totalElevationGain: true,
          averageSpeed: true,
          startDate: true,
        },
      },
      previousRecord: {
        select: { metricValue: true },
      },
    },
    orderBy: { recordDate: 'asc' },
  });

  return records;
}

/**
 * Format a metric PR for display
 * @param record - Metric PR with activity data
 * @returns Formatted metric PR
 */
export function formatMetricPR(record: MetricPRWithActivity): FormattedMetricPR {
  const config = METRIC_CONFIGS[record.metricType];

  return {
    ...record,
    formattedValue: config.formatValue(record.metricValue),
    formattedPreviousValue: record.previousRecord
      ? config.formatValue(record.previousRecord.metricValue)
      : undefined,
    formattedImprovement: record.improvementPercent
      ? `${record.improvementPercent > 0 ? '+' : ''}${record.improvementPercent.toFixed(1)}%`
      : undefined,
    activityName: record.activity.name,
    activityDate: record.activity.startDate.toISOString(),
  };
}

/**
 * Process a batch of activities for metric PR detection
 * @param activities - Array of activity data
 * @param athleteId - Athlete ID
 * @returns Summary of PRs found
 */
export async function processBatchForMetricPRs(
  activities: MetricPRActivityData[],
  athleteId: string
): Promise<{
  totalProcessed: number;
  prsFound: number;
  records: MetricPR[];
}> {
  // Sort by date (oldest first) to build proper PR history
  const sortedActivities = [...activities].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  let prsFound = 0;
  const records: MetricPR[] = [];

  for (const activity of sortedActivities) {
    const results = await detectMetricPRs(activity, athleteId);
    for (const result of results) {
      if (result.isPR && result.record) {
        prsFound++;
        records.push(result.record);
      }
    }
  }

  return {
    totalProcessed: sortedActivities.length,
    prsFound,
    records,
  };
}

/**
 * Create a PR notification for real-time celebration
 * @param athleteId - Athlete ID
 * @param recordId - Metric PR record ID
 * @param metricType - Metric type
 * @returns Created notification
 */
export async function createPRNotification(
  athleteId: string,
  recordId: string,
  metricType: MetricType
): Promise<{
  id: string;
  athleteId: string;
  recordId: string;
  metricType: MetricType;
  seen: boolean;
  createdAt: Date;
}> {
  return prisma.pRNotification.create({
    data: {
      athleteId,
      recordId,
      metricType,
      seen: false,
    },
  });
}

/**
 * Get unread PR notifications for an athlete
 * @param athleteId - Athlete ID
 * @returns Array of unread notifications with record details
 */
export async function getUnreadPRNotifications(athleteId: string): Promise<
  {
    id: string;
    metricType: MetricType;
    record: MetricPRWithActivity;
    createdAt: Date;
  }[]
> {
  // Get notifications
  const notifications = await prisma.pRNotification.findMany({
    where: {
      athleteId,
      seen: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch records separately with activity data
  const records = await prisma.metricPR.findMany({
    where: {
      id: {
        in: notifications.map((n) => n.recordId),
      },
    },
    include: {
      activity: {
        select: {
          id: true,
          name: true,
          distance: true,
          movingTime: true,
          totalElevationGain: true,
          averageSpeed: true,
          startDate: true,
        },
      },
    },
  });

  // Map records to notifications
  const recordMap = new Map(records.map((r) => [r.id, r]));

  return notifications
    .map((n) => ({
      id: n.id,
      metricType: n.metricType,
      record: recordMap.get(n.recordId) as MetricPRWithActivity,
      createdAt: n.createdAt,
    }))
    .filter((n) => n.record !== undefined);
}

/**
 * Mark PR notifications as seen
 * @param notificationIds - Array of notification IDs to mark
 */
export async function markNotificationsAsSeen(notificationIds: string[]): Promise<void> {
  await prisma.pRNotification.updateMany({
    where: {
      id: {
        in: notificationIds,
      },
    },
    data: {
      seen: true,
    },
  });
}

// Simple event emitter for metric PR events
const eventListeners: Map<
  string,
  Set<(payload: MetricPREventPayload) => void | Promise<void>>
> = new Map();

export function onMetricPREvent(
  event: string,
  listener: (payload: MetricPREventPayload) => void | Promise<void>
): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(listener);

  return () => {
    eventListeners.get(event)?.delete(listener);
  };
}

async function emitMetricPREvent(event: string, payload: MetricPREventPayload): Promise<void> {
  const listeners = eventListeners.get(event);
  if (!listeners || listeners.size === 0) return;

  const promises = Array.from(listeners).map(async (listener) => {
    try {
      await listener(payload);
    } catch (error) {
      console.error(`[MetricPREvent] Error in listener for ${event}:`, error);
    }
  });

  await Promise.all(promises);

  // Also create notification for real-time celebration
  await createPRNotification(payload.athleteId, payload.record.id, payload.record.metricType);
}

// Default console logging listeners
onMetricPREvent(METRIC_PR_EVENTS.METRIC_RECORD_BROKEN, (payload) => {
  console.log(
    `[MetricPR] 🏆 Nuevo récord de ${payload.record.metricType} para atleta ${payload.athleteId}: ` +
      `${payload.record.metricValue}` +
      (payload.previousRecord
        ? ` (mejora de ${(((payload.record.metricValue - payload.previousRecord.metricValue) / payload.previousRecord.metricValue) * 100).toFixed(1)}%)`
        : ' (primer récord)')
  );
});

onMetricPREvent(METRIC_PR_EVENTS.METRIC_RECORD_CREATED, (payload) => {
  console.log(
    `[MetricPR] 📝 Primer récord de ${payload.record.metricType} para atleta ${payload.athleteId}: ` +
      `${payload.record.metricValue}`
  );
});
