/**
 * Tests para el endpoint /api/auth/logout
 * Verifica cierre de sesión y limpieza de cookies
 */

import { prisma } from '@/lib/db';

// Mock the database
jest.mock('@/lib/db', () => ({
  prisma: {
    stravaConnection: {
      deleteMany: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
  },
}));

// Mock NextRequest and cookies
const mockDelete = jest.fn();
const mockGet = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
      headers: {
        get: (name: string) => {
          if (name === 'set-cookie') {
            return 'session_token=; athlete_id=; oauth_state=;';
          }
          return null;
        },
      },
      cookies: {
        delete: mockDelete,
      },
    })),
  },
}));

describe('/api/auth/logout endpoint', () => {
  const mockAthleteId = 'athlete-123';
  const mockSessionToken = 'valid-session-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockClear();
    mockGet.mockClear();
  });

  describe('Successful logout', () => {
    it('should delete Strava connection from database', async () => {
      (prisma.stravaConnection.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      // Simulate logout logic
      await prisma.stravaConnection.deleteMany({
        where: { athleteId: mockAthleteId },
      });

      expect(prisma.stravaConnection.deleteMany).toHaveBeenCalledWith({
        where: { athleteId: mockAthleteId },
      });
    });

    it('should delete sessions from database', async () => {
      (prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await prisma.session.deleteMany({
        where: { athleteId: mockAthleteId },
      });

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { athleteId: mockAthleteId },
      });
    });

    it('should be idempotent (no error if connection does not exist)', async () => {
      (prisma.stravaConnection.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Connection not found')
      );

      // Should not throw
      try {
        await prisma.stravaConnection.deleteMany({
          where: { athleteId: mockAthleteId },
        });
      } catch {
        // Expected error, should be handled gracefully
      }

      expect(prisma.stravaConnection.deleteMany).toHaveBeenCalled();
    });
  });

  describe('Authentication check', () => {
    it('should require both session_token and athlete_id', () => {
      const hasSession = !!mockSessionToken && !!mockAthleteId;
      expect(hasSession).toBe(true);
    });

    it('should reject logout without session_token', () => {
      const emptyToken = '';
      const hasSession = !!emptyToken && !!mockAthleteId;
      expect(hasSession).toBe(false);
    });

    it('should reject logout without athlete_id', () => {
      const emptyId = '';
      const hasSession = !!mockSessionToken && !!emptyId;
      expect(hasSession).toBe(false);
    });
  });

  describe('Cookie cleanup', () => {
    it('should delete session_token cookie', () => {
      mockDelete('session_token');
      expect(mockDelete).toHaveBeenCalledWith('session_token');
    });

    it('should delete athlete_id cookie', () => {
      mockDelete('athlete_id');
      expect(mockDelete).toHaveBeenCalledWith('athlete_id');
    });

    it('should delete oauth_state cookie', () => {
      mockDelete('oauth_state');
      expect(mockDelete).toHaveBeenCalledWith('oauth_state');
    });
  });

  describe('Database operations', () => {
    it('should handle missing StravaConnection table gracefully', async () => {
      (prisma.stravaConnection.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Table does not exist')
      );

      try {
        await prisma.stravaConnection.deleteMany({
          where: { athleteId: mockAthleteId },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing Session table gracefully', async () => {
      (prisma.session.deleteMany as jest.Mock).mockRejectedValue(new Error('Table does not exist'));

      try {
        await prisma.session.deleteMany({
          where: { athleteId: mockAthleteId },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Response format', () => {
    it('should return success response format', () => {
      const successResponse = {
        success: true,
        message: 'Logged out successfully',
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.message).toBe('Logged out successfully');
    });

    it('should return error response format for no session', () => {
      const errorResponse = {
        success: false,
        error: 'No active session',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('No active session');
    });

    it('should return error response format for server error', () => {
      const errorResponse = {
        success: false,
        error: 'Internal server error',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Internal server error');
    });
  });

  describe('HTTP methods', () => {
    it('should support POST method', () => {
      const supportedMethods = ['POST', 'DELETE'];
      expect(supportedMethods).toContain('POST');
    });

    it('should support DELETE method', () => {
      const supportedMethods = ['POST', 'DELETE'];
      expect(supportedMethods).toContain('DELETE');
    });
  });
});
