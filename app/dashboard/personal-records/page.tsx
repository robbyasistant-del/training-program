'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, TrendingUp, History, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SyncProgressModal } from '@/components/strava/SyncProgressModal';

interface DistancePR {
  distance: number;
  label: string;
  bestTime: number | null;
  bestPace: number | null;
  date: string | null;
  activityId: string | null;
}

interface PRData {
  distancePRs: DistancePR[];
  lastSyncAt: string | null;
  needsSync: boolean;
}

const DISTANCES = [
  { distance: 1000, label: '1 km' },
  { distance: 5000, label: '5 km' },
  { distance: 10000, label: '10 km' },
  { distance: 15000, label: '15 km' },
  { distance: 21097.5, label: 'Media Maratón' },
  { distance: 42195, label: 'Maratón' },
];

export default function PersonalRecordsPage() {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [data, setData] = useState<PRData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('athlete_id='));
    if (cookie) {
      const id = cookie.split('=')[1];
      if (id) {
        setAthleteId(id);
      } else {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const fetchPRs = async () => {
    if (!athleteId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/athletes/${athleteId}/records?period=365`);
      if (response.ok) {
        const result = await response.json();
        setData({
          distancePRs: result.distancePRs,
          lastSyncAt: result.lastSyncAt,
          needsSync: result.needsSync,
        });
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, [athleteId]);

  const handleSyncComplete = () => {
    fetchPRs();
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace: number | null) => {
    if (pace === null) return '--:--';
    const m = Math.floor(pace / 60);
    const s = Math.floor(pace % 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  };

  const getPRFreshness = (date: string | null) => {
    if (!date) return { color: 'text-zinc-500', bg: 'bg-zinc-800', border: 'border-zinc-700' };
    const prDate = new Date(date);
    const daysSince = (Date.now() - prDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSince <= 7) return { color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30', label: '¡Nuevo!' };
    if (daysSince <= 30) return { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', label: 'Reciente' };
    return { color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700', label: '' };
  };

  const prCount = data?.distancePRs.filter(pr => pr.bestTime !== null).length || 0;
  const lastPR = data?.distancePRs
    .filter(pr => pr.date !== null)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())[0];

  if (!athleteId || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-[#FC4C02]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Récords Personales</h1>
            <p className="text-zinc-400">Tus mejores tiempos en distancias estándar</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {data?.needsSync && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-yellow-500">Datos desactualizados</span>
            </div>
          )}
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FC4C02] text-white font-medium hover:bg-[#e04402] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </button>
        </div>
      </div>

      {/* Info de sincronización */}
      {data?.lastSyncAt && (
        <div className="text-sm text-zinc-500 mb-6">
          Última sincronización: {new Date(data.lastSyncAt).toLocaleString('es-ES')}
        </div>
      )}

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList className="bg-zinc-800 border-zinc-700">
          <TabsTrigger value="current" className="data-[state=active]:bg-zinc-700">
            <Trophy className="h-4 w-4 mr-2" />
            Récords Actuales
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-zinc-700">
            <History className="h-4 w-4 mr-2" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Current Records Tab */}
        <TabsContent value="current" className="space-y-6">
          {/* Tabla de PRs */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Mejores Tiempos por Distancia</CardTitle>
              <CardDescription className="text-zinc-400">
                Datos sincronizados desde Strava
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.distancePRs.map((pr) => {
                  const freshness = getPRFreshness(pr.date);
                  return (
                    <div
                      key={pr.distance}
                      className={`flex items-center justify-between p-4 rounded-lg border ${freshness.border} ${freshness.bg} transition-colors`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-white w-28">{pr.label}</span>
                        <div>
                          <p className="text-xl font-bold text-white">{formatTime(pr.bestTime)}</p>
                          <p className="text-xs text-zinc-500">{formatPace(pr.bestPace)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {freshness.label && (
                          <span className={`text-xs font-medium ${freshness.color} block mb-1`}>{freshness.label}</span>
                        )}
                        {pr.date && (
                          <p className="text-xs text-zinc-600">
                            {new Date(pr.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">Distancias Cubiertas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{prCount}</p>
                <p className="text-xs text-zinc-500 mt-1">De 6 distancias estándar</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">Total Récords</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{prCount}</p>
                <p className="text-xs text-zinc-500 mt-1">Histórico acumulado</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">Último Récord</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">
                  {lastPR?.date 
                    ? new Date(lastPR.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                    : '--'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {lastPR?.label || 'Sin récords'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Evolución de Récords
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Historial de tus récords personales por distancia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-500 text-center py-8">
                El historial detallado se mostrará aquí próximamente.
                <br />
                Actualmente mostrando tus mejores tiempos actuales.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 mt-8">
        <CardHeader>
          <CardTitle className="text-sm text-zinc-400">¿Cómo se detectan los récords?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-zinc-500 space-y-2">
            <li>• Las actividades se sincronizan desde Strava y se almacenan en la base de datos local</li>
            <li>• Se comparan con distancias estándar (1K, 5K, 10K, 15K, Media Maratón, Maratón)</li>
            <li>• Se permite una tolerancia de ±2% para compensar variaciones GPS</li>
            <li>• Se considera PR si el tiempo es mejor que el récord anterior para esa distancia</li>
            <li>• Se recomienda sincronizar al menos cada 24 horas para mantener los datos actualizados</li>
          </ul>
        </CardContent>
      </Card>

      <SyncProgressModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onComplete={handleSyncComplete}
      />
    </div>
  );
}
