'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SyncStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  total: number;
  message: string;
}

export interface SyncState {
  isRunning: boolean;
  stages: SyncStage[];
  currentStage: string | null;
  overallProgress: number;
  errors: string[];
  lastSyncAt: Date | null;
}

export function useSync(athleteId: string | null) {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [needsSync, setNeedsSync] = useState<boolean>(false);
  const [syncReason, setSyncReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Verificar estado de sincronización
  const checkSyncStatus = useCallback(async () => {
    if (!athleteId) return;

    try {
      const response = await fetch(`/api/sync/start?athleteId=${athleteId}`);
      if (response.ok) {
        const data = await response.json();
        setNeedsSync(data.needsSync);
        setSyncReason(data.reason);
        setSyncState(data.state);
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  // Iniciar sincronización delta (rápida)
  const startSync = useCallback(async () => {
    if (!athleteId) return;

    try {
      const response = await fetch(`/api/sync/start?athleteId=${athleteId}&mode=delta`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSyncState(data.state);
        setNeedsSync(false);
        return true;
      }
    } catch (error) {
      console.error('Error starting sync:', error);
    }
    return false;
  }, [athleteId]);

  // Iniciar sincronización completa (histórico)
  const startFullSync = useCallback(async () => {
    if (!athleteId) return;

    try {
      const response = await fetch(`/api/sync/start?athleteId=${athleteId}&mode=full`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSyncState(data.state);
        setNeedsSync(false);
        return true;
      }
    } catch (error) {
      console.error('Error starting full sync:', error);
    }
    return false;
  }, [athleteId]);

  // Polling del estado durante sincronización
  useEffect(() => {
    if (!athleteId) return;

    // Verificar estado inicial
    checkSyncStatus();

    // Si hay una sincronización en curso, hacer polling
    if (syncState?.isRunning) {
      const interval = setInterval(() => {
        checkSyncStatus();
      }, 2000); // Cada 2 segundos

      return () => clearInterval(interval);
    }
  }, [athleteId, syncState?.isRunning, checkSyncStatus]);

  return {
    syncState,
    needsSync,
    syncReason,
    isLoading,
    startSync,
    startFullSync,
    checkSyncStatus,
  };
}
