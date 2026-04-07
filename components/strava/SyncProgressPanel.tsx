'use client';

import { useEffect, useState } from 'react';

interface SyncStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  startedAt: string | null;
  completedAt: string | null;
  estimatedCompletion: string | null;
  errors: string | null;
  type: string;
}

interface SyncProgressPanelProps {
  syncId: string | null;
  onComplete?: () => void;
  onError?: () => void;
}

/**
 * Panel de progreso de sincronización
 * Hace polling cada 2s al endpoint de status
 * Muestra barra de progreso visual con mensajes dinámicos
 */
export function SyncProgressPanel({ syncId, onComplete, onError }: SyncProgressPanelProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!syncId) return;

    let intervalId: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/sync/status/${syncId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch sync status');
        }

        const data: SyncStatus = await response.json();
        setStatus(data);

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalId) clearInterval(intervalId);

          if (data.status === 'completed') {
            onComplete?.();
          } else {
            onError?.();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // Start polling immediately and every 2 seconds
    fetchStatus();
    intervalId = setInterval(fetchStatus, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncId, onComplete, onError]);

  if (!syncId) return null;

  const getMessage = () => {
    if (!status) return 'Iniciando sincronización...';

    switch (status.status) {
      case 'pending':
        return 'Conectando con Strava...';
      case 'running':
        return `Importando actividades (${status.progress.current}/${status.progress.total})...`;
      case 'completed':
        return `¡Sincronización completada! ${status.progress.current} actividades importadas.`;
      case 'failed':
        return 'Error de sincronización';
      default:
        return 'Procesando...';
    }
  };

  const getStatusColor = () => {
    if (!status) return 'bg-gray-400';

    switch (status.status) {
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Sincronización de Actividades</h3>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm text-gray-600">{getMessage()}</p>
          </div>

          {status && (
            <>
              <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>{status.progress.percentage}%</span>
                <span>
                  {status.progress.current} de {status.progress.total} actividades
                </span>
              </div>

              <div className="mb-4 h-3 w-full rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${getStatusColor()}`}
                  style={{ width: `${status.progress.percentage}%` }}
                />
              </div>

              {status.estimatedCompletion && status.status === 'running' && (
                <p className="text-xs text-gray-500">
                  Tiempo estimado: {new Date(status.estimatedCompletion).toLocaleTimeString()}
                </p>
              )}

              {status.status === 'completed' && (
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

              {status.status === 'failed' && status.errors && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{status.errors}</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
