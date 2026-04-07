'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { SyncProgressCard } from '@/components/strava/SyncProgressCard';

/**
 * Página de sincronización inicial
 * Experiencia de onboarding para nuevos usuarios conectando Strava
 * Muestra progreso detallado de importación de datos
 */
export default function SyncPage() {
  const router = useRouter();
  const [syncId, setSyncId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startSync = useCallback(async () => {
    try {
      setIsStarting(true);
      setError(null);

      // Primero sincronizar el perfil
      const profileResponse = await fetch('/api/athlete/sync-profile', {
        method: 'POST',
      });

      if (!profileResponse.ok) {
        throw new Error('Error al sincronizar el perfil');
      }

      // Luego iniciar sincronización de actividades
      const activitiesResponse = await fetch('/api/athlete/sync-activities', {
        method: 'POST',
      });

      if (!activitiesResponse.ok) {
        throw new Error('Error al iniciar sincronización de actividades');
      }

      const data = await activitiesResponse.json();
      setSyncId(data.syncId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setIsStarting(false);
    }
  }, []);

  // Iniciar sincronización automáticamente al cargar la página
  useEffect(() => {
    startSync();
  }, [startSync]);

  const handleComplete = () => {
    // Redirigir al perfil después de completar
    setTimeout(() => {
      router.push('/profile');
    }, 2000);
  };

  const handleRetry = () => {
    setError(null);
    setSyncId(null);
    startSync();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#FC4C02]">
          <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L8.423 0 2.5 12.343h4.172" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Conectando con Strava</h1>
        <p className="mt-2 text-gray-600">Estamos importando tu perfil y actividades históricas</p>
      </div>

      {/* Loading State */}
      {isStarting && !syncId && !error && (
        <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#FC4C02]" />
            <p className="mt-4 text-gray-600">Iniciando sincronización...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Error de sincronización</h3>
            <p className="mb-6 text-gray-600">{error}</p>
            <button
              onClick={handleRetry}
              className="rounded-lg bg-[#FC4C02] px-6 py-2 font-medium text-white transition-colors hover:bg-[#e04402]"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Progress Card */}
      {!isStarting && syncId && !error && (
        <SyncProgressCard
          syncId={syncId}
          onComplete={handleComplete}
          onError={() => setError('La sincronización falló. Por favor, inténtalo de nuevo.')}
        />
      )}

      {/* Footer Info */}
      <div className="mt-8 max-w-lg text-center text-sm text-gray-500">
        <p>
          Esta operación puede tardar varios minutos dependiendo de la cantidad de actividades en tu
          cuenta.
        </p>
        <p className="mt-2">
          Tu información está segura y solo se utilizará para mostrar tus estadísticas de
          entrenamiento.
        </p>
      </div>
    </div>
  );
}
