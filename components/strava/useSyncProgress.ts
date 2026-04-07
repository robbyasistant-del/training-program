'use client';

import { useState, useEffect, useCallback } from 'react';

interface SyncStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  processed: number;
  total: number;
  percentage: number;
  currentPage: number;
  completedAt: string | null;
  errors: string | null;
}

interface UseSyncProgressReturn {
  status: SyncStatus | null;
  isLoading: boolean;
  error: string | null;
  startSync: () => Promise<void>;
  syncId: string | null;
}

/**
 * Hook para monitorear el progreso de sincronización
 * Hace polling cada 2 segundos hasta que el sync se completa
 */
export function useSyncProgress(): UseSyncProgressReturn {
  const [syncId, setSyncId] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/athlete/sync-status/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }

      const data = await response.json();
      setStatus(data);

      return data.status;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return 'failed';
    }
  }, []);

  const startSync = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/athlete/sync-activities', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start sync');
      }

      const data = await response.json();
      setSyncId(data.syncId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (!syncId) return;

    let intervalId: NodeJS.Timeout | null = null;

    const poll = async () => {
      const currentStatus = await fetchStatus(syncId);

      if (currentStatus === 'completed' || currentStatus === 'failed') {
        if (intervalId) clearInterval(intervalId);
      }
    };

    // Poll immediately and then every 2 seconds
    poll();
    intervalId = setInterval(poll, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncId, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    startSync,
    syncId,
  };
}
