/**
 * Personal Record Types and Constants
 */

import { StandardDistanceLabel as PrismaStandardDistanceLabel } from '@prisma/client';
export type StandardDistanceLabel = PrismaStandardDistanceLabel;

/**
 * Standard distances with tolerances for PR detection
 * Tolerance: ±2% to account for GPS variations
 */
export const STANDARD_DISTANCES = [
  {
    label: '5K' as const,
    meters: 5000,
    tolerancePercent: 0.02,
  },
  {
    label: '10K' as const,
    meters: 10000,
    tolerancePercent: 0.02,
  },
  {
    label: '15K' as const,
    meters: 15000,
    tolerancePercent: 0.02,
  },
  {
    label: 'HALF_MARATHON' as const,
    meters: 21097.5,
    tolerancePercent: 0.02,
  },
  {
    label: 'MARATHON' as const,
    meters: 42195,
    tolerancePercent: 0.02,
  },
] as const;

/**
 * Personal Record interface
 */
export interface PersonalRecord {
  id: string;
  athleteId: string;
  distanceLabel: StandardDistanceLabel;
  distanceMeters: number;
  timeSeconds: number;
  pacePerKm: number;
  activityId: string;
  achievedAt: Date;
  previousRecordId: string | null;
  improvementSeconds: number | null;
  isCurrentRecord: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of PR detection
 */
export interface PRDetectionResult {
  isPR: boolean;
  record?: PersonalRecord;
  previousRecord?: PersonalRecord | null;
}

/**
 * Activity data for PR detection
 */
export interface PRActivityData {
  id: string;
  stravaActivityId?: bigint;
  distance: number;
  movingTime: number;
  startDate: Date;
}

/**
 * Formatted PR for display
 */
export interface FormattedPersonalRecord extends PersonalRecord {
  formattedTime: string;
  formattedPace: string;
  formattedDistance: string;
  improvementPercent?: number;
}

/**
 * PR History entry for charts
 */
export interface PRHistoryEntry {
  date: string;
  timeSeconds: number;
  formattedTime: string;
  improvementSeconds: number;
}

/**
 * PR Event types for event emitter
 */
export const PR_EVENTS = {
  RECORD_BROKEN: 'RECORD_BROKEN',
  RECORD_CREATED: 'RECORD_CREATED',
} as const;

export type PREventType = (typeof PR_EVENTS)[keyof typeof PR_EVENTS];

export interface PREventPayload {
  athleteId: string;
  record: PersonalRecord;
  previousRecord?: PersonalRecord | null;
}
