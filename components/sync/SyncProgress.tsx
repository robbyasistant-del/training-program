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
}

interface SyncProgressProps {
  syncJobId: string | null;
  onComplete?: () => void;
  onError?: () => void;
  pollInterval?: number; // milliseconds, default: 2000
}

/**
 * Componente UI de progreso de sincronización
 * Muestra barra de progreso, contador de actividades y estado visual
 * Hace polling cada 2 segundos al endpoint de progreso
 */
export function SyncProgress({
  syncJobId,
  onComplete,
  onError,
  pollInterval = 2000,
}: SyncProgressProps) {
  const [data, setData] = useState<SyncProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!syncJobId) return;

    try {
      const response = await fetch(`/api/activities/sync/${syncJobId}/progress`);

      if (!response.ok) {
        throw new Error('Failed to fetch sync progress');
      }

      const progressData: SyncProgressData = await response.json();
      setData(progressData);

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

              {data.status === 'running' && data.estimatedSecondsRemaining !== null && (
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
 * Hook para usar el progreso de sincronización
 */
export function useSyncProgress(syncJobId: string | null) {
  const [data, setData] = useState<SyncProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { data, isLoading, error };
}
