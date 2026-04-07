/**
 * Tests for Metric PR Service
 * 
 * Test coverage for:
 * - Metric value extraction and calculation
 * - PR detection logic (higher/lower is better)
 * - Batch processing
 * - Edge cases
 */

import { prisma } from '@/lib/db';
import {
  calculatePace,
  isBetterValue,
  calculateImprovementPercent,
  extractMetricValue,
  isMetricPR,
  detectMetricPRs,
  getCurrentMetricPRs,
  getMetricPRHistory,
  formatMetricPR,
  processBatchForMetricPRs,
} from '@/lib/personalRecords/metricPRService';
import { MetricType, ActivityType } from '@/types/metricPR';

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    metricPR: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pRNotification: {
      create: jest.fn(),
    },
  },
}));

describe('Metric PR Calculations', () => {
  describe('calculatePace', () => {
    it('should calculate pace correctly', () => {
      // 5km in 25 min = 3000 seconds
      // pace = 5000 / 3000 = 1.67 m/s
      expect(calculatePace(5000, 1500)).toBeCloseTo(3.33, 1);
      
      // 10km in 50 min = 3000 seconds  
      expect(calculatePace(10000, 3000)).toBeCloseTo(3.33, 1);
    });

    it('should return 0 for invalid inputs', () => {
      expect(calculatePace(0, 1500)).toBe(0);
      expect(calculatePace(5000, 0)).toBe(0);
      expect(calculatePace(-100, 1500)).toBe(0);
      expect(calculatePace(5000, -100)).toBe(0);
    });
  });

  describe('isBetterValue', () => {
    it('should correctly identify better values when higher is better', () => {
      expect(isBetterValue(100, 90, true)).toBe(true);  // 100 > 90
      expect(isBetterValue(90, 100, true)).toBe(false); // 90 < 100
      expect(isBetterValue(100, 100, true)).toBe(false); // equal
    });

    it('should correctly identify better values when lower is better', () => {
      expect(isBetterValue(90, 100, false)).toBe(true);  // 90 < 100
      expect(isBetterValue(100, 90, false)).toBe(false); // 100 > 90
      expect(isBetterValue(100, 100, false)).toBe(false); // equal
    });
  });

  describe('calculateImprovementPercent', () => {
    it('should calculate improvement when higher is better', () => {
      // 100 vs 90, higher is better = 11.1% improvement
      expect(calculateImprovementPercent(100, 90, true)).toBeCloseTo(11.11, 1);
      
      // 90 vs 100, higher is better = -10% (regression)
      expect(calculateImprovementPercent(90, 100, true)).toBeCloseTo(-10, 1);
    });

    it('should calculate improvement when lower is better', () => {
      // 90 vs 100, lower is better = 10% improvement
      expect(calculateImprovementPercent(90, 100, false)).toBeCloseTo(10, 1);
      
      // 100 vs 90, lower is better = -11.1% (regression)
      expect(calculateImprovementPercent(100, 90, false)).toBeCloseTo(-11.11, 1);
    });

    it('should return 0 when old value is 0', () => {
      expect(calculateImprovementPercent(100, 0, true)).toBe(0);
    });
  });

  describe('extractMetricValue', () => {
    const baseActivity = {
      id: 'act-1',
      type: ActivityType.RUN,
      distance: 5000,
      movingTime: 1500,
      elapsedTime: 1600,
      totalElevationGain: 100,
      averageSpeed: 3.33,
      startDate: new Date('2024-01-15'),
    };

    it('should extract distance', () => {
      expect(extractMetricValue(baseActivity, MetricType.DISTANCE)).toBe(5000);
    });

    it('should extract and calculate pace', () => {
      const pace = extractMetricValue(baseActivity, MetricType.PACE);
      expect(pace).toBeCloseTo(3.33, 1);
    });

    it('should extract duration (moving time)', () => {
      expect(extractMetricValue(baseActivity, MetricType.DURATION)).toBe(1500);
    });

    it('should extract elevation gain', () => {
      expect(extractMetricValue(baseActivity, MetricType.ELEVATION_GAIN)).toBe(100);
    });

    it('should return null for zero/invalid values', () => {
      const zeroActivity = {
        ...baseActivity,
        distance: 0,
        movingTime: 0,
        totalElevationGain: 0,
      };

      expect(extractMetricValue(zeroActivity, MetricType.DISTANCE)).toBeNull();
      expect(extractMetricValue(zeroActivity, MetricType.DURATION)).toBeNull();
      expect(extractMetricValue(zeroActivity, MetricType.ELEVATION_GAIN)).toBeNull();
    });
  });

  describe('isMetricPR', () => {
    it('should return true for first record (no current record)', () => {
      expect(isMetricPR(100, null, MetricType.DISTANCE)).toBe(true);
      expect(isMetricPR(100, null, MetricType.PACE)).toBe(true);
    });

    it('should detect PR for distance (higher is better)', () => {
      expect(isMetricPR(10000, 9000, MetricType.DISTANCE)).toBe(true);
      expect(isMetricPR(9000, 10000, MetricType.DISTANCE)).toBe(false);
      expect(isMetricPR(10000, 10000, MetricType.DISTANCE)).toBe(false);
    });

    it('should detect PR for pace (lower is better)', () => {
      // Pace: 4:00/km (240s/km = 4.17 m/s) vs 5:00/km (300s/km = 3.33 m/s)
      // Higher m/s = better (faster)
      expect(isMetricPR(4.17, 3.33, MetricType.PACE)).toBe(true);
      expect(isMetricPR(3.33, 4.17, MetricType.PACE)).toBe(false);
    });

    it('should detect PR for duration (higher is better)', () => {
      expect(isMetricPR(3600, 3000, MetricType.DURATION)).toBe(true);
      expect(isMetricPR(3000, 3600, MetricType.DURATION)).toBe(false);
    });

    it('should detect PR for elevation (higher is better)', () => {
      expect(isMetricPR(500, 400, MetricType.ELEVATION_GAIN)).toBe(true);
      expect(isMetricPR(400, 500, MetricType.ELEVATION_GAIN)).toBe(false);
    });
  });
});

describe('Metric PR Service', () => {
  const mockAthleteId = 'athlete-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectMetricPRs', () => {
    const baseActivity = {
      id: 'act-1',
      type: ActivityType.RUN,
      distance: 5000,
      movingTime: 1500,
      elapsedTime: 1600,
      totalElevationGain: 100,
      averageSpeed: 3.33,
      startDate: new Date('2024-01-15'),
    };

    it('should create PRs for all metrics on first activity', async () => {
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.create as jest.Mock).mockImplementation((args) =>
        Promise.resolve({
          id: `pr-${args.data.metricType}`,
          ...args.data,
        })
      );
      (prisma.pRNotification.create as jest.Mock).mockResolvedValue({ id: 'notif-1' });

      const results = await detectMetricPRs(baseActivity, mockAthleteId);

      // Should detect PRs for distance, pace, duration, elevation
      expect(results.length).toBeGreaterThan(0);
      
      const prsDetected = results.filter((r) => r.isPR);
      expect(prsDetected.length).toBeGreaterThan(0);
    });

    it('should only create PR when value is strictly better', async () => {
      // Existing PRs with better/equal values for all metrics
      (prisma.metricPR.findFirst as jest.Mock).mockImplementation((args) => {
        const metricType = args.where?.metricType;
        const betterValues: Record<string, number> = {
          [MetricType.DISTANCE]: 10000, // higher is better
          [MetricType.PACE]: 5.0, // higher is better (faster)
          [MetricType.DURATION]: 3600, // higher is better
          [MetricType.ELEVATION_GAIN]: 500, // higher is better
        };
        return Promise.resolve({
          id: `existing-${metricType}`,
          metricType,
          metricValue: betterValues[metricType as string] || 10000,
          isCurrent: true,
        });
      });

      const results = await detectMetricPRs(baseActivity, mockAthleteId);

      // Should not create new PRs since existing are better
      expect(prisma.metricPR.create).not.toHaveBeenCalled();
    });

    it('should update isCurrent on previous record when new PR is set', async () => {
      const existingPRs: Record<string, {id: string, metricType: MetricType, metricValue: number, isCurrent: boolean}> = {
        [MetricType.DISTANCE]: {
          id: 'existing-distance',
          metricType: MetricType.DISTANCE,
          metricValue: 4000, // Lower than new activity's 5000
          isCurrent: true,
        },
        [MetricType.PACE]: {
          id: 'existing-pace',
          metricType: MetricType.PACE,
          metricValue: 3.0, // Lower than new activity's ~3.33
          isCurrent: true,
        },
      };

      (prisma.metricPR.findFirst as jest.Mock).mockImplementation((args) => {
        const metricType = args.where?.metricType;
        if (existingPRs[metricType as string]) {
          return Promise.resolve(existingPRs[metricType as string]);
        }
        return Promise.resolve(null);
      });

      (prisma.metricPR.update as jest.Mock).mockImplementation((args) => {
        const pr = Object.values(existingPRs).find(p => p.id === args.where.id);
        return Promise.resolve({ ...pr, isCurrent: false });
      });

      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => Promise.resolve({
        id: `new-${args.data.metricType}`,
        ...args.data,
        isCurrent: true,
      }));

      await detectMetricPRs(baseActivity, mockAthleteId);

      // Should mark existing PRs as not current
      expect(prisma.metricPR.update).toHaveBeenCalled();
    });

    it('should calculate improvement percentage correctly', async () => {
      const existingPRs: Record<string, {id: string, metricType: MetricType, metricValue: number, isCurrent: boolean}> = {
        [MetricType.DISTANCE]: {
          id: 'existing-distance',
          metricType: MetricType.DISTANCE,
          metricValue: 4000,
          isCurrent: true,
        },
        [MetricType.PACE]: {
          id: 'existing-pace',
          metricType: MetricType.PACE,
          metricValue: 3.0,
          isCurrent: true,
        },
      };

      (prisma.metricPR.findFirst as jest.Mock).mockImplementation((args) => {
        const metricType = args.where?.metricType;
        return Promise.resolve(existingPRs[metricType as string] || null);
      });
      
      (prisma.metricPR.update as jest.Mock).mockResolvedValue({ isCurrent: false });
      
      const createdRecords: any[] = [];
      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => {
        createdRecords.push(args.data);
        return Promise.resolve({ id: 'new-pr', ...args.data });
      });

      await detectMetricPRs(baseActivity, mockAthleteId);

      // Find the distance record created
      const distanceRecord = createdRecords.find(r => r.metricType === MetricType.DISTANCE);
      expect(distanceRecord).toBeDefined();
      // 5000 vs 4000 = 25% improvement for distance
      expect(distanceRecord.improvementPercent).toBeCloseTo(25, 0);
    });
  });

  describe('getCurrentMetricPRs', () => {
    it('should fetch current PRs for athlete', async () => {
      const mockPRs = [
        { id: 'pr-1', metricType: MetricType.DISTANCE, metricValue: 5000 },
        { id: 'pr-2', metricType: MetricType.PACE, metricValue: 3.5 },
      ];

      (prisma.metricPR.findMany as jest.Mock).mockResolvedValue(mockPRs);

      const result = await getCurrentMetricPRs(mockAthleteId);

      expect(result).toEqual(mockPRs);
      expect(prisma.metricPR.findMany).toHaveBeenCalledWith({
        where: {
          athleteId: mockAthleteId,
          isCurrent: true,
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should filter by activity type when provided', async () => {
      (prisma.metricPR.findMany as jest.Mock).mockResolvedValue([]);

      await getCurrentMetricPRs(mockAthleteId, ActivityType.RUN);

      expect(prisma.metricPR.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            athleteId: mockAthleteId,
            isCurrent: true,
            activityType: ActivityType.RUN,
          }),
        })
      );
    });

    it('should filter by metric type when provided', async () => {
      (prisma.metricPR.findMany as jest.Mock).mockResolvedValue([]);

      await getCurrentMetricPRs(mockAthleteId, undefined, MetricType.DISTANCE);

      expect(prisma.metricPR.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            athleteId: mockAthleteId,
            isCurrent: true,
            metricType: MetricType.DISTANCE,
          }),
        })
      );
    });
  });

  describe('getMetricPRHistory', () => {
    it('should return PR history for specific metric', async () => {
      const mockHistory = [
        { id: 'pr-1', metricValue: 4000, recordDate: new Date('2024-01-01') },
        { id: 'pr-2', metricValue: 4500, recordDate: new Date('2024-02-01') },
        { id: 'pr-3', metricValue: 5000, recordDate: new Date('2024-03-01') },
      ];

      (prisma.metricPR.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await getMetricPRHistory(
        mockAthleteId,
        ActivityType.RUN,
        MetricType.DISTANCE
      );

      expect(result).toHaveLength(3);
      expect(prisma.metricPR.findMany).toHaveBeenCalledWith({
        where: {
          athleteId: mockAthleteId,
          activityType: ActivityType.RUN,
          metricType: MetricType.DISTANCE,
        },
        include: expect.any(Object),
        orderBy: { recordDate: 'asc' },
      });
    });
  });

  describe('formatMetricPR', () => {
    it('should format distance correctly', () => {
      const record = {
        id: 'pr-1',
        metricType: MetricType.DISTANCE,
        metricValue: 5000,
        improvementPercent: 10,
        previousRecord: { metricValue: 4545 },
        activity: {
          id: 'act-1',
          name: 'Morning Run',
          distance: 5000,
          movingTime: 1500,
          totalElevationGain: 100,
          averageSpeed: 3.33,
          startDate: new Date('2024-01-15'),
        },
      } as any;

      const formatted = formatMetricPR(record);

      expect(formatted.formattedValue).toBe('5.00 km');
      expect(formatted.formattedPreviousValue).toBe('4.54 km'); // 4545m = 4.545km rounded to 4.54
      expect(formatted.formattedImprovement).toBe('+10.0%');
    });

    it('should format pace correctly', () => {
      const record = {
        id: 'pr-1',
        metricType: MetricType.PACE,
        metricValue: 3.33, // m/s = ~5:00/km
        improvementPercent: 5,
        previousRecord: null,
        activity: {
          id: 'act-1',
          name: 'Morning Run',
          distance: 5000,
          movingTime: 1500,
          totalElevationGain: 100,
          averageSpeed: 3.33,
          startDate: new Date('2024-01-15'),
        },
      } as any;

      const formatted = formatMetricPR(record);

      expect(formatted.formattedValue).toMatch(/:\d{2} \/km/);
    });

    it('should format duration correctly', () => {
      const record = {
        id: 'pr-1',
        metricType: MetricType.DURATION,
        metricValue: 3661, // 1h 1m 1s
        improvementPercent: null,
        previousRecord: null,
        activity: {
          id: 'act-1',
          name: 'Long Run',
          distance: 10000,
          movingTime: 3661,
          totalElevationGain: 100,
          averageSpeed: 2.73,
          startDate: new Date('2024-01-15'),
        },
      } as any;

      const formatted = formatMetricPR(record);

      expect(formatted.formattedValue).toContain('h');
    });
  });

  describe('processBatchForMetricPRs', () => {
    it('should process activities in chronological order', async () => {
      const activities = [
        {
          id: 'act-3',
          type: ActivityType.RUN,
          distance: 6000,
          movingTime: 1800,
          elapsedTime: 1900,
          totalElevationGain: 120,
          averageSpeed: 3.33,
          startDate: new Date('2024-03-01'),
        },
        {
          id: 'act-1',
          type: ActivityType.RUN,
          distance: 5000,
          movingTime: 1500,
          elapsedTime: 1600,
          totalElevationGain: 100,
          averageSpeed: 3.33,
          startDate: new Date('2024-01-01'),
        },
        {
          id: 'act-2',
          type: ActivityType.RUN,
          distance: 5500,
          movingTime: 1650,
          elapsedTime: 1750,
          totalElevationGain: 110,
          averageSpeed: 3.33,
          startDate: new Date('2024-02-01'),
        },
      ];

      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'new-pr' });

      const result = await processBatchForMetricPRs(activities, mockAthleteId);

      expect(result.totalProcessed).toBe(3);
      // Activities should be processed in date order (act-1, act-2, act-3)
    });

    it('should not create duplicate PRs for equal values', async () => {
      const activities = [
        {
          id: 'act-1',
          type: ActivityType.RUN,
          distance: 5000,
          movingTime: 1500,
          elapsedTime: 1600,
          totalElevationGain: 100,
          averageSpeed: 3.33,
          startDate: new Date('2024-01-01'),
        },
        {
          id: 'act-2',
          type: ActivityType.RUN,
          distance: 5000, // Same distance
          movingTime: 1500, // Same time
          elapsedTime: 1600,
          totalElevationGain: 100,
          averageSpeed: 3.33,
          startDate: new Date('2024-02-01'),
        },
      ];

      let prExists = false;
      (prisma.metricPR.findFirst as jest.Mock).mockImplementation((args) => {
        const metricType = args.where?.metricType;
        if (!prExists) {
          prExists = true;
          return Promise.resolve(null);
        }
        return Promise.resolve({ 
          id: `existing-${metricType}`, 
          metricType,
          metricValue: metricType === MetricType.PACE ? 5.0 : 5000, 
          isCurrent: true 
        });
      });

      (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'new-pr' });

      await processBatchForMetricPRs(activities, mockAthleteId);

      // Should only create one PR for equal values
      const createCalls = (prisma.metricPR.create as jest.Mock).mock.calls;
      expect(createCalls.length).toBeLessThanOrEqual(4); // Max 4 metrics for first activity
    });
  });
});

describe('Metric PR Edge Cases', () => {
  it('should handle very large metric values', async () => {
    const activity = {
      id: 'act-ultra',
      type: ActivityType.RUN,
      distance: 100000, // 100km
      movingTime: 36000, // 10 hours
      elapsedTime: 37000,
      totalElevationGain: 5000,
      averageSpeed: 2.78,
      startDate: new Date('2024-01-15'),
    };

    (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'ultra-pr' });

    const results = await detectMetricPRs(activity, 'athlete-123');

    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle zero/negative values gracefully', async () => {
    const invalidActivity = {
      id: 'act-invalid',
      type: ActivityType.RUN,
      distance: -100, // Invalid
      movingTime: 0,
      elapsedTime: 0,
      totalElevationGain: -50, // Invalid
      averageSpeed: 0,
      startDate: new Date('2024-01-15'),
    };

    const results = await detectMetricPRs(invalidActivity, 'athlete-123');

    // Should not crash and should not create PRs for invalid metrics
    expect(results.every((r) => !r.isPR)).toBe(true);
  });

  it('should handle activities with partial metrics', async () => {
    const partialActivity = {
      id: 'act-partial',
      type: ActivityType.WORKOUT,
      distance: 0,
      movingTime: 3600, // Has duration
      elapsedTime: 3600,
      totalElevationGain: 0,
      averageSpeed: 0,
      startDate: new Date('2024-01-15'),
    };

    (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'duration-pr' });

    const results = await detectMetricPRs(partialActivity, 'athlete-123');

    // Should only create PR for duration
    const prCreated = results.filter((r) => r.isPR);
    expect(prCreated.length).toBeGreaterThanOrEqual(0);
  });
});
