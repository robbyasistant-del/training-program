/**
 * PR Calculation Utilities
 *
 * Helper functions for calculating and comparing PR metrics.
 * These utilities handle unit conversions and comparison logic
 * for different metric types (distance, pace, duration, elevation).
 */

import { MetricType } from '@/types/metricPR';

/**
 * Result of a PR comparison
 */
export interface PRComparisonResult {
  isPR: boolean;
  newValue: number;
  oldValue: number | null;
  improvementPercent: number | null;
  improvementAbsolute: number | null;
}

/**
 * Check if a distance value is a PR
 * @param newDistance - New distance in meters
 * @param currentRecord - Current best distance (null if no previous record)
 * @returns Comparison result
 */
export function isDistancePR(
  newDistance: number,
  currentRecord: number | null
): PRComparisonResult {
  // First record is always a PR
  if (currentRecord === null) {
    return {
      isPR: true,
      newValue: newDistance,
      oldValue: null,
      improvementPercent: null,
      improvementAbsolute: null,
    };
  }

  // Distance: higher is better
  const isBetter = newDistance > currentRecord;
  const improvementAbsolute = newDistance - currentRecord;
  const improvementPercent = currentRecord > 0 ? (improvementAbsolute / currentRecord) * 100 : 0;

  return {
    isPR: isBetter,
    newValue: newDistance,
    oldValue: currentRecord,
    improvementPercent: isBetter ? improvementPercent : 0,
    improvementAbsolute: isBetter ? improvementAbsolute : 0,
  };
}

/**
 * Check if a pace value is a PR
 * Pace is stored in m/s (higher = faster = better)
 * @param newPace - New pace in m/s
 * @param currentRecord - Current best pace (null if no previous record)
 * @returns Comparison result
 */
export function isPacePR(newPace: number, currentRecord: number | null): PRComparisonResult {
  // First record is always a PR
  if (currentRecord === null) {
    return {
      isPR: true,
      newValue: newPace,
      oldValue: null,
      improvementPercent: null,
      improvementAbsolute: null,
    };
  }

  // Pace: higher m/s is better (faster)
  const isBetter = newPace > currentRecord;
  const improvementAbsolute = newPace - currentRecord;
  const improvementPercent = currentRecord > 0 ? (improvementAbsolute / currentRecord) * 100 : 0;

  return {
    isPR: isBetter,
    newValue: newPace,
    oldValue: currentRecord,
    improvementPercent: isBetter ? improvementPercent : 0,
    improvementAbsolute: isBetter ? improvementAbsolute : 0,
  };
}

/**
 * Check if a duration value is a PR
 * @param newDuration - New duration in seconds
 * @param currentRecord - Current best duration (null if no previous record)
 * @returns Comparison result
 */
export function isDurationPR(
  newDuration: number,
  currentRecord: number | null
): PRComparisonResult {
  // First record is always a PR
  if (currentRecord === null) {
    return {
      isPR: true,
      newValue: newDuration,
      oldValue: null,
      improvementPercent: null,
      improvementAbsolute: null,
    };
  }

  // Duration: higher is better (longer activities)
  const isBetter = newDuration > currentRecord;
  const improvementAbsolute = newDuration - currentRecord;
  const improvementPercent = currentRecord > 0 ? (improvementAbsolute / currentRecord) * 100 : 0;

  return {
    isPR: isBetter,
    newValue: newDuration,
    oldValue: currentRecord,
    improvementPercent: isBetter ? improvementPercent : 0,
    improvementAbsolute: isBetter ? improvementAbsolute : 0,
  };
}

/**
 * Check if an elevation gain value is a PR
 * @param newElevation - New elevation gain in meters
 * @param currentRecord - Current best elevation (null if no previous record)
 * @returns Comparison result
 */
export function isElevationPR(
  newElevation: number,
  currentRecord: number | null
): PRComparisonResult {
  // First record is always a PR
  if (currentRecord === null) {
    return {
      isPR: true,
      newValue: newElevation,
      oldValue: null,
      improvementPercent: null,
      improvementAbsolute: null,
    };
  }

  // Elevation: higher is better
  const isBetter = newElevation > currentRecord;
  const improvementAbsolute = newElevation - currentRecord;
  const improvementPercent = currentRecord > 0 ? (improvementAbsolute / currentRecord) * 100 : 0;

  return {
    isPR: isBetter,
    newValue: newElevation,
    oldValue: currentRecord,
    improvementPercent: isBetter ? improvementPercent : 0,
    improvementAbsolute: isBetter ? improvementAbsolute : 0,
  };
}

/**
 * Generic PR checker that delegates to specific metric functions
 * @param metricType - Type of metric being checked
 * @param newValue - New metric value
 * @param currentRecord - Current record value (null if none)
 * @returns Comparison result
 */
export function isMetricPR(
  metricType: MetricType,
  newValue: number,
  currentRecord: number | null
): PRComparisonResult {
  switch (metricType) {
    case MetricType.DISTANCE:
      return isDistancePR(newValue, currentRecord);
    case MetricType.PACE:
      return isPacePR(newValue, currentRecord);
    case MetricType.DURATION:
      return isDurationPR(newValue, currentRecord);
    case MetricType.ELEVATION_GAIN:
      return isElevationPR(newValue, currentRecord);
    default:
      throw new Error(`Unknown metric type: ${metricType}`);
  }
}

/**
 * Calculate pace from distance and time
 * @param distanceMeters - Distance in meters
 * @param timeSeconds - Time in seconds
 * @returns Pace in m/s (meters per second)
 */
export function calculatePace(distanceMeters: number, timeSeconds: number): number {
  if (timeSeconds <= 0 || distanceMeters <= 0) {
    return 0;
  }
  return distanceMeters / timeSeconds;
}

/**
 * Convert pace from m/s to min/km
 * @param paceMs - Pace in meters per second
 * @returns Pace in minutes per kilometer
 */
export function paceToMinPerKm(paceMs: number): number {
  if (paceMs <= 0) {
    return 0;
  }
  // (1000 meters / pace m/s) / 60 seconds = minutes per km
  return 1000 / paceMs / 60;
}

/**
 * Convert pace from min/km to m/s
 * @param minPerKm - Pace in minutes per kilometer
 * @returns Pace in meters per second
 */
export function minPerKmToPace(minPerKm: number): number {
  if (minPerKm <= 0) {
    return 0;
  }
  // 1000 meters / (minutes * 60) = m/s
  return 1000 / (minPerKm * 60);
}

/**
 * Format distance for display
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "5.00 km" or "800 m")
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format time for display
 * @param seconds - Time in seconds
 * @returns Formatted string (e.g., "1:23:45" or "45:30")
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format pace for display
 * @param paceMs - Pace in m/s
 * @returns Formatted string (e.g., "5:30 /km")
 */
export function formatPace(paceMs: number): string {
  const minPerKm = paceToMinPerKm(paceMs);
  if (minPerKm === 0) {
    return '0:00 /km';
  }

  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}

/**
 * Format elevation for display
 * @param meters - Elevation in meters
 * @returns Formatted string (e.g., "350 m")
 */
export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

/**
 * Calculate improvement percentage between two values
 * @param newValue - New value
 * @param oldValue - Old value
 * @param higherIsBetter - Whether higher values represent improvement
 * @returns Improvement percentage (positive = improvement)
 */
export function calculateImprovementPercent(
  newValue: number,
  oldValue: number,
  higherIsBetter: boolean
): number {
  if (oldValue === 0) {
    return 0;
  }

  const diff = newValue - oldValue;
  const percent = (diff / oldValue) * 100;

  // For metrics where lower is better, invert the sign
  return higherIsBetter ? percent : -percent;
}

/**
 * Check if a value is valid for PR consideration
 * @param value - Value to check
 * @returns True if value is valid (positive, finite, not NaN)
 */
export function isValidMetricValue(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value) && value > 0;
}

/**
 * Get the better of two values based on metric configuration
 * @param value1 - First value
 * @param value2 - Second value
 * @param higherIsBetter - Whether higher values are better
 * @returns The better value
 */
export function getBetterValue(value1: number, value2: number, higherIsBetter: boolean): number {
  if (higherIsBetter) {
    return Math.max(value1, value2);
  }
  return Math.min(value1, value2);
}

/**
 * Determine if a new value beats the current record
 * @param newValue - New value
 * @param currentRecord - Current record value
 * @param higherIsBetter - Whether higher values are better
 * @returns True if new value is better
 */
export function isBetterValue(
  newValue: number,
  currentRecord: number,
  higherIsBetter: boolean
): boolean {
  if (higherIsBetter) {
    return newValue > currentRecord;
  }
  return newValue < currentRecord;
}

/**
 * Metric configuration mapping
 * Defines display and comparison behavior for each metric type
 */
export const METRIC_CALCULATION_CONFIG: Record<
  MetricType,
  {
    higherIsBetter: boolean;
    unit: string;
    formatter: (value: number) => string;
  }
> = {
  [MetricType.DISTANCE]: {
    higherIsBetter: true,
    unit: 'm',
    formatter: formatDistance,
  },
  [MetricType.PACE]: {
    higherIsBetter: true, // Higher m/s = faster
    unit: 'm/s',
    formatter: formatPace,
  },
  [MetricType.DURATION]: {
    higherIsBetter: true,
    unit: 's',
    formatter: formatTime,
  },
  [MetricType.ELEVATION_GAIN]: {
    higherIsBetter: true,
    unit: 'm',
    formatter: formatElevation,
  },
};

/**
 * Format a metric value based on its type
 * @param value - Metric value
 * @param metricType - Type of metric
 * @returns Formatted string
 */
export function formatMetricValue(value: number, metricType: MetricType): string {
  const config = METRIC_CALCULATION_CONFIG[metricType];
  return config.formatter(value);
}

/**
 * Check if a metric type uses "higher is better" comparison
 * @param metricType - Type of metric
 * @returns True if higher values are better
 */
export function isHigherBetter(metricType: MetricType): boolean {
  return METRIC_CALCULATION_CONFIG[metricType].higherIsBetter;
}
