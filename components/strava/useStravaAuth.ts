'use client';

import { useState, useEffect, useCallback } from 'react';

interface StravaConnectionState {
  isConnected: boolean;
  isLoading: boolean;
  athleteName: string | null;
  lastSync: Date | null;
  error: string | null;
}

interface UseStravaAuthReturn {
  state: StravaConnectionState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook para manejar el estado de conexión con Strava
 * Proporciona estado de conexión, nombre del atleta y funciones para conectar/desconectar
 * @param redirectUrl - URL opcional para redirigir después de la conexión exitosa
 */
export function useStravaAuth(redirectUrl?: string): UseStravaAuthReturn {
  const [state, setState] = useState<StravaConnectionState>({
    isConnected: false,
    isLoading: true,
    athleteName: null,
    lastSync: null,
    error: null,
  });

  /**
   * Obtiene el estado actual de conexión desde el servidor
   */
  const refreshStatus = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/auth/strava/status');
      const data = await response.json();

      if (response.ok) {
        setState({
          isConnected: data.isConnected,
          isLoading: false,
          athleteName: data.athleteName || null,
          lastSync: data.lastSync ? new Date(data.lastSync) : null,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Error al verificar estado',
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Error de conexión',
      }));
    }
  }, []);

  /**
   * Inicia el flujo OAuth de Strava
   */
  const connect = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/strava/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUrl: redirectUrl || '/dashboard' }),
      });
      const data = await response.json();

      if (response.ok && data.authUrl) {
        // Redirigir a Strava para autorización
        window.location.href = data.authUrl;
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Error al iniciar conexión',
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Error al conectar con Strava',
      }));
    }
  }, [redirectUrl]);

  /**
   * Desconecta la cuenta de Strava
   */
  const disconnect = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/strava/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setState({
          isConnected: false,
          isLoading: false,
          athleteName: null,
          lastSync: null,
          error: null,
        });
      } else {
        const data = await response.json();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Error al desconectar',
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Error al desconectar de Strava',
      }));
    }
  }, []);

  // Verificar estado al montar el componente
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    state,
    connect,
    disconnect,
    refreshStatus,
  };
}
