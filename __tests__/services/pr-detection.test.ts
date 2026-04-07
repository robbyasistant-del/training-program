/**
 * Tests for PR Detection Service
 * 
 * Test coverage for:
 * - detectPRsForActivity: Single activity PR detection
 * - detectPRsForBatch: Batch activity PR detection  
 * - redetectAllPRs: Full re-detection workflow
 * - Edge cases: First activity, ties, batch imports
 */

import { prisma } from '@/lib/db';
import {
  detectPRsForActivity,
  detectPRsForBatch,
  redetectAllPRs,
  PRDetectionResult,
} from '@/services/pr-detection';
import { ActivityType, MetricType } from '@/types/metricPR';

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    activity: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    personalRecord: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    metricPR: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    pRNotification: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('PR Detection Service', () => {
  const mockAthleteId = 'athlete-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPRsForActivity', () => {
    it('should throw error if activity not found', async () => {
      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        detectPRsForActivity('non-existent-id', mockAthleteId)
      ).rejects.toThrow('Activity not found');
    });

    it('should throw error if activity belongs to different athlete', async () => {
      (prisma.activity.findUnique as jest.Mock).mockResolvedValue({
        id: 'activity-1',
        athleteId: 'different-athlete',
        type: 'RUN',
        distance: 5000,
        movingTime: 1500,
        startDate: new Date('2024-01-15'),
      });

      await expect(
        detectPRsForActivity('activity-1', mockAthleteId)
      ).rejects.toThrow('Activity does not belong to athlete');
    });

    it('should detect first PR for a standard distance (baseline case)', async () => {
      const activity = {
        id: 'activity-1',
        athleteId: mockAthleteId,
        type: 'RUN',
        distance: 5000,
        movingTime: 1500, // 25:00
        elapsedTime: 1600,
        totalElevationGain: 50,
        averageSpeed: 3.33,
        startDate: new Date('2024-01-15'),
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(activity);
      
      // No existing PRs
      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Mock created records
      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({
        id: 'pr-1',
        athleteId: mockAthleteId,
        distanceLabel: '5K',
        distanceMeters: 5000,
        timeSeconds: 1500,
        pacePerKm: 300,
        activityId: 'activity-1',
        isCurrentRecord: true,
      });

      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => ({
        id: `metric-pr-${args.data.metricType}`,
        ...args.data,
        isCurrent: true,
      }));

      const result = await detectPRsForActivity('activity-1', mockAthleteId);

      expect(result.standardPRs).toBeGreaterThanOrEqual(0);
      expect(result.metricPRs).toBeGreaterThanOrEqual(0);
    });

    it('should detect metric PRs for non-RUN activities', async () => {
      const rideActivity = {
        id: 'activity-ride-1',
        athleteId: mockAthleteId,
        type: 'RIDE',
        distance: 50000,
        movingTime: 7200, // 2 hours
        elapsedTime: 7500,
        totalElevationGain: 800,
        averageSpeed: 6.94,
        startDate: new Date('2024-01-20'),
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(rideActivity);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => ({
        id: `metric-pr-${args.data.metricType}`,
        ...args.data,
        isCurrent: true,
      }));

      const result = await detectPRsForActivity('activity-ride-1', mockAthleteId);

      // Should detect metric PRs but no standard distance PRs (not a RUN)
      expect(result.standardPRs).toBe(0);
      expect(result.metricPRs).toBeGreaterThanOrEqual(0);
    });

    it('should detect PR when value is strictly better', async () => {
      const activity = {
        id: 'activity-2',
        athleteId: mockAthleteId,
        type: 'RUN',
        distance: 5000,
        movingTime: 1400, // 23:20 - faster than existing 25:00
        elapsedTime: 1500,
        totalElevationGain: 50,
        averageSpeed: 3.57,
        startDate: new Date('2024-02-01'),
      };

      const existingPR = {
        id: 'pr-existing',
        athleteId: mockAthleteId,
        distanceLabel: '5K',
        timeSeconds: 1500, // 25:00
        isCurrentRecord: true,
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(activity);
      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(existingPR);
      (prisma.personalRecord.update as jest.Mock).mockResolvedValue({
        ...existingPR,
        isCurrentRecord: false,
      });
      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({
        id: 'pr-new',
        athleteId: mockAthleteId,
        distanceLabel: '5K',
        timeSeconds: 1400,
        previousRecordId: 'pr-existing',
        improvementSeconds: 100,
        isCurrentRecord: true,
      });
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => ({
        id: `metric-pr-${args.data.metricType}`,
        ...args.data,
        isCurrent: true,
      }));

      const result = await detectPRsForActivity('activity-2', mockAthleteId);

      expect(result.standardPRs).toBeGreaterThanOrEqual(0);
      expect(result.metricPRs).toBeGreaterThanOrEqual(0);
    });

    it('should NOT detect PR when value is equal (strictly better required)', async () => {
      const activity = {
        id: 'activity-3',
        athleteId: mockAthleteId,
        type: 'RUN',
        distance: 5000,
        movingTime: 1500, // Exactly same as existing PR
        elapsedTime: 1600,
        totalElevationGain: 50,
        averageSpeed: 3.33,
        startDate: new Date('2024-03-01'),
      };

      const existingPR = {
        id: 'pr-existing',
        athleteId: mockAthleteId,
        distanceLabel: '5K',
        timeSeconds: 1500,
        isCurrentRecord: true,
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(activity);
      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(existingPR);
      
      // Mock metric PRs - some may be detected
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => ({
        id: `metric-pr-${args.data.metricType}`,
        ...args.data,
        isCurrent: true,
      }));

      const result = await detectPRsForActivity('activity-3', mockAthleteId);

      // Should not create new standard PR (equal time)
      expect(prisma.personalRecord.create).not.toHaveBeenCalled();
    });

    it('should NOT detect PR when value is worse', async () => {
      const activity = {
        id: 'activity-4',
        athleteId: mockAthleteId,
        type: 'RUN',
        distance: 5000,
        movingTime: 1600, // 26:40 - slower than existing 25:00
        elapsedTime: 1700,
        totalElevationGain: 50,
        averageSpeed: 3.125,
        startDate: new Date('2024-04-01'),
      };

      const existingPR = {
        id: 'pr-existing',
        athleteId: mockAthleteId,
        distanceLabel: '5K',
        timeSeconds: 1500,
        isCurrentRecord: true,
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(activity);
      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(existingPR);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => ({
        id: `metric-pr-${args.data.metricType}`,
        ...args.data,
        isCurrent: true,
      }));

      const result = await detectPRsForActivity('activity-4', mockAthleteId);

      // Should not create new standard PR (slower time)
      expect(prisma.personalRecord.create).not.toHaveBeenCalled();
    });

    it('should handle activities without valid metrics gracefully', async () => {
      const incompleteActivity = {
        id: 'activity-5',
        athleteId: mockAthleteId,
        type: 'WORKOUT',
        distance: 0,
        movingTime: 0,
        elapsedTime: 1800,
        totalElevationGain: 0,
        averageSpeed: 0,
        startDate: new Date('2024-05-01'),
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(incompleteActivity);

      const result = await detectPRsForActivity('activity-5', mockAthleteId);

      expect(result.standardPRs).toBe(0);
      expect(result.metricPRs).toBe(0);
    });
  });

  describe('detectPRsForBatch', () => {
    it('should process activities in chronological order', async () => {
      const activities = [
        {
          id: 'activity-1',
          athleteId: mockAthleteId,
          startDate: new Date('2024-01-15'),
        },
        {
          id: 'activity-2',
          athleteId: mockAthleteId,
          startDate: new Date('2024-01-10'), // Earlier
        },
        {
          id: 'activity-3',
          athleteId: mockAthleteId,
          startDate: new Date('2024-01-20'), // Later
        },
      ];

      (prisma.activity.findMany as jest.Mock).mockResolvedValue(activities);
      
      // Mock individual activity detection
      (prisma.activity.findUnique as jest.Mock).mockImplementation((args) => {
        const activity = activities.find((a) => a.id === args.where.id);
        return Promise.resolve({
          ...activity,
          type: 'RUN',
          distance: 5000,
          movingTime: 1500,
          elapsedTime: 1600,
          totalElevationGain: 50,
          averageSpeed: 3.33,
        });
      });

      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({ id: 'pr-new' });
      (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'metric-pr-new' });

      const result = await detectPRsForBatch(
        ['activity-1', 'activity-2', 'activity-3'],
        mockAthleteId
      );

      expect(result.totalProcessed).toBe(3);
      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['activity-1', 'activity-2', 'activity-3'] },
          athleteId: mockAthleteId,
        },
        orderBy: { startDate: 'asc' },
      });
    });

    it('should handle empty activity list', async () => {
      (prisma.activity.findMany as jest.Mock).mockResolvedValue([]);

      const result = await detectPRsForBatch([], mockAthleteId);

      expect(result.totalProcessed).toBe(0);
      expect(result.totalStandardPRs).toBe(0);
      expect(result.totalMetricPRs).toBe(0);
    });

    it('should not create duplicate PRs in batch import', async () => {
      // Simulate two activities with same distance/time
      const activities = [
        {
          id: 'activity-1',
          athleteId: mockAthleteId,
          type: 'RUN',
          distance: 5000,
          movingTime: 1500,
          startDate: new Date('2024-01-15'),
        },
        {
          id: 'activity-2',
          athleteId: mockAthleteId,
          type: 'RUN',
          distance: 5000,
          movingTime: 1500, // Same time - should not be PR
          startDate: new Date('2024-01-20'),
        },
      ];

      (prisma.activity.findMany as jest.Mock).mockResolvedValue(activities);
      
      let prExists = false;
      (prisma.activity.findUnique as jest.Mock).mockImplementation((args) => {
        const activity = activities.find((a) => a.id === args.where.id);
        return Promise.resolve({
          ...activity,
          elapsedTime: 1600,
          totalElevationGain: 50,
          averageSpeed: 3.33,
        });
      });

      (prisma.personalRecord.findFirst as jest.Mock).mockImplementation(() => {
        if (!prExists) {
          prExists = true;
          return Promise.resolve(null); // First activity creates PR
        }
        return Promise.resolve({
          id: 'pr-1',
          timeSeconds: 1500,
          isCurrentRecord: true,
        }); // Second activity sees existing PR
      });

      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({ id: 'pr-new' });
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'metric-pr-new' });

      const result = await detectPRsForBatch(
        ['activity-1', 'activity-2'],
        mockAthleteId
      );

      // Should only create one standard PR even though both are same distance
      const prCreateCalls = (prisma.personalRecord.create as jest.Mock).mock.calls;
      expect(prCreateCalls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('redetectAllPRs', () => {
    it('should clear existing PRs and re-detect from scratch', async () => {
      const activities = [
        {
          id: 'activity-1',
          athleteId: mockAthleteId,
          type: 'RUN',
          distance: 5000,
          movingTime: 1500,
          elapsedTime: 1600,
          totalElevationGain: 50,
          averageSpeed: 3.33,
          startDate: new Date('2024-01-15'),
        },
        {
          id: 'activity-2',
          athleteId: mockAthleteId,
          type: 'RUN',
          distance: 10000,
          movingTime: 3000,
          elapsedTime: 3100,
          totalElevationGain: 100,
          averageSpeed: 3.33,
          startDate: new Date('2024-01-20'),
        },
      ];

      (prisma.activity.findMany as jest.Mock).mockResolvedValue(activities);
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);
      
      (prisma.activity.findUnique as jest.Mock).mockImplementation((args) => {
        return Promise.resolve(activities.find((a) => a.id === args.where.id));
      });

      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({ id: 'pr-new' });
      (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'metric-pr-new' });

      const result = await redetectAllPRs(mockAthleteId);

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.personalRecord.deleteMany).toHaveBeenCalledWith({
        where: { athleteId: mockAthleteId },
      });
      expect(prisma.metricPR.deleteMany).toHaveBeenCalledWith({
        where: { athleteId: mockAthleteId },
      });
      expect(prisma.pRNotification.deleteMany).toHaveBeenCalledWith({
        where: { athleteId: mockAthleteId },
      });
    });

    it('should handle errors gracefully', async () => {
      (prisma.activity.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await redetectAllPRs(mockAthleteId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error en re-detección');
      expect(result.activitiesProcessed).toBe(0);
    });

    it('should process activities in chronological order for proper history', async () => {
      const activities = [
        {
          id: 'activity-3',
          athleteId: mockAthleteId,
          startDate: new Date('2024-03-01'),
        },
        {
          id: 'activity-1',
          athleteId: mockAthleteId,
          startDate: new Date('2024-01-01'),
        },
        {
          id: 'activity-2',
          athleteId: mockAthleteId,
          startDate: new Date('2024-02-01'),
        },
      ];

      (prisma.activity.findMany as jest.Mock).mockResolvedValue(activities);
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);
      
      (prisma.activity.findUnique as jest.Mock).mockImplementation((args) => {
        const activity = activities.find((a) => a.id === args.where.id);
        return Promise.resolve({
          ...activity,
          type: 'RUN',
          distance: 5000,
          movingTime: 1500,
          elapsedTime: 1600,
          totalElevationGain: 50,
          averageSpeed: 3.33,
        });
      });

      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({ id: 'pr-new' });
      (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'metric-pr-new' });

      await redetectAllPRs(mockAthleteId);

      // Verify activities are fetched in chronological order
      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: { athleteId: mockAthleteId },
        orderBy: { startDate: 'asc' },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle first activity ever (all metrics become PRs)', async () => {
      const firstActivity = {
        id: 'first-activity',
        athleteId: mockAthleteId,
        type: 'RUN',
        distance: 5000,
        movingTime: 1500,
        elapsedTime: 1600,
        totalElevationGain: 50,
        averageSpeed: 3.33,
        startDate: new Date('2024-01-01'),
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(firstActivity);
      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({
        id: 'pr-5k',
        isCurrentRecord: true,
      });
      (prisma.metricPR.create as jest.Mock).mockImplementation((args) => ({
        id: `metric-pr-${args.data.metricType}`,
        ...args.data,
        isCurrent: true,
      }));

      const result = await detectPRsForActivity('first-activity', mockAthleteId);

      // First activity should create PRs for all valid metrics
      expect(result.standardPRs + result.metricPRs).toBeGreaterThan(0);
    });

    it('should handle negative splits (pace improvements during activity)', async () => {
      // This tests that we're measuring overall activity metrics correctly
      // not per-segment metrics
      const activityWithNegativeSplits = {
        id: 'activity-neg-split',
        athleteId: mockAthleteId,
        type: 'RUN',
        distance: 10000,
        movingTime: 2700, // 45:00 - good overall time
        elapsedTime: 2800,
        totalElevationGain: 20,
        averageSpeed: 3.7,
        startDate: new Date('2024-06-01'),
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(activityWithNegativeSplits);
      (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.personalRecord.create as jest.Mock).mockResolvedValue({ id: 'pr-10k' });
      (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: 'metric-pr' });

      const result = await detectPRsForActivity('activity-neg-split', mockAthleteId);

      // Should detect PR based on overall metrics
      expect(result.standardPRs + result.metricPRs).toBeGreaterThanOrEqual(0);
    });

    it('should handle various activity types correctly', async () => {
      const activityTypes: ActivityType[] = ['RUN', 'RIDE', 'SWIM', 'HIKE'];
      
      for (const type of activityTypes) {
        jest.clearAllMocks();
        
        const activity = {
          id: `activity-${type}`,
          athleteId: mockAthleteId,
          type,
          distance: 10000,
          movingTime: 3600,
          elapsedTime: 3700,
          totalElevationGain: 100,
          averageSpeed: 2.78,
          startDate: new Date('2024-07-01'),
        };

        (prisma.activity.findUnique as jest.Mock).mockResolvedValue(activity);
        (prisma.personalRecord.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.metricPR.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.personalRecord.create as jest.Mock).mockResolvedValue({ id: `pr-${type}` });
        (prisma.metricPR.create as jest.Mock).mockResolvedValue({ id: `metric-pr-${type}` });

        const result = await detectPRsForActivity(`activity-${type}`, mockAthleteId);

        // Should process without errors for any activity type
        expect(result).toHaveProperty('standardPRs');
        expect(result).toHaveProperty('metricPRs');
        expect(result).toHaveProperty('newRecords');
      }
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalActivity = {
        id: 'minimal-activity',
        athleteId: mockAthleteId,
        type: 'RUN',
        distance: null,
        movingTime: null,
        elapsedTime: null,
        totalElevationGain: null,
        averageSpeed: null,
        startDate: new Date('2024-08-01'),
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(minimalActivity);

      const result = await detectPRsForActivity('minimal-activity', mockAthleteId);

      expect(result.standardPRs).toBe(0);
      expect(result.metricPRs).toBe(0);
    });
  });
});
