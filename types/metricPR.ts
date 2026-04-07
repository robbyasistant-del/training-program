/**
 * Metric PR Types and Constants
 */

import { MetricType, ActivityType } from '@prisma/client';

export { MetricType, ActivityType };

/**
 * Metric PR interface
 */
export interface MetricPR {
  id: string;
  athleteId: string;
  activityId: string;
  activityType: ActivityType;
  metricType: MetricType;
  metricValue: number;
  recordDate: Date;
  previousRecordId?: string | null;
  isCurrent: boolean;
  improvementPercent?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metric PR with activity details
 */
export interface MetricPRWithActivity extends MetricPR {
  activity: {
    id: string;
    name: string;
    distance: number | null;
    movingTime: number | null;
    totalElevationGain: number | null;
    averageSpeed: number | null;
    startDate: Date;
  };
  previousRecord?: {
    metricValue: number;
  } | null;
}

/**
 * Activity data for metric PR detection
 */
export interface MetricPRActivityData {
  id: string;
  type: ActivityType;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  totalElevationGain: number;
  averageSpeed: number;
  startDate: Date;
}

/**
 * Result of metric PR detection
 */
export interface MetricPRDetectionResult {
  isPR: boolean;
  record?: MetricPR;
  previousRecord?: MetricPR | null;
}

/**
 * Formatted Metric PR for display
 */
export interface FormattedMetricPR extends MetricPR {
  formattedValue: string;
  formattedPreviousValue?: string | undefined;
  formattedImprovement?: string | undefined;
  activityName: string;
  activityDate: string;
}

/**
 * Metric configuration with display info
 */
export interface MetricConfig {
  type: MetricType;
  label: string;
  unit: string;
  icon: string;
  higherIsBetter: boolean;
  formatValue: (value: number) => string;
}

/**
 * Metric configurations for display
 */
export const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  [MetricType.DISTANCE]: {
    type: MetricType.DISTANCE,
    label: 'Distancia',
    unit: 'km',
    icon: 'route',
    higherIsBetter: true,
    formatValue: (v) => `${(v / 1000).toFixed(2)} km`,
  },
  [MetricType.PACE]: {
    type: MetricType.PACE,
    label: 'Ritmo',
    unit: 'min/km',
    icon: 'gauge',
    higherIsBetter: true, // Higher m/s = faster = better
    formatValue: (v) => {
      // v is in m/s, convert to min/km
      if (v <= 0) return '0:00 /km';
      const pacePerKm = 1000 / v / 60; // minutes per km
      const mins = Math.floor(pacePerKm);
      const secs = Math.round((pacePerKm - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, '0')} /km`;
    },
  },
  [MetricType.DURATION]: {
    type: MetricType.DURATION,
    label: 'Duración',
    unit: 'h',
    icon: 'clock',
    higherIsBetter: true,
    formatValue: (v) => {
      const hours = Math.floor(v / 3600);
      const mins = Math.floor((v % 3600) / 60);
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    },
  },
  [MetricType.ELEVATION_GAIN]: {
    type: MetricType.ELEVATION_GAIN,
    label: 'Desnivel',
    unit: 'm',
    icon: 'mountain',
    higherIsBetter: true,
    formatValue: (v) => `${Math.round(v)} m`,
  },
};

/**
 * Metric PR Event types
 */
export const METRIC_PR_EVENTS = {
  METRIC_RECORD_BROKEN: 'METRIC_RECORD_BROKEN',
  METRIC_RECORD_CREATED: 'METRIC_RECORD_CREATED',
} as const;

export type MetricPREventType = (typeof METRIC_PR_EVENTS)[keyof typeof METRIC_PR_EVENTS];

export interface MetricPREventPayload {
  athleteId: string;
  record: MetricPR;
  previousRecord?: MetricPR | null;
}

/**
 * PR Notification interface
 */
export interface PRNotification {
  id: string;
  athleteId: string;
  recordId: string;
  metricType: MetricType;
  seen: boolean;
  createdAt: Date;
}

/**
 * PR Notification with record details
 */
export interface PRNotificationWithRecord extends PRNotification {
  record: MetricPRWithActivity;
}
