'use client';

import { useEffect, useState, useCallback } from 'react';

interface SyncProgressData {
  syncJobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: string;
  progress: {
    percentage: number;
    processed: number;
    total: number;
    currentPage: number;
  };
  timestamps: {
    startedAt: string | null;
    completedAt: string | null;
  };
  estimatedCompletion: string | null;
  estimatedSecondsRemaining: number | null;
  error: string | null;
  rateLimitInfo?: {
    isThrottled: boolean;
    waitTimeRemaining: number;
    usage: number;
    limit: number;
  };
}

interface SyncProgressWithRateLimitProps {
  syncJobId: string | null;
  onComplete?: () => void;
  onError?: () => void;
  pollInterval?: number;
}

/**
 * Componente UI de progreso de sincronización con manejo de rate limits
 * Muestra barra de progreso, contador de actividades, estado visual
 * e indica específicamente cuando está pausado por rate limiting de Strava
 * Hace polling cada 2 segundos al endpoint de progreso
 */
export function SyncProgressWithRateLimit({
  syncJobId,
  onComplete,
  onError,
  pollInterval = 2000,
}: SyncProgressWithRateLimitProps) {
  const [data, setData] = useState<SyncProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!syncJobId) return;

    try {
      const response = await fetch(`/api/activities/sync/${syncJobId}/progress`);

      if (!response.ok) {
        throw new Error('Failed to fetch sync progress');
      }

      const progressData: SyncProgressData = await response.json();
      setData(progressData);

      // Update rate limit countdown if throttled
      if (progressData.rateLimitInfo?.isThrottled) {
        setRateLimitCountdown(progressData.rateLimitInfo.waitTimeRemaining);
      } else {
        setRateLimitCountdown(null);
      }

      // Call callbacks based on status
      if (progressData.status === 'completed') {
        onComplete?.();
      } else if (progressData.status === 'failed') {
        onError?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [syncJobId, onComplete, onError]);

  // Countdown timer for rate limit
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;

    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  useEffect(() => {
    if (!syncJobId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Fetch immediately
    fetchProgress();
    setIsLoading(false);

    // Set up polling
    const intervalId = setInterval(fetchProgress, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [syncJobId, pollInterval, fetchProgress]);

  if (!syncJobId) return null;

  const getStatusMessage = () => {
    if (isLoading) return 'Iniciando sincronización...';
    if (!data) return 'Cargando...';

    // Show rate limit message when throttled
    if (data.rateLimitInfo?.isThrottled || rateLimitCountdown !== null) {
      return '⏸️ Pausado: esperando rate limit de Strava...';
    }

    switch (data.status) {
      case 'pending':
        return 'Preparando sincronización...';
      case 'running':
        if (data.type === 'profile') {
          return 'Sincronizando perfil...';
        }
        return `Sincronizando actividades (${data.progress.processed}/${data.progress.total})...`;
      case 'completed':
        return `¡Sincronización completada! ${data.progress.processed} registros procesados.`;
      case 'failed':
        return 'Error de sincronización';
      default:
        return 'Procesando...';
    }
  };

  const getStatusColor = () => {
    if (!data) return 'bg-gray-400';

    // Yellow when rate limited
    if (data.rateLimitInfo?.isThrottled || rateLimitCountdown !== null) {
      return 'bg-yellow-500';
    }

    switch (data.status) {
      case 'pending':
        return 'bg-yellow-400';
      case 'running':
        return 'bg-[#FC4C02]';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatTimeRemaining = (seconds: number | null): string => {
    if (seconds === null) return '';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Sincronización de Datos</h3>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm text-gray-600">{getStatusMessage()}</p>
            {data?.type && (
              <p className="mt-1 text-xs text-gray-500">
                Tipo:{' '}
                {data.type === 'full'
                  ? 'Completa'
                  : data.type === 'profile'
                    ? 'Perfil'
                    : 'Actividades'}
              </p>
            )}
          </div>

          {data && (
            <>
              <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>{data.progress.percentage}%</span>
                <span>
                  {data.progress.processed} de {data.progress.total}
                </span>
              </div>

              <div className="mb-4 h-3 w-full rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${getStatusColor()}`}
                  style={{ width: `${data.progress.percentage}%` }}
                />
              </div>

              {/* Rate limit countdown */}
              {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
                <div className="mb-4 rounded-lg bg-yellow-50 p-3">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <svg
                      className="h-5 w-5 animate-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      Esperando rate limit de Strava... {formatCountdown(rateLimitCountdown)}
                    </span>
                  </div>
                  {data.rateLimitInfo && (
                    <p className="mt-1 text-xs text-yellow-600">
                      {data.rateLimitInfo.usage} / {data.rateLimitInfo.limit} requests usados
                    </p>
                  )}
                </div>
              )}

              {data.status === 'running' &&
                data.estimatedSecondsRemaining !== null &&
                rateLimitCountdown === null && (
                  <p className="text-xs text-gray-500">
                    Tiempo estimado restante: {formatTimeRemaining(data.estimatedSecondsRemaining)}
                  </p>
                )}

              {data.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium">Completado</span>
                </div>
              )}

              {data.status === 'failed' && data.error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{data.error}</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Hook para usar el progreso de sincronización con rate limit info
 */
export function useSyncProgressWithRateLimit(syncJobId: string | null) {
  const [data, setData] = useState<SyncProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    if (!syncJobId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/activities/sync/${syncJobId}/progress`);

        if (!response.ok) {
          throw new Error('Failed to fetch sync progress');
        }

        const progressData: SyncProgressData = await response.json();
        setData(progressData);
        setIsRateLimited(progressData.rateLimitInfo?.isThrottled || false);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchProgress();

    // Set up polling every 2 seconds
    const intervalId = setInterval(fetchProgress, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [syncJobId]);

  return { data, isLoading, error, isRateLimited };
}

// Re-export original component for backward compatibility
export { SyncProgress, useSyncProgress } from './SyncProgress';
