/**
 * Tests for useRecentActivities hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useRecentActivities, activitiesKeys } from '@/hooks/useRecentActivities';

// Mock fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

const mockActivitiesResponse = {
  activities: [
    {
      id: '123456789',
      name: 'Morning Run',
      type: 'Run',
      startDate: '2024-01-15T07:30:00Z',
      duration: 3600,
      distance: 10500,
      elevationGain: 150,
      averageSpeed: 2.9,
    },
  ],
  totalCount: 10,
  source: 'strava',
  responseTime: 150,
};

describe('useRecentActivities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query keys', () => {
    it('should generate correct query keys', () => {
      expect(activitiesKeys.all).toEqual(['activities']);
      expect(activitiesKeys.recent('athlete-123', 10)).toEqual([
        'activities',
        'recent',
        'athlete-123',
        10,
      ]);
    });
  });

  describe('Successful fetch', () => {
    it('should return activities on successful fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivitiesResponse,
      });

      const { result } = renderHook(
        () => useRecentActivities('athlete-123', 10),
        { wrapper: createWrapper() }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.activities).toEqual([]);

      // Wait for data
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activities).toEqual(mockActivitiesResponse.activities);
      expect(result.current.totalCount).toBe(10);
      expect(result.current.error).toBeNull();
      expect(result.current.source).toBe('strava');
      expect(result.current.responseTime).toBe(150);
    });

    it('should not fetch when athleteId is null', async () => {
      const { result } = renderHook(() => useRecentActivities(null, 10), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle 401 error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(
        () => useRecentActivities('athlete-123', 10),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Sesión expirada. Por favor, inicia sesión nuevamente.');
    });

    it('should handle 404 error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(
        () => useRecentActivities('athlete-123', 10),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Atleta no encontrado.');
    });

    it('should handle 503 error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Strava API no disponible' }),
      });

      const { result } = renderHook(
        () => useRecentActivities('athlete-123', 10),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Strava API no disponible');
    });

    it('should handle generic error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(
        () => useRecentActivities('athlete-123', 10),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Error al cargar actividades recientes');
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(
        () => useRecentActivities('athlete-123', 10),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('Refetch', () => {
    it('should provide refetch function', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivitiesResponse,
      });

      const { result } = renderHook(
        () => useRecentActivities('athlete-123', 10),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('Request headers', () => {
    it('should include correct headers in request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivitiesResponse,
      });

      renderHook(() => useRecentActivities('athlete-123', 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/activities/recent?athleteId=athlete-123&limit=10',
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });
    });
  });
});
