/**
 * Tests de integración para sincronización de actividades de Strava
 * Valida: importación masiva, detección de duplicados, rate limiting, progreso, logs
 */

import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    activity: {
      upsert: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    athlete: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    syncLog: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

// Mock Strava API Service
jest.mock('@/lib/strava/api-service', () => ({
  fetchActivitiesPage: jest.fn(),
  getAthleteProfile: jest.fn(),
}));

import { fetchActivitiesPage, getAthleteProfile } from '@/lib/strava/api-service';
import { syncActivitiesWithProgress, getSyncProgress, syncProfile, checkForDuplicates } from '@/lib/strava/sync-service';

const mockFetchActivitiesPage = fetchActivitiesPage as jest.MockedFunction<typeof fetchActivitiesPage>;
const mockGetAthleteProfile = getAthleteProfile as jest.MockedFunction<typeof getAthleteProfile>;
const mockPrismaActivityUpsert = prisma.activity.upsert as jest.Mock;
const mockPrismaActivityCount = prisma.activity.count as jest.Mock;
const mockPrismaSyncLogCreate = prisma.syncLog.create as jest.Mock;
const mockPrismaSyncLogUpdate = prisma.syncLog.update as jest.Mock;
const mockPrismaSyncLogFindUnique = prisma.syncLog.findUnique as jest.Mock;
const mockPrismaAthleteUpdate = prisma.athlete.update as jest.Mock;

describe('Sync Activities - 200+ Activities Validation', () => {
  const mockAthleteId = 'athlete-test-123';
  const mockSyncLogId = 'sync-log-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Importación masiva de 200+ actividades', () => {
    it('should sync exactly 200 activities in batches', async () => {
      // Generate 200 mock activities
      const mockActivities = generateMockActivities(200);
      
      // Mock 2 pages: 100 + 100
      mockFetchActivitiesPage
        .mockResolvedValueOnce({ activities: mockActivities.slice(0, 100), hasMore: true })
        .mockResolvedValueOnce({ activities: mockActivities.slice(100, 200), hasMore: false });

      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      const result = await syncActivitiesWithProgress(mockAthleteId, 200);

      expect(result.imported).toBe(200);
      expect(mockFetchActivitiesPage).toHaveBeenCalledTimes(2);
      expect(mockPrismaActivityUpsert).toHaveBeenCalledTimes(200);
    }, 30000); // 30 second timeout

    it('should sync 250 activities but stop at limit', async () => {
      const mockActivities = generateMockActivities(250);
      
      mockFetchActivitiesPage
        .mockResolvedValueOnce({ activities: mockActivities.slice(0, 100), hasMore: true })
        .mockResolvedValueOnce({ activities: mockActivities.slice(100, 200), hasMore: true })
        .mockResolvedValueOnce({ activities: mockActivities.slice(200, 250), hasMore: false });

      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      const result = await syncActivitiesWithProgress(mockAthleteId, 200);

      // Should stop at 200 due to limit
      expect(result.imported).toBe(200);
    }, 30000);

    it('should handle empty activity list gracefully', async () => {
      // Reset mocks to clear any previous implementations
      mockFetchActivitiesPage.mockReset();
      mockPrismaSyncLogCreate.mockReset();
      mockPrismaSyncLogUpdate.mockReset();
      mockPrismaActivityUpsert.mockReset();
      
      mockFetchActivitiesPage.mockResolvedValue({ activities: [], hasMore: false });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      const result = await syncActivitiesWithProgress(mockAthleteId, 200);

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('2. Detección y prevención de duplicados', () => {
    it('should use upsert to prevent duplicates by stravaActivityId', async () => {
      jest.clearAllMocks();
      const mockActivities = generateMockActivities(1);
      
      mockFetchActivitiesPage.mockResolvedValue({ 
        activities: mockActivities, 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 200);

      // Verify upsert was called (duplicate prevention via stravaActivityId)
      expect(mockPrismaActivityUpsert).toHaveBeenCalled();
      const call = mockPrismaActivityUpsert.mock.calls[0][0];
      expect(call.where.stravaActivityId).toBeDefined();
      expect(call.create).toBeDefined();
      expect(call.update).toBeDefined();
    });

    it('should process same activities multiple times with upsert', async () => {
      jest.clearAllMocks();
      const mockActivities = generateMockActivities(50);
      
      mockFetchActivitiesPage
        .mockResolvedValueOnce({ activities: mockActivities, hasMore: false })
        .mockResolvedValueOnce({ activities: mockActivities, hasMore: false });
        
      mockPrismaSyncLogCreate
        .mockResolvedValueOnce({ id: 'sync-1' })
        .mockResolvedValueOnce({ id: 'sync-2' });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      // First sync
      const result1 = await syncActivitiesWithProgress(mockAthleteId, 200);
      expect(result1.imported).toBe(50);

      // Second sync - should also process activities (upsert handles duplicates in DB)
      const result2 = await syncActivitiesWithProgress(mockAthleteId, 200);
      expect(result2.imported).toBe(50);

      // Total 100 upserts (50 each sync)
      expect(mockPrismaActivityUpsert).toHaveBeenCalledTimes(100);
    }, 30000);

    it('should update existing activity on duplicate detection', async () => {
      const mockActivity = {
        ...generateMockActivities(1)[0],
        name: 'Updated Activity Name',
      };
      
      mockFetchActivitiesPage.mockResolvedValueOnce({ 
        activities: [mockActivity], 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 200);

      const upsertCall = mockPrismaActivityUpsert.mock.calls[0][0];
      expect(upsertCall.update.name).toBe(mockActivity.name);
    });
  });

  describe('3. Rate Limiting (100 req / 15 min)', () => {
    it('should make multiple API requests for pagination', async () => {
      mockFetchActivitiesPage
        .mockResolvedValueOnce({ activities: generateMockActivities(100), hasMore: true })
        .mockResolvedValueOnce({ activities: generateMockActivities(50), hasMore: false });

      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 150);

      // Should make 2 API calls for pagination
      expect(mockFetchActivitiesPage).toHaveBeenCalledTimes(2);
    }, 30000);

    it('should handle API errors gracefully', async () => {
      mockFetchActivitiesPage
        .mockRejectedValueOnce(new Error('API Error'));

      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});

      await expect(syncActivitiesWithProgress(mockAthleteId, 200)).rejects.toThrow('API Error');
    });
  });

  describe('4. Seguimiento de progreso', () => {
    it('should create sync log entry with correct initial state', async () => {
      mockFetchActivitiesPage.mockResolvedValue({ 
        activities: generateMockActivities(50), 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 200);

      expect(mockPrismaSyncLogCreate).toHaveBeenCalledWith({
        data: {
          athleteId: mockAthleteId,
          type: 'activities',
          status: 'running',
          totalRecords: 200,
          recordsProcessed: 0,
        },
      });
    });

    it('should update progress after processing', async () => {
      mockFetchActivitiesPage
        .mockResolvedValueOnce({ activities: generateMockActivities(100), hasMore: true })
        .mockResolvedValueOnce({ activities: generateMockActivities(100), hasMore: false });

      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 200);

      // Should update progress
      const progressUpdates = mockPrismaSyncLogUpdate.mock.calls.filter(
        call => call[0].data.recordsProcessed !== undefined
      );
      expect(progressUpdates.length).toBeGreaterThanOrEqual(1);
    }, 30000);

    it('should mark sync as completed when finished', async () => {
      mockFetchActivitiesPage.mockResolvedValue({ 
        activities: generateMockActivities(50), 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 200);

      const completedCall = mockPrismaSyncLogUpdate.mock.calls.find(
        call => call[0].data.status === 'completed'
      );
      expect(completedCall).toBeDefined();
      expect(completedCall[0].data.completedAt).toBeDefined();
    });
  });

  describe('5. Logs de sincronización', () => {
    it('should continue processing when individual activity fails', async () => {
      const mockActivities = generateMockActivities(5);

      mockFetchActivitiesPage.mockResolvedValueOnce({ 
        activities: mockActivities, 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      
      // Make upsert fail for one activity
      mockPrismaActivityUpsert
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Invalid activity data'))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await syncActivitiesWithProgress(mockAthleteId, 200);

      // Should continue processing other activities
      expect(result.imported).toBe(4);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should record final state in sync log', async () => {
      mockFetchActivitiesPage.mockResolvedValue({ 
        activities: generateMockActivities(100), 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 200);

      const finalUpdate = mockPrismaSyncLogUpdate.mock.calls[
        mockPrismaSyncLogUpdate.mock.calls.length - 1
      ];
      expect(finalUpdate[0].data.status).toBe('completed');
      expect(finalUpdate[0].data.recordsProcessed).toBe(100);
    });
  });

  describe('6. Sincronización de perfil del atleta', () => {
    it('should sync athlete profile data correctly', async () => {
      const mockProfile = {
        id: 12345,
        firstname: 'John',
        lastname: 'Doe',
        profile: 'https://example.com/profile.jpg',
        city: 'Madrid',
        country: 'Spain',
        sex: 'M',
        weight: 75.5,
      };

      mockGetAthleteProfile.mockResolvedValue(mockProfile);
      mockPrismaAthleteUpdate.mockResolvedValue({});

      await syncProfile(mockAthleteId);

      expect(mockPrismaAthleteUpdate).toHaveBeenCalledWith({
        where: { id: mockAthleteId },
        data: expect.objectContaining({
          firstname: 'John',
          lastname: 'Doe',
          city: 'Madrid',
          country: 'Spain',
          weight: 75.5,
        }),
      });
    });
  });

  describe('7. Validación de datos', () => {
    it('should handle null values in optional fields', async () => {
      const invalidActivity = generateMockActivities(1)[0];
      invalidActivity.distance = null as any;
      invalidActivity.moving_time = null as any;

      mockFetchActivitiesPage.mockResolvedValueOnce({ 
        activities: [invalidActivity], 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      const result = await syncActivitiesWithProgress(mockAthleteId, 200);

      // Should handle nulls gracefully
      expect(result.imported).toBe(1);
      const upsertCall = mockPrismaActivityUpsert.mock.calls[0][0];
      expect(upsertCall.create.distance).toBeNull();
    });

    it('should map Strava activity types to enum correctly', async () => {
      const mockActivities = [
        { ...generateMockActivities(1)[0], type: 'Run' },
        { ...generateMockActivities(1)[0], type: 'Ride' },
        { ...generateMockActivities(1)[0], type: 'Swim' },
      ];

      mockFetchActivitiesPage.mockResolvedValueOnce({ 
        activities: mockActivities, 
        hasMore: false 
      });
      mockPrismaSyncLogCreate.mockResolvedValue({ id: mockSyncLogId });
      mockPrismaSyncLogUpdate.mockResolvedValue({});
      mockPrismaActivityUpsert.mockResolvedValue({});

      await syncActivitiesWithProgress(mockAthleteId, 200);

      const calls = mockPrismaActivityUpsert.mock.calls;
      expect(calls[0][0].create.type).toBe('RUN');
      expect(calls[1][0].create.type).toBe('RIDE');
      expect(calls[2][0].create.type).toBe('SWIM');
    });
  });

  describe('8. getSyncProgress', () => {
    it('should return correct progress percentage', async () => {
      mockPrismaSyncLogFindUnique.mockResolvedValue({
        id: mockSyncLogId,
        status: 'running',
        totalRecords: 200,
        recordsProcessed: 100,
        startedAt: new Date(),
      });

      const progress = await getSyncProgress(mockSyncLogId);

      expect(progress.percentage).toBe(50);
      expect(progress.processed).toBe(100);
      expect(progress.total).toBe(200);
    });

    it('should throw error when sync log not found', async () => {
      mockPrismaSyncLogFindUnique.mockResolvedValue(null);

      await expect(getSyncProgress('non-existent')).rejects.toThrow('Sync log not found');
    });
  });

  describe('9. checkForDuplicates', () => {
    it('should return 0 when no duplicates exist', async () => {
      const { prisma: mockPrisma } = require('@/lib/db');
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);

      const duplicates = await checkForDuplicates(mockAthleteId);

      expect(duplicates).toBe(0);
    });
  });
});

// Helper function to generate mock Strava activities
function generateMockActivities(count: number): Array<{
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
}> {
  const types = ['Run', 'Ride', 'Swim', 'Hike', 'Walk'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: 1000000000 + i,
    name: `Activity ${i + 1}`,
    distance: 5000 + Math.random() * 15000,
    moving_time: 1800 + Math.floor(Math.random() * 3600),
    elapsed_time: 2000 + Math.floor(Math.random() * 4000),
    total_elevation_gain: 50 + Math.random() * 200,
    type: types[Math.floor(Math.random() * types.length)],
    start_date: new Date(Date.now() - i * 86400000).toISOString(),
    average_speed: 2.5 + Math.random() * 2,
    max_speed: 4 + Math.random() * 3,
    has_heartrate: Math.random() > 0.3,
    average_heartrate: Math.random() > 0.3 ? 140 + Math.floor(Math.random() * 40) : undefined,
    max_heartrate: Math.random() > 0.3 ? 160 + Math.floor(Math.random() * 40) : undefined,
  }));
}
