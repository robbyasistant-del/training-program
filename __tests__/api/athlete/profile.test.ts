/**
 * Tests for /api/athlete/profile endpoint
 */

import { NextRequest } from 'next/server';

import { GET } from '@/app/api/athlete/profile/route';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    athlete: {
      findUnique: jest.fn(),
    },
    stravaConnection: {
      findUnique: jest.fn(),
    },
    activity: {
      aggregate: jest.fn(),
    },
  },
}));

describe('/api/athlete/profile', () => {
  const mockAthlete = {
    id: 'athlete-123',
    stravaId: BigInt(123456),
    email: 'test@example.com',
    firstname: 'John',
    lastname: 'Doe',
    profileImage: 'https://example.com/avatar.jpg',
    city: 'Madrid',
    country: 'Spain',
    sex: 'M',
    weight: 70.5,
    lastSyncAt: new Date('2024-01-15'),
    syncStatus: 'completed',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    _count: {
      activities: 42,
    },
  };

  const createMockRequest = (cookies: Record<string, string> = {}) => {
    return {
      cookies: {
        get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
      },
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if no athlete_id cookie', async () => {
      const request = createMockRequest({});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 if athlete not found', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({ athlete_id: 'non-existent' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Athlete not found');
    });

    it('should return athlete profile with stats in < 100ms', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValue({
        expiresAt: new Date(Date.now() + 3600000),
        updatedAt: new Date(),
      });
      (prisma.activity.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          distance: 150000,
          movingTime: 18000,
        },
      });

      const request = createMockRequest({ athlete_id: 'athlete-123' });

      const startTime = Date.now();
      const response = await GET(request);
      const endTime = Date.now();

      const data = await response.json();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100);
      expect(data.id).toBe('athlete-123');
      expect(data.firstname).toBe('John');
      expect(data.lastname).toBe('Doe');
      expect(data.email).toBe('test@example.com');
      expect(data.profileImage).toBe('https://example.com/avatar.jpg');
      expect(data.city).toBe('Madrid');
      expect(data.country).toBe('Spain');
      expect(data.sex).toBe('M');
      expect(data.weight).toBe(70.5);
      expect(data.syncStatus).toBe('completed');
      expect(data.stats.totalActivities).toBe(42);
      expect(data.stats.totalDistance).toBe(150000);
      expect(data.stats.totalMovingTime).toBe(18000);
      expect(data.connection.isConnected).toBe(true);
    });

    it('should return isConnected=false when token expired', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValue({
        expiresAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(),
      });
      (prisma.activity.aggregate as jest.Mock).mockResolvedValue({
        _sum: { distance: 0, movingTime: 0 },
      });

      const request = createMockRequest({ athlete_id: 'athlete-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connection.isConnected).toBe(false);
    });

    it('should return isConnected=false when no Strava connection', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.activity.aggregate as jest.Mock).mockResolvedValue({
        _sum: { distance: 0, movingTime: 0 },
      });

      const request = createMockRequest({ athlete_id: 'athlete-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connection.isConnected).toBe(false);
    });

    it('should return 500 on database error', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

      const request = createMockRequest({ athlete_id: 'athlete-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('DB error');
    });

    it('should return stravaId as string', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (prisma.stravaConnection.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.activity.aggregate as jest.Mock).mockResolvedValue({
        _sum: { distance: 0, movingTime: 0 },
      });

      const request = createMockRequest({ athlete_id: 'athlete-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(typeof data.stravaId).toBe('string');
      expect(data.stravaId).toBe('123456');
    });
  });
});
