'use client';

import { useState } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, XCircle, Database } from 'lucide-react';
import { useSync } from '@/hooks/useSync';

interface SyncManagerProps {
  athleteId: string | null;
  onSyncComplete?: () => void;
}

export function SyncManager({ athleteId, onSyncComplete }: SyncManagerProps) {
  const { syncState, needsSync, syncReason, isLoading, startSync, startFullSync, checkSyncStatus } = useSync(athleteId);
  const [showDetails, setShowDetails] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleSync = async (mode: 'delta' | 'full' = 'delta') => {
    const success = mode === 'delta' ? await startSync() : await startFullSync();
    if (success && onSyncComplete) {
      // Esperar a que termine la sincronización
      const checkInterval = setInterval(async () => {
        await checkSyncStatus();
        if (!syncState?.isRunning) {
          clearInterval(checkInterval);
          onSyncComplete();
        }
      }, 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-[#FC4C02]" />
        <span className="text-sm">Verificando estado...</span>
      </div>
    );
  }

  // Mostrar alerta si necesita sincronización
  if (needsSync && !syncState?.isRunning) {
    return (
      <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-500">
                Datos desactualizados
              </p>
              <p className="text-xs text-yellow-500/80 mt-1">
                {syncReason}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSync('delta')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FC4C02] text-white text-sm font-medium hover:bg-[#e04402] transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar progreso durante sincronización
  if (syncState?.isRunning) {
    const currentStage = syncState.stages.find(s => s.id === syncState.currentStage);

    return (
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-blue-500">
              Sincronizando...
            </span>
          </div>
          <span className="text-sm text-blue-500">
            {syncState.overallProgress}%
          </span>
        </div>

        {/* Barra de progreso global */}
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${syncState.overallProgress}%` }}
          />
        </div>

        {/* Etapa actual */}
        {currentStage && (
          <div className="mb-3">
            <p className="text-sm text-blue-400">
              {currentStage.name}: {currentStage.message}
            </p>
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-blue-400 transition-all duration-500"
                style={{ 
                  width: currentStage.total > 0 
                    ? `${(currentStage.progress / currentStage.total) * 100}%` 
                    : '0%' 
                }}
              />
            </div>
          </div>
        )}

        {/* Detalles desplegables */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-zinc-500 hover:text-zinc-400"
        >
          {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-2">
            {syncState.stages.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {stage.status === 'completed' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {stage.status === 'running' && (
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
                  {stage.status === 'pending' && (
                    <div className="h-4 w-4 rounded-full border-2 border-zinc-600" />
                  )}
                  {stage.status === 'error' && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={
                    stage.status === 'completed' ? 'text-green-400' :
                    stage.status === 'running' ? 'text-blue-400' :
                    stage.status === 'error' ? 'text-red-400' :
                    'text-zinc-500'
                  }>
                    {stage.name}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {stage.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Estado: Datos actualizados
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-green-500">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm">Datos actualizados</span>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="ml-2 text-xs text-zinc-500 hover:text-white underline"
        >
          {showOptions ? 'Cancelar' : 'Sincronizar'}
        </button>
      </div>
      
      {showOptions && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => { handleSync('delta'); setShowOptions(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Solo novedades (rápido)
          </button>
          <button
            onClick={() => { handleSync('full'); setShowOptions(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
          >
            <Database className="h-3.5 w-3.5" />
            Completa (histórico)
          </button>
        </div>
      )}
    </div>
  );
}
