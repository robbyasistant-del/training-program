/**
 * React Hooks for Personal Records Data
 *
 * Provides hooks for fetching and managing personal records data
 * using React Query for caching and state management.
 */

'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  FormattedPersonalRecord,
  StandardDistanceLabel,
  PRHistoryEntry,
} from '@/types/personalRecord';
import { FormattedMetricPR, MetricType, ActivityType, PRNotification } from '@/types/metricPR';

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutos
const RETRY_COUNT = 2;

// ============================================================================
// Query Keys
// ============================================================================

export const prKeys = {
  all: ['personalRecords'] as const,
  standard: (athleteId: string | null) => [...prKeys.all, 'standard', athleteId] as const,
  standardHistory: (athleteId: string | null, distanceLabel?: StandardDistanceLabel) =>
    [...prKeys.all, 'standardHistory', athleteId, distanceLabel] as const,
  metric: (athleteId: string | null, activityType?: ActivityType, metricType?: MetricType) =>
    [...prKeys.all, 'metric', athleteId, activityType, metricType] as const,
  metricHistory: (athleteId: string | null, activityType: ActivityType, metricType: MetricType) =>
    [...prKeys.all, 'metricHistory', athleteId, activityType, metricType] as const,
  notifications: (athleteId: string | null) => [...prKeys.all, 'notifications', athleteId] as const,
};

// ============================================================================
// Standard Distance PR Hooks
// ============================================================================

interface UsePersonalRecordsReturn {
  records: FormattedPersonalRecord[];
  count: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook para obtener los récords personales actuales (distancias estándar)
 * @param athleteId - ID del atleta
 */
export function usePersonalRecords(athleteId: string | null): UsePersonalRecordsReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: prKeys.standard(athleteId),
    queryFn: async (): Promise<{
      records: FormattedPersonalRecord[];
      count: number;
    }> => {
      if (!athleteId) {
        throw new Error('No athlete ID provided');
      }

      const response = await fetch(`/api/athletes/${athleteId}/personal-records`, {
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
        throw new Error('Error al cargar récords personales');
      }

      return response.json();
    },
    enabled: !!athleteId,
    staleTime: STALE_TIME_MS,
    retry: RETRY_COUNT,
  });

  const handleRefetch = () => {
    queryClient.invalidateQueries({
      queryKey: prKeys.standard(athleteId),
    });
    refetch();
  };

  return {
    records: data?.records ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: handleRefetch,
  };
}

interface UsePRHistoryReturn {
  history: FormattedPersonalRecord[];
  count: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para obtener el historial de récords para una distancia específica
 * @param athleteId - ID del atleta
 * @param distanceLabel - Etiqueta de distancia (opcional, si no se especifica devuelve todas)
 */
export function usePRHistory(
  athleteId: string | null,
  distanceLabel?: StandardDistanceLabel
): UsePRHistoryReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: prKeys.standardHistory(athleteId, distanceLabel),
    queryFn: async (): Promise<{
      history: FormattedPersonalRecord[];
      count: number;
    }> => {
      if (!athleteId) {
        throw new Error('No athlete ID provided');
      }

      const params = new URLSearchParams();
      if (distanceLabel) {
        params.append('distanceLabel', distanceLabel);
      }

      const response = await fetch(
        `/api/athletes/${athleteId}/personal-records/history?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al cargar historial de récords');
      }

      const result = await response.json();

      // Si se especificó una distancia, devolver directamente
      if (distanceLabel) {
        return {
          history: result.history,
          count: result.count,
        };
      }

      // Si no, combinar todas las distancias
      const allHistory =
        result.distances?.flatMap((d: { history: FormattedPersonalRecord[] }) => d.history) ?? [];
      return {
        history: allHistory,
        count: result.totalCount,
      };
    },
    enabled: !!athleteId,
    staleTime: STALE_TIME_MS,
    retry: RETRY_COUNT,
  });

  return {
    history: data?.history ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}

// ============================================================================
// Metric-based PR Hooks
// ============================================================================

interface MetricPRData {
  records: FormattedMetricPR[];
  grouped: Record<ActivityType, Record<MetricType, FormattedMetricPR[]>>;
  count: number;
}

interface UseMetricPRsReturn {
  records: FormattedMetricPR[];
  grouped: Record<ActivityType, Record<MetricType, FormattedMetricPR[]>>;
  count: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook para obtener los récords personales basados en métricas
 * @param athleteId - ID del atleta
 * @param activityType - Filtrar por tipo de actividad (opcional)
 * @param metricType - Filtrar por tipo de métrica (opcional)
 */
export function useMetricPRs(
  athleteId: string | null,
  activityType?: ActivityType,
  metricType?: MetricType
): UseMetricPRsReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: prKeys.metric(athleteId, activityType, metricType),
    queryFn: async (): Promise<MetricPRData> => {
      if (!athleteId) {
        throw new Error('No athlete ID provided');
      }

      const params = new URLSearchParams();
      if (activityType) {
        params.append('activityType', activityType);
      }
      if (metricType) {
        params.append('metricType', metricType);
      }

      const response = await fetch(`/api/athletes/${athleteId}/metric-prs?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar récords de métricas');
      }

      return response.json();
    },
    enabled: !!athleteId,
    staleTime: STALE_TIME_MS,
    retry: RETRY_COUNT,
  });

  const handleRefetch = () => {
    queryClient.invalidateQueries({
      queryKey: prKeys.metric(athleteId, activityType, metricType),
    });
    refetch();
  };

  return {
    records: data?.records ?? [],
    grouped: data?.grouped ?? ({} as Record<ActivityType, Record<MetricType, FormattedMetricPR[]>>),
    count: data?.count ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: handleRefetch,
  };
}

interface UseMetricPRHistoryReturn {
  history: FormattedMetricPR[];
  count: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para obtener el historial de un récord de métrica específico
 * @param athleteId - ID del atleta
 * @param activityType - Tipo de actividad
 * @param metricType - Tipo de métrica
 */
export function useMetricPRHistory(
  athleteId: string | null,
  activityType: ActivityType,
  metricType: MetricType
): UseMetricPRHistoryReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: prKeys.metricHistory(athleteId, activityType, metricType),
    queryFn: async (): Promise<{
      history: FormattedMetricPR[];
      count: number;
    }> => {
      if (!athleteId) {
        throw new Error('No athlete ID provided');
      }

      const params = new URLSearchParams({
        activityType,
        metricType,
      });

      const response = await fetch(
        `/api/athletes/${athleteId}/metric-prs/history?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al cargar historial de métrica');
      }

      const result = await response.json();
      return {
        history: result.history,
        count: result.count,
      };
    },
    enabled: !!athleteId,
    staleTime: STALE_TIME_MS,
    retry: RETRY_COUNT,
  });

  return {
    history: data?.history ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}

// ============================================================================
// PR Notifications Hooks
// ============================================================================

interface PRNotificationWithRecord {
  id: string;
  metricType: MetricType;
  record: FormattedMetricPR;
  createdAt: string;
}

interface UsePRNotificationsReturn {
  notifications: PRNotificationWithRecord[];
  count: number;
  isLoading: boolean;
  error: string | null;
  markAsSeen: (notificationIds: string[]) => void;
  markAllAsSeen: () => void;
}

/**
 * Hook para obtener y gestionar notificaciones de PRs
 * Incluye polling automático cada 5 segundos
 * @param athleteId - ID del atleta
 */
export function usePRNotifications(athleteId: string | null): UsePRNotificationsReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: prKeys.notifications(athleteId),
    queryFn: async (): Promise<{
      notifications: PRNotificationWithRecord[];
      count: number;
    }> => {
      if (!athleteId) {
        throw new Error('No athlete ID provided');
      }

      const response = await fetch(`/api/athletes/${athleteId}/notifications`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar notificaciones');
      }

      return response.json();
    },
    enabled: !!athleteId,
    refetchInterval: 5000, // Poll every 5 seconds for new notifications
    staleTime: 0, // Always fetch fresh notifications
    retry: RETRY_COUNT,
  });

  const markAsSeenMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!athleteId) throw new Error('No athlete ID provided');

      const response = await fetch(`/api/athletes/${athleteId}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds }),
      });

      if (!response.ok) {
        throw new Error('Error al marcar notificaciones como leídas');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: prKeys.notifications(athleteId),
      });
    },
  });

  const markAsSeen = (notificationIds: string[]) => {
    if (notificationIds.length > 0) {
      markAsSeenMutation.mutate(notificationIds);
    }
  };

  const markAllAsSeen = () => {
    const allIds = data?.notifications.map((n) => n.id) ?? [];
    if (allIds.length > 0) {
      markAsSeenMutation.mutate(allIds);
    }
  };

  return {
    notifications: data?.notifications ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
    markAsSeen,
    markAllAsSeen,
  };
}

// ============================================================================
// Summary Stats Hooks
// ============================================================================

interface PRStats {
  totalPRs: number;
  thisMonth: number;
  thisYear: number;
  byActivityType: Record<string, number>;
  byMetricType: Record<string, number>;
  averageImprovement: number;
}

interface UsePRStatsReturn {
  stats: PRStats | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para obtener estadísticas resumidas de PRs
 * @param athleteId - ID del atleta
 */
export function usePRStats(athleteId: string | null): UsePRStatsReturn {
  const { records, isLoading, error } = useMetricPRs(athleteId);

  if (!records || isLoading || error) {
    return {
      stats: null,
      isLoading,
      error: error || null,
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // records already destructured from useMetricPRs

  // Calculate stats
  const thisMonth = records.filter((r) => new Date(r.recordDate) >= startOfMonth).length;

  const thisYear = records.filter((r) => new Date(r.recordDate) >= startOfYear).length;

  const byActivityType = records.reduce(
    (acc, r) => {
      acc[r.activityType] = (acc[r.activityType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const byMetricType = records.reduce(
    (acc, r) => {
      acc[r.metricType] = (acc[r.metricType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const recordsWithImprovement = records.filter((r) => r.improvementPercent !== null);
  const averageImprovement =
    recordsWithImprovement.length > 0
      ? recordsWithImprovement.reduce((sum, r) => sum + (r.improvementPercent || 0), 0) /
        recordsWithImprovement.length
      : 0;

  return {
    stats: {
      totalPRs: records.length,
      thisMonth,
      thisYear,
      byActivityType,
      byMetricType,
      averageImprovement,
    },
    isLoading: false,
    error: null,
  };
}
