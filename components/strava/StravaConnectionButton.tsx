'use client';

import { useStravaAuth } from './useStravaAuth';

interface StravaConnectionButtonProps {
  redirectUrl?: string;
}

/**
 * StravaConnectionButton
 * Componente para conectar/desconectar cuenta de Strava
 * Muestra diferentes estados: conectar, conectando, conectado, error
 */
export function StravaConnectionButton({ redirectUrl }: StravaConnectionButtonProps) {
  const { state, connect, disconnect } = useStravaAuth(redirectUrl);

  // Estado: Cargando
  if (state.isLoading) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500"
      >
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Verificando...
      </button>
    );
  }

  // Estado: Error
  if (state.error) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={connect}
          className="inline-flex items-center gap-2 rounded-lg bg-[#FC4C02] px-4 py-2 text-sm font-medium text-white hover:bg-[#e04402]"
        >
          <StravaLogo className="h-4 w-4" />
          Conectar con Strava
        </button>
        <span className="text-xs text-red-500">{state.error}</span>
      </div>
    );
  }

  // Estado: Conectado
  if (state.isConnected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <StravaLogo className="h-5 w-5 text-[#FC4C02]" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-green-800">
              {state.athleteName || 'Cuenta conectada'}
            </span>
            {state.lastSync && (
              <span className="text-xs text-green-600">
                Última sync: {state.lastSync.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={disconnect}
          className="ml-auto text-xs text-red-600 hover:text-red-800 hover:underline"
        >
          Desconectar
        </button>
      </div>
    );
  }

  // Estado: Desconectado (default)
  return (
    <button
      onClick={connect}
      className="inline-flex items-center gap-2 rounded-lg bg-[#FC4C02] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e04402]"
    >
      <StravaLogo className="h-4 w-4" />
      Conectar con Strava
    </button>
  );
}

/**
 * Logo de Strava (SVG)
 */
function StravaLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L8.423 0 2.5 12.343h4.172" />
    </svg>
  );
}
