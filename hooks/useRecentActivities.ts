'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Activity, RecentActivitiesResponse } from '@/types/activity';

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutos
const RETRY_COUNT = 2;

interface UseRecentActivitiesReturn {
  activities: Activity[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  source: 'strava' | 'db' | 'cache' | undefined;
  responseTime: number | undefined;
}

/**
 * React Query key factory para actividades
 */
export const activitiesKeys = {
  all: ['activities'] as const,
  recent: (athleteId: string | null, limit: number) =>
    [...activitiesKeys.all, 'recent', athleteId, limit] as const,
};

/**
 * Hook para obtener las actividades recientes del atleta usando React Query
 *
 * Características:
 * - Cache de 5 minutos (staleTime)
 * - Retry automático (2 intentos)
 * - Refetch manual disponible
 * - Manejo de errores tipado
 *
 * @param athleteId - ID del atleta
 * @param limit - Número de actividades a obtener (default: 10)
 * @returns Objeto con actividades, estado de carga y error
 */
export function useRecentActivities(
  athleteId: string | null,
  limit: number = 10
): UseRecentActivitiesReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: activitiesKeys.recent(athleteId, limit),
    queryFn: async (): Promise<
      RecentActivitiesResponse & { source?: 'strava' | 'db' | 'cache'; responseTime?: number }
    > => {
      if (!athleteId) {
        throw new Error('No athlete ID provided');
      }

      const response = await fetch(`/api/activities/recent?athleteId=${athleteId}&limit=${limit}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
        if (response.status === 404) {
          throw new Error('Atleta no encontrado.');
        }
        if (response.status === 503) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || 'Servicio temporalmente no disponible. Intenta más tarde.'
          );
        }
        throw new Error('Error al cargar actividades recientes');
      }

      return response.json();
    },
    enabled: !!athleteId,
    staleTime: STALE_TIME_MS,
    retry: RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const handleRefetch = () => {
    // Invalida el cache de React Query y fuerza refetch
    queryClient.invalidateQueries({
      queryKey: activitiesKeys.recent(athleteId, limit),
    });
    refetch();
  };

  return {
    activities: data?.activities ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: handleRefetch,
    source: data?.source,
    responseTime: data?.responseTime,
  };
}
