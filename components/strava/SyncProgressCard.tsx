'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface SyncProgressCardProps {
  syncId: string | null;
  onComplete?: () => void;
  onError?: () => void;
}

interface SyncStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  processed: number;
  total: number;
  percentage: number;
  currentPage: number;
  completedAt: string | null;
  errors: string | null;
  type: string;
}

/**
 * Componente de tarjeta de progreso de sincronización
 * Muestra estados detallados, barra de progreso animada, y tiempo estimado restante
 */
export function SyncProgressCard({ syncId, onComplete, onError }: SyncProgressCardProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef<number>(Date.now());
  const [estimatedSecondsRemaining, setEstimatedSecondsRemaining] = useState<number>(0);

  const fetchStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/athlete/sync-status/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }

      const data: SyncStatus = await response.json();
      setStatus(data);

      // Calcular tiempo estimado restante
      if (data.status === 'running' && data.processed > 0) {
        const elapsedMs = Date.now() - startTime.current;
        const msPerItem = elapsedMs / data.processed;
        const remainingItems = data.total - data.processed;
        const estimatedRemainingMs = msPerItem * remainingItems;
        setEstimatedSecondsRemaining(Math.ceil(estimatedRemainingMs / 1000));
      }

      return data.status;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return 'failed';
    }
  }, []);

  useEffect(() => {
    if (!syncId) return;

    let intervalId: NodeJS.Timeout | null = null;

    const poll = async () => {
      const currentStatus = await fetchStatus(syncId);

      if (currentStatus === 'completed' || currentStatus === 'failed') {
        if (intervalId) clearInterval(intervalId);

        if (currentStatus === 'completed') {
          onComplete?.();
        } else {
          onError?.();
        }
      }
    };

    // Poll immediately and then every 2 seconds
    poll();
    intervalId = setInterval(poll, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncId, fetchStatus, onComplete, onError]);

  const getStatusMessage = () => {
    if (!status) return 'Conectando con Strava...';

    switch (status.status) {
      case 'pending':
        return 'Conectando con Strava...';
      case 'running':
        if (status.processed === 0) {
          return 'Descargando perfil del atleta...';
        } else if (status.processed < 10) {
          return 'Importando actividades iniciales...';
        } else {
          return `Importando actividades (${status.processed} de ${status.total})...`;
        }
      case 'completed':
        return '¡Sincronización completada! Procesando datos...';
      case 'failed':
        return 'Error durante la sincronización';
      default:
        return 'Procesando...';
    }
  };

  const getStatusIcon = () => {
    if (!status) {
      return (
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FC4C02]" />
      );
    }

    switch (status.status) {
      case 'pending':
      case 'running':
        return (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FC4C02]" />
        );
      case 'completed':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case 'failed':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-5 w-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        {getStatusIcon()}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sincronización de Datos</h3>
          <p className="text-sm text-gray-500">{getStatusMessage()}</p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
          <p className="font-medium">Error de conexión</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Progress Section */}
      {status && (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="relative">
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FC4C02] to-orange-400 transition-all duration-500 ease-out"
                style={{ width: `${status.percentage}%` }}
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{status.percentage}%</span>
              <span className="text-gray-500">completado</span>
            </div>
            <div className="text-gray-600">
              <span className="font-medium text-gray-900">{status.processed}</span>
              <span className="mx-1">de</span>
              <span className="font-medium text-gray-900">{status.total}</span>
              <span className="ml-1">actividades</span>
            </div>
          </div>

          {/* Time Remaining */}
          {status.status === 'running' && estimatedSecondsRemaining > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                Tiempo estimado restante:{' '}
                <span className="font-medium text-gray-700">
                  {formatTimeRemaining(estimatedSecondsRemaining)}
                </span>
              </span>
            </div>
          )}

          {/* Current Page */}
          {status.status === 'running' && status.currentPage > 0 && (
            <div className="text-xs text-gray-400">Importando página {status.currentPage}...</div>
          )}
        </div>
      )}

      {/* Completed State */}
      {status?.status === 'completed' && (
        <div className="mt-6 rounded-lg bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">¡Sincronización completada!</span>
          </div>
          <p className="mt-1 text-sm text-green-600">
            Se importaron {status.processed} actividades exitosamente.
          </p>
        </div>
      )}

      {/* Failed State */}
      {status?.status === 'failed' && (
        <div className="mt-6 rounded-lg bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">Error durante la sincronización</span>
          </div>
          {status.errors && <p className="mt-1 text-sm text-red-600">{status.errors}</p>}
        </div>
      )}

      {/* Tips */}
      {status?.status === 'running' && (
        <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
          <p className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Puedes cerrar esta ventana y volver más tarde. La sincronización continuará en segundo
              plano.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
