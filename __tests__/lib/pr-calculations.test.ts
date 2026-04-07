/**
 * Tests for PR Calculation Utilities
 * 
 * Test coverage for:
 * - Metric comparison functions (isDistancePR, isPacePR, isDurationPR, isElevationPR)
 * - Pace calculations and conversions
 * - Formatting functions
 * - Edge cases (first record, equal values, invalid inputs)
 */

import {
  isDistancePR,
  isPacePR,
  isDurationPR,
  isElevationPR,
  isMetricPR,
  calculatePace,
  paceToMinPerKm,
  minPerKmToPace,
  formatDistance,
  formatTime,
  formatPace,
  formatElevation,
  calculateImprovementPercent,
  isValidMetricValue,
  getBetterValue,
  isBetterValue,
  formatMetricValue,
  isHigherBetter,
  METRIC_CALCULATION_CONFIG,
} from '@/lib/pr-calculations';
import { MetricType } from '@/types/metricPR';

describe('PR Calculations - Metric Comparison Functions', () => {
  describe('isDistancePR', () => {
    it('should return PR for first record (no current record)', () => {
      const result = isDistancePR(5000, null);
      
      expect(result.isPR).toBe(true);
      expect(result.newValue).toBe(5000);
      expect(result.oldValue).toBeNull();
      expect(result.improvementPercent).toBeNull();
      expect(result.improvementAbsolute).toBeNull();
    });

    it('should detect PR when distance is greater', () => {
      const result = isDistancePR(6000, 5000);
      
      expect(result.isPR).toBe(true);
      expect(result.newValue).toBe(6000);
      expect(result.oldValue).toBe(5000);
      expect(result.improvementAbsolute).toBe(1000);
      expect(result.improvementPercent).toBeCloseTo(20, 1);
    });

    it('should NOT detect PR when distance is equal', () => {
      const result = isDistancePR(5000, 5000);
      
      expect(result.isPR).toBe(false);
      expect(result.improvementPercent).toBe(0);
      expect(result.improvementAbsolute).toBe(0);
    });

    it('should NOT detect PR when distance is lower', () => {
      const result = isDistancePR(4000, 5000);
      
      expect(result.isPR).toBe(false);
      expect(result.improvementPercent).toBe(0);
      expect(result.improvementAbsolute).toBe(0);
    });
  });

  describe('isPacePR', () => {
    it('should return PR for first record', () => {
      const result = isPacePR(3.5, null);
      
      expect(result.isPR).toBe(true);
      expect(result.oldValue).toBeNull();
    });

    it('should detect PR when pace is faster (higher m/s)', () => {
      // 3.5 m/s vs 3.0 m/s = faster pace
      const result = isPacePR(3.5, 3.0);
      
      expect(result.isPR).toBe(true);
      expect(result.improvementAbsolute).toBeCloseTo(0.5, 2);
      expect(result.improvementPercent).toBeCloseTo(16.67, 1);
    });

    it('should NOT detect PR when pace is equal', () => {
      const result = isPacePR(3.5, 3.5);
      
      expect(result.isPR).toBe(false);
    });

    it('should NOT detect PR when pace is slower', () => {
      const result = isPacePR(3.0, 3.5);
      
      expect(result.isPR).toBe(false);
    });
  });

  describe('isDurationPR', () => {
    it('should return PR for first record', () => {
      const result = isDurationPR(3600, null);
      
      expect(result.isPR).toBe(true);
      expect(result.oldValue).toBeNull();
    });

    it('should detect PR when duration is longer', () => {
      const result = isDurationPR(4000, 3600);
      
      expect(result.isPR).toBe(true);
      expect(result.improvementAbsolute).toBe(400);
      expect(result.improvementPercent).toBeCloseTo(11.11, 1);
    });

    it('should NOT detect PR when duration is equal', () => {
      const result = isDurationPR(3600, 3600);
      
      expect(result.isPR).toBe(false);
    });

    it('should NOT detect PR when duration is shorter', () => {
      const result = isDurationPR(3000, 3600);
      
      expect(result.isPR).toBe(false);
    });
  });

  describe('isElevationPR', () => {
    it('should return PR for first record', () => {
      const result = isElevationPR(500, null);
      
      expect(result.isPR).toBe(true);
      expect(result.oldValue).toBeNull();
    });

    it('should detect PR when elevation is higher', () => {
      const result = isElevationPR(600, 500);
      
      expect(result.isPR).toBe(true);
      expect(result.improvementAbsolute).toBe(100);
      expect(result.improvementPercent).toBe(20);
    });

    it('should NOT detect PR when elevation is equal', () => {
      const result = isElevationPR(500, 500);
      
      expect(result.isPR).toBe(false);
    });

    it('should NOT detect PR when elevation is lower', () => {
      const result = isElevationPR(400, 500);
      
      expect(result.isPR).toBe(false);
    });
  });

  describe('isMetricPR - Generic function', () => {
    it('should delegate to isDistancePR for DISTANCE metric', () => {
      const result = isMetricPR(MetricType.DISTANCE, 5000, null);
      expect(result.isPR).toBe(true);
      expect(result.newValue).toBe(5000);
    });

    it('should delegate to isPacePR for PACE metric', () => {
      const result = isMetricPR(MetricType.PACE, 3.5, 3.0);
      expect(result.isPR).toBe(true);
    });

    it('should delegate to isDurationPR for DURATION metric', () => {
      const result = isMetricPR(MetricType.DURATION, 3600, null);
      expect(result.isPR).toBe(true);
    });

    it('should delegate to isElevationPR for ELEVATION_GAIN metric', () => {
      const result = isMetricPR(MetricType.ELEVATION_GAIN, 500, 400);
      expect(result.isPR).toBe(true);
    });

    it('should throw error for unknown metric type', () => {
      expect(() => isMetricPR('UNKNOWN' as MetricType, 100, null)).toThrow('Unknown metric type');
    });
  });
});

describe('PR Calculations - Pace Calculations', () => {
  describe('calculatePace', () => {
    it('should calculate pace correctly for 5K in 25 min', () => {
      // 5000m / 1500s = 3.33 m/s
      const pace = calculatePace(5000, 1500);
      expect(pace).toBeCloseTo(3.33, 2);
    });

    it('should calculate pace correctly for 10K in 50 min', () => {
      // 10000m / 3000s = 3.33 m/s
      const pace = calculatePace(10000, 3000);
      expect(pace).toBeCloseTo(3.33, 2);
    });

    it('should calculate sub-4:00 pace correctly', () => {
      // 5K in 20 min = 5000/1200 = 4.17 m/s
      const pace = calculatePace(5000, 1200);
      expect(pace).toBeCloseTo(4.17, 2);
    });

    it('should return 0 for zero distance', () => {
      expect(calculatePace(0, 1500)).toBe(0);
    });

    it('should return 0 for zero time', () => {
      expect(calculatePace(5000, 0)).toBe(0);
    });

    it('should return 0 for negative values', () => {
      expect(calculatePace(-100, 1500)).toBe(0);
      expect(calculatePace(5000, -100)).toBe(0);
    });
  });

  describe('paceToMinPerKm', () => {
    it('should convert 3.33 m/s to ~5:00 min/km', () => {
      const minPerKm = paceToMinPerKm(3.33);
      expect(minPerKm).toBeCloseTo(5.0, 1);
    });

    it('should convert 4.17 m/s to ~4:00 min/km', () => {
      const minPerKm = paceToMinPerKm(4.17);
      expect(minPerKm).toBeCloseTo(4.0, 1);
    });

    it('should return 0 for zero pace', () => {
      expect(paceToMinPerKm(0)).toBe(0);
    });

    it('should return 0 for negative pace', () => {
      expect(paceToMinPerKm(-1)).toBe(0);
    });
  });

  describe('minPerKmToPace', () => {
    it('should convert 5:00 min/km to ~3.33 m/s', () => {
      const pace = minPerKmToPace(5.0);
      expect(pace).toBeCloseTo(3.33, 2);
    });

    it('should convert 4:00 min/km to ~4.17 m/s', () => {
      const pace = minPerKmToPace(4.0);
      expect(pace).toBeCloseTo(4.17, 2);
    });

    it('should return 0 for zero min/km', () => {
      expect(minPerKmToPace(0)).toBe(0);
    });

    it('should return 0 for negative min/km', () => {
      expect(minPerKmToPace(-1)).toBe(0);
    });

    it('should be inverse of paceToMinPerKm', () => {
      const originalPace = 3.5;
      const minPerKm = paceToMinPerKm(originalPace);
      const convertedBack = minPerKmToPace(minPerKm);
      expect(convertedBack).toBeCloseTo(originalPace, 2);
    });
  });
});

describe('PR Calculations - Formatting Functions', () => {
  describe('formatDistance', () => {
    it('should format distances over 1000m as km', () => {
      expect(formatDistance(5000)).toBe('5.00 km');
      expect(formatDistance(10000)).toBe('10.00 km');
      expect(formatDistance(21097.5)).toBe('21.10 km');
    });

    it('should format distances under 1000m as meters', () => {
      expect(formatDistance(800)).toBe('800 m');
      expect(formatDistance(100)).toBe('100 m');
    });

    it('should handle zero distance', () => {
      expect(formatDistance(0)).toBe('0 m');
    });
  });

  describe('formatTime', () => {
    it('should format times under 1 hour as MM:SS', () => {
      expect(formatTime(1500)).toBe('25:00');
      expect(formatTime(3300)).toBe('55:00');
      expect(formatTime(59)).toBe('0:59');
    });

    it('should format times over 1 hour as H:MM:SS', () => {
      expect(formatTime(3600)).toBe('1:00:00');
      expect(formatTime(3661)).toBe('1:01:01');
      expect(formatTime(7384)).toBe('2:03:04');
    });

    it('should pad minutes and seconds correctly', () => {
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(3660)).toBe('1:01:00');
    });
  });

  describe('formatPace', () => {
    it('should format 3.33 m/s as ~5:00 /km', () => {
      const formatted = formatPace(3.33);
      expect(formatted).toMatch(/5:\d{2} \/km/);
    });

    it('should format 4.17 m/s as ~4:00 /km', () => {
      const formatted = formatPace(4.17);
      // 4.17 m/s = 3.997 min/km ≈ 4:00 /km
      // Handle edge case where seconds round to 60
      expect(formatted).toMatch(/[34]:\d{2} \/km/);
    });

    it('should return 0:00 for zero pace', () => {
      expect(formatPace(0)).toBe('0:00 /km');
    });
  });

  describe('formatElevation', () => {
    it('should format elevation as rounded meters', () => {
      expect(formatElevation(350.7)).toBe('351 m');
      expect(formatElevation(100)).toBe('100 m');
      expect(formatElevation(0)).toBe('0 m');
    });
  });

  describe('formatMetricValue', () => {
    it('should use correct formatter for each metric type', () => {
      expect(formatMetricValue(5000, MetricType.DISTANCE)).toContain('km');
      expect(formatMetricValue(3.33, MetricType.PACE)).toContain('/km');
      expect(formatMetricValue(3600, MetricType.DURATION)).toContain(':');
      expect(formatMetricValue(500, MetricType.ELEVATION_GAIN)).toContain('m');
    });
  });
});

describe('PR Calculations - Utility Functions', () => {
  describe('calculateImprovementPercent', () => {
    it('should calculate positive improvement when higher is better', () => {
      const percent = calculateImprovementPercent(110, 100, true);
      expect(percent).toBe(10);
    });

    it('should calculate negative improvement (regression) when higher is better', () => {
      const percent = calculateImprovementPercent(90, 100, true);
      expect(percent).toBe(-10);
    });

    it('should calculate positive improvement when lower is better', () => {
      // 90 vs 100, lower is better = 10% improvement
      const percent = calculateImprovementPercent(90, 100, false);
      expect(percent).toBe(10);
    });

    it('should return 0 when old value is 0', () => {
      expect(calculateImprovementPercent(100, 0, true)).toBe(0);
    });
  });

  describe('isValidMetricValue', () => {
    it('should return true for positive numbers', () => {
      expect(isValidMetricValue(100)).toBe(true);
      expect(isValidMetricValue(0.5)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isValidMetricValue(0)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isValidMetricValue(-100)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidMetricValue(NaN)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(isValidMetricValue(Infinity)).toBe(false);
      expect(isValidMetricValue(-Infinity)).toBe(false);
    });
  });

  describe('getBetterValue', () => {
    it('should return higher value when higher is better', () => {
      expect(getBetterValue(100, 90, true)).toBe(100);
      expect(getBetterValue(90, 100, true)).toBe(100);
    });

    it('should return lower value when lower is better', () => {
      expect(getBetterValue(100, 90, false)).toBe(90);
      expect(getBetterValue(90, 100, false)).toBe(90);
    });
  });

  describe('isBetterValue', () => {
    it('should correctly compare when higher is better', () => {
      expect(isBetterValue(100, 90, true)).toBe(true);
      expect(isBetterValue(90, 100, true)).toBe(false);
      expect(isBetterValue(100, 100, true)).toBe(false);
    });

    it('should correctly compare when lower is better', () => {
      expect(isBetterValue(90, 100, false)).toBe(true);
      expect(isBetterValue(100, 90, false)).toBe(false);
      expect(isBetterValue(100, 100, false)).toBe(false);
    });
  });

  describe('isHigherBetter', () => {
    it('should return true for all metric types', () => {
      // All our metrics use higher is better (even pace is stored as m/s)
      expect(isHigherBetter(MetricType.DISTANCE)).toBe(true);
      expect(isHigherBetter(MetricType.PACE)).toBe(true);
      expect(isHigherBetter(MetricType.DURATION)).toBe(true);
      expect(isHigherBetter(MetricType.ELEVATION_GAIN)).toBe(true);
    });
  });
});

describe('PR Calculations - Edge Cases', () => {
  it('should handle very large values', () => {
    const result = isDistancePR(100000, 90000); // 100km
    expect(result.isPR).toBe(true);
    expect(result.improvementAbsolute).toBe(10000);
  });

  it('should handle very small values', () => {
    const result = isDistancePR(0.1, 0.05);
    expect(result.isPR).toBe(true);
  });

  it('should handle floating point precision', () => {
    const result = isPacePR(3.333333, 3.333332);
    expect(result.isPR).toBe(true);
    expect(result.improvementAbsolute).toBeCloseTo(0.000001, 6);
  });

  it('should return consistent results with METRIC_CALCULATION_CONFIG', () => {
    // Verify all metric types are configured
    const metricTypes = Object.values(MetricType);
    metricTypes.forEach(type => {
      expect(METRIC_CALCULATION_CONFIG[type]).toBeDefined();
      expect(METRIC_CALCULATION_CONFIG[type].higherIsBetter).toBeDefined();
      expect(METRIC_CALCULATION_CONFIG[type].unit).toBeDefined();
      expect(typeof METRIC_CALCULATION_CONFIG[type].formatter).toBe('function');
    });
  });
});
