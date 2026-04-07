'use client';

import { useSyncProgress } from './useSyncProgress';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

/**
 * Modal de progreso de sincronización
 * Muestra barra de progreso y contador de actividades
 */
export function SyncProgressModal({ isOpen, onClose, onComplete }: SyncProgressModalProps) {
  const { status, isLoading, error, startSync } = useSyncProgress();

  if (!isOpen) return null;

  const isComplete = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isRunning = status?.status === 'running' || status?.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Sincronización de Actividades</h2>

        {!status && !isLoading && (
          <div className="text-center">
            <p className="mb-4 text-gray-600">
              Esto importará tus actividades de Strava a la plataforma.
            </p>
            <button
              onClick={startSync}
              className="rounded-lg bg-[#FC4C02] px-6 py-2 font-medium text-white hover:bg-[#e04402]"
            >
              Iniciar Sincronización
            </button>
          </div>
        )}

        {isLoading && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FC4C02]"></div>
            <p className="text-gray-600">Iniciando sincronización...</p>
          </div>
        )}

        {isRunning && status && (
          <div>
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>
                {status.processed} de {status.total} actividades
              </span>
              <span>{status.percentage}%</span>
            </div>

            <div className="mb-4 h-4 w-full rounded-full bg-gray-200">
              <div
                className="h-4 rounded-full bg-[#FC4C02] transition-all duration-300"
                style={{ width: `${status.percentage}%` }}
              />
            </div>

            <p className="text-center text-sm text-gray-500">
              Importando página {status.currentPage}...
            </p>
          </div>
        )}

        {isComplete && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
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
            <p className="mb-4 text-gray-600">
              ¡Sincronización completada! {status?.processed} actividades importadas.
            </p>
            <button
              onClick={() => {
                onComplete?.();
                onClose();
              }}
              className="rounded-lg bg-gray-900 px-6 py-2 font-medium text-white hover:bg-gray-800"
            >
              Continuar
            </button>
          </div>
        )}

        {isFailed && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
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
            <p className="mb-2 text-red-600">Error de sincronización</p>
            {status?.errors && <p className="mb-4 text-sm text-gray-500">{status.errors}</p>}
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-900 px-6 py-2 font-medium text-white hover:bg-gray-800"
            >
              Cerrar
            </button>
          </div>
        )}

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {isRunning && (
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Continuar en segundo plano
          </button>
        )}
      </div>
    </div>
  );
}
