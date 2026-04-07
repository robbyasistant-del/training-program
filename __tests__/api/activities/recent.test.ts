/**
 * Tests for /api/activities/recent endpoint
 */

import { NextRequest } from 'next/server';

// Importar y re-mockear para cada test
let GET: typeof import('@/app/api/activities/recent/route').GET;
let prisma: typeof import('@/lib/db').prisma;
let getRecentActivities: jest.Mock;

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    athlete: {
      findUnique: jest.fn(),
    },
    activity: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock Strava fetch service
jest.mock('@/lib/strava/fetchActivities', () => ({
  getRecentActivities: jest.fn(),
}));

describe('/api/activities/recent', () => {
  const mockAthlete = {
    id: 'athlete-123',
    stravaId: BigInt(123456),
  };

  const mockStravaActivities = [
    {
      id: '123456789',
      name: 'Morning Run',
      type: 'Run',
      startDate: '2024-01-15T07:30:00Z',
      duration: 3600,
      distance: 10500,
      elevationGain: 150,
      averageSpeed: 2.9,
      maxSpeed: 3.5,
      calories: 650,
    },
    {
      id: '123456790',
      name: 'Evening Ride',
      type: 'Ride',
      startDate: '2024-01-14T18:00:00Z',
      duration: 5400,
      distance: 25000,
      elevationGain: 200,
      averageSpeed: 4.6,
    },
  ];

  const mockDBActivities = [
    {
      id: 'db-1',
      stravaActivityId: BigInt(987654321),
      name: 'DB Morning Run',
      type: 'RUN',
      startDate: new Date('2024-01-15T07:30:00Z'),
      movingTime: 3600,
      distance: 10500,
      totalElevationGain: 150,
      averageSpeed: 2.9,
      maxSpeed: 3.5,
      averageHeartrate: 145,
      maxHeartrate: 175,
    },
  ];

  const createMockRequest = (queryParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:4004/api/activities/recent');
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return {
      url: url.toString(),
    } as unknown as NextRequest;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Re-importar el módulo para obtener una instancia fresca con cache limpio
    jest.resetModules();
    const route = await import('@/app/api/activities/recent/route');
    GET = route.GET;

    const db = await import('@/lib/db');
    prisma = db.prisma;

    const fetchActivities = await import('@/lib/strava/fetchActivities');
    getRecentActivities = fetchActivities.getRecentActivities as jest.Mock;
  });

  describe('GET', () => {
    it('should return 400 if athleteId is missing', async () => {
      const request = createMockRequest({});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('athleteId es requerido');
    });

    it('should return 400 if limit is invalid', async () => {
      const request = createMockRequest({
        athleteId: 'athlete-123',
        limit: 'invalid',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('limit debe ser un número positivo');
    });

    it('should return 404 if athlete not found', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({ athleteId: 'non-existent' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Atleta no encontrado');
    });

    it('should return activities from Strava API (auto mode)', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (getRecentActivities as jest.Mock).mockResolvedValue(mockStravaActivities);
      (prisma.activity.count as jest.Mock).mockResolvedValue(42);

      const request = createMockRequest({
        athleteId: 'athlete-123',
        limit: '10',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activities).toHaveLength(2);
      expect(data.activities[0].name).toBe('Morning Run');
      expect(data.activities[0].type).toBe('Run');
      expect(data.totalCount).toBe(42);
      expect(data.source).toBe('strava');
      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(response.headers.get('X-Source')).toBe('strava');
    });

    it('should return activities from DB when Strava fails (auto mode)', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (getRecentActivities as jest.Mock).mockRejectedValue(new Error('Rate limit'));
      (prisma.activity.findMany as jest.Mock).mockResolvedValue(mockDBActivities);
      (prisma.activity.count as jest.Mock).mockResolvedValue(10);

      const request = createMockRequest({
        athleteId: 'athlete-123',
        source: 'auto',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activities).toHaveLength(1);
      expect(data.activities[0].name).toBe('DB Morning Run');
      expect(data.activities[0].type).toBe('Run');
      expect(data.source).toBe('db');
    });

    it('should return 503 when source=strava and Strava API fails', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (getRecentActivities as jest.Mock).mockRejectedValue(new Error('Rate limit exceeded'));

      const request = createMockRequest({
        athleteId: 'athlete-123',
        source: 'strava',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Strava API no disponible');
    });

    it('should return activities from DB when source=db', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (prisma.activity.findMany as jest.Mock).mockResolvedValue(mockDBActivities);
      (prisma.activity.count as jest.Mock).mockResolvedValue(10);

      const request = createMockRequest({
        athleteId: 'athlete-123',
        source: 'db',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activities[0].name).toBe('DB Morning Run');
      expect(data.source).toBe('db');
      expect(getRecentActivities).not.toHaveBeenCalled();
    });

    it('should cap limit at 50', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (getRecentActivities as jest.Mock).mockResolvedValue([]);
      (prisma.activity.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest({
        athleteId: 'athlete-123',
        limit: '100',
      });

      await GET(request);

      expect(getRecentActivities).toHaveBeenCalledWith('athlete-123', 50, true);
    });

    it('should return 400 when limit is 0 or negative', async () => {
      const request = createMockRequest({
        athleteId: 'athlete-123',
        limit: '0',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('limit debe ser un número positivo');
    });

    it('should include response time header', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (getRecentActivities as jest.Mock).mockResolvedValue(mockStravaActivities);
      (prisma.activity.count as jest.Mock).mockResolvedValue(42);

      const request = createMockRequest({ athleteId: 'athlete-123' });

      const response = await GET(request);
      const responseTime = response.headers.get('X-Response-Time');

      expect(responseTime).toBeTruthy();
      expect(responseTime).toMatch(/\d+ms/);
    });

    it('should map DB activity types correctly', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (prisma.activity.findMany as jest.Mock).mockResolvedValue([
        { ...mockDBActivities[0], type: 'RIDE' },
        { ...mockDBActivities[0], type: 'SWIM', name: 'Swim Session' },
        { ...mockDBActivities[0], type: 'UNKNOWN_TYPE', name: 'Unknown' },
      ]);
      (prisma.activity.count as jest.Mock).mockResolvedValue(3);

      const request = createMockRequest({
        athleteId: 'athlete-123',
        source: 'db',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.activities[0].type).toBe('Ride');
      expect(data.activities[1].type).toBe('Swim');
      expect(data.activities[2].type).toBe('Workout'); // fallback
    });

    it('should handle optional fields in DB activities', async () => {
      (prisma.athlete.findUnique as jest.Mock).mockResolvedValue(mockAthlete);
      (prisma.activity.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockDBActivities[0],
          maxSpeed: null,
          averageHeartrate: null,
          maxHeartrate: null,
        },
      ]);
      (prisma.activity.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest({
        athleteId: 'athlete-123',
        source: 'db',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.activities[0].maxSpeed).toBeUndefined();
      expect(data.activities[0].averageHeartrate).toBeUndefined();
      expect(data.activities[0].maxHeartrate).toBeUndefined();
    });

    it('should return 503 on database error', async () => {
      const dbError = new Error('prisma error: DB connection failed');
      (prisma.athlete.findUnique as jest.Mock).mockRejectedValue(dbError);

      const request = createMockRequest({ athleteId: 'athlete-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Error de base de datos al obtener actividades');
    });
  });
});
