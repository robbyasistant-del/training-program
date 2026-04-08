'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Trophy, 
  Zap, 
  Timer, 
  TrendingUp, 
  Calendar,
  Activity,
  Flame,
  RefreshCw,
  AlertCircle,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SyncProgressModal } from '@/components/strava/SyncProgressModal';

// Tipos
interface DistancePR {
  distance: number;
  label: string;
  bestTime: number | null;
  bestPace: number | null;
  bestSpeed: number | null; // km/h
  date: string | null;
  activityId: string | null;
}

interface PowerPR {
  duration: number;
  label: string;
  power: number | null;
  wkg: number | null;
  date: string | null;
}

interface PowerCurve {
  durations: number[];
  powers: number[];
  wkgs: number[];
}

interface FTPData {
  estimatedFTP: number | null;
  wkg: number | null;
  method: string;
  date: string | null;
}

interface RecentBest {
  period: string;
  days: number;
  totalDistance: number;
  totalTime: number;
  totalElevation: number;
  avgPower: number | null;
  maxPower: number | null;
  activities: number;
}

interface RecordsData {
  distancePRs: DistancePR[];
  powerPRs: PowerPR[];
  powerCurve: PowerCurve;
  ftp: FTPData;
  recentBests: RecentBest[];
  lastSyncAt: string | null;
  needsSync: boolean;
  weight: number;
}

// Nuevas distancias: 5K, 10K, 20K, 30K, 40K, 50K, 75K, 100K
const DISTANCE_PRS = [
  { distance: 5000, label: '5 km' },
  { distance: 10000, label: '10 km' },
  { distance: 20000, label: '20 km' },
  { distance: 30000, label: '30 km' },
  { distance: 40000, label: '40 km' },
  { distance: 50000, label: '50 km' },
  { distance: 75000, label: '75 km' },
  { distance: 100000, label: '100 km' },
];

// Nuevas duraciones para power PRs
const POWER_PR_DURATIONS = [
  { duration: 5, label: '5 seg' },
  { duration: 15, label: '15 seg' },
  { duration: 30, label: '30 seg' },
  { duration: 60, label: '1 min' },
  { duration: 120, label: '2 min' },
  { duration: 180, label: '3 min' },
  { duration: 300, label: '5 min' },
  { duration: 480, label: '8 min' },
  { duration: 600, label: '10 min' },
  { duration: 900, label: '15 min' },
  { duration: 1200, label: '20 min' },
  { duration: 1800, label: '30 min' },
  { duration: 2700, label: '45 min' },
  { duration: 3600, label: '1 h' },
  { duration: 7200, label: '2 h' },
];

const RECENT_PERIODS = [
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '180 días', days: 180 },
  { label: '1 año', days: 365 },
];

export default function RecordsPage() {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [data, setData] = useState<RecordsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
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

  const fetchRecords = async () => {
    if (!athleteId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/athletes/${athleteId}/records?period=${selectedPeriod}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        console.error('Error fetching records');
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [athleteId, selectedPeriod]);

  const handleSyncComplete = () => {
    fetchRecords();
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

  const formatSpeed = (speed: number | null) => {
    if (speed === null) return '--';
    return `${speed.toFixed(1)} km/h`;
  };

  const getPRFreshness = (date: string | null) => {
    if (!date) return { color: 'text-zinc-500', bg: 'bg-zinc-800', border: 'border-zinc-700' };
    const prDate = new Date(date);
    const daysSince = (Date.now() - prDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSince <= 7) return { color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30', label: '¡Nuevo!' };
    if (daysSince <= 30) return { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', label: 'Reciente' };
    return { color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700', label: '' };
  };

  // Encontrar PRs específicos para las métricas destacadas
  const pr10k = data?.distancePRs.find(p => p.distance === 10000);
  const pr5min = data?.powerPRs.find(p => p.duration === 300);

  if (!athleteId || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-[#FC4C02]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Récords & Análisis</h1>
          <p className="mt-1 text-zinc-400">Tus mejores marcas y métricas de rendimiento</p>
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

      {/* Info de última sincronización */}
      {data?.lastSyncAt && (
        <div className="text-sm text-zinc-500">
          Última sincronización: {new Date(data.lastSyncAt).toLocaleString('es-ES')}
        </div>
      )}

      {/* Selector de período */}
      <div className="flex gap-2">
        {RECENT_PERIODS.map((period) => (
          <button
            key={period.days}
            onClick={() => setSelectedPeriod(period.days)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === period.days
                ? 'bg-[#FC4C02] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Métricas Destacadas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* FTP Estimado */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Gauge className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">FTP Estimado</p>
                <p className="text-2xl font-bold text-white">
                  {data?.ftp?.estimatedFTP ? `${Math.round(data.ftp.estimatedFTP)} W` : '--'}
                </p>
                {data?.ftp?.wkg && (
                  <p className="text-sm text-orange-400">{data.ftp.wkg.toFixed(2)} W/kg</p>
                )}
                <p className="text-xs text-zinc-600 mt-1">
                  {data?.ftp?.method || 'Sin datos'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mejor 10K */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Trophy className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Mejor 10K</p>
                <p className="text-2xl font-bold text-white">
                  {formatTime(pr10k?.bestTime || null)}
                </p>
                <p className="text-sm text-blue-400">
                  {formatSpeed(pr10k?.bestSpeed || null)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Potencia Máx (5min) */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Flame className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Potencia Máx (5min)</p>
                <p className="text-2xl font-bold text-white">
                  {pr5min?.power || '--'} W
                </p>
                <p className="text-sm text-green-400">
                  {pr5min?.wkg?.toFixed(2) || '--'} W/kg
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total actividades */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Total {selectedPeriod} días</p>
                <p className="text-2xl font-bold text-white">
                  {data?.recentBests.find(b => b.days === selectedPeriod)?.activities || 0} act
                </p>
                <p className="text-sm text-purple-400">
                  {((data?.recentBests.find(b => b.days === selectedPeriod)?.totalDistance || 0) / 1000).toFixed(0)} km
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mejores Tiempos por Distancia */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Mejores Tiempos por Distancia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.distancePRs.map((pr) => {
                const freshness = getPRFreshness(pr.date);
                return (
                  <div
                    key={pr.distance}
                    className={`flex items-center justify-between p-3 rounded-lg border ${freshness.border} ${freshness.bg} transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white w-20">{pr.label}</span>
                      <div>
                        <p className="text-lg font-bold text-white">{formatTime(pr.bestTime)}</p>
                        <p className="text-xs text-zinc-500">{formatSpeed(pr.bestSpeed)} • {formatPace(pr.bestPace)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {freshness.label && (
                        <span className={`text-xs font-medium ${freshness.color}`}>{freshness.label}</span>
                      )}
                      {pr.date && (
                        <p className="text-xs text-zinc-600">
                          {new Date(pr.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Mejores Potencias por Tiempo */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Zap className="h-5 w-5 text-orange-500" />
              Mejores Potencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {data?.powerPRs.map((pr) => (
                <div
                  key={pr.duration}
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950"
                >
                  <span className="text-sm font-medium text-white">{pr.label}</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{pr.power || '--'} W</p>
                    {pr.wkg && (
                      <p className="text-xs text-orange-400">{pr.wkg.toFixed(2)} W/kg</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Curva de Potencia */}
      {data?.powerCurve && data.powerCurve.powers.some(p => p !== null) && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Curva de Potencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PowerCurveChart data={data.powerCurve} weight={data.weight} />
          </CardContent>
        </Card>
      )}

      {/* Resumen por Período */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Calendar className="h-5 w-5 text-green-500" />
            Resumen de Entrenamiento ({selectedPeriod} días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const best = data?.recentBests.find(b => b.days === selectedPeriod);
            if (!best) return <p className="text-zinc-500">No hay datos</p>;
            
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                  <p className="text-sm text-zinc-500">Distancia Total</p>
                  <p className="text-2xl font-bold text-white">{(best.totalDistance / 1000).toFixed(1)} km</p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                  <p className="text-sm text-zinc-500">Tiempo Total</p>
                  <p className="text-2xl font-bold text-white">{Math.floor(best.totalTime / 3600)}h</p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                  <p className="text-sm text-zinc-500">Elevación</p>
                  <p className="text-2xl font-bold text-white">{best.totalElevation.toFixed(0)} m</p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800">
                  <p className="text-sm text-zinc-500">Potencia Media</p>
                  <p className="text-2xl font-bold text-white">{best.avgPower || '--'} W</p>
                </div>
              </div>
            );
          })()}
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

// Componente de Curva de Potencia
function PowerCurveChart({ data, weight }: { data: PowerCurve; weight: number }) {
  const validPowers = data.powers.filter((p): p is number => p !== null);
  const maxPower = validPowers.length > 0 ? Math.max(...validPowers) : 0;

  return (
    <div className="space-y-4">
      <div className="h-64 relative">
        <div className="absolute inset-0 flex items-end justify-between px-2">
          {data.durations.map((duration, i) => {
            const power = data.powers[i];
            if (!power) return null;
            const height = maxPower > 0 ? (power / maxPower) * 100 : 0;
            
            return (
              <div
                key={duration}
                className="flex flex-col items-center"
                style={{ width: `${100 / data.durations.length}%` }}
              >
                <div
                  className="w-full mx-0.5 bg-orange-500/80 rounded-t-sm relative group cursor-pointer hover:bg-orange-400 transition-colors"
                  style={{ height: `${Math.max(height, 5)}%` }}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {Math.round(power)} W ({(power / weight).toFixed(2)} W/kg)
                  </div>
                </div>
                <span className="text-xs text-zinc-500 mt-1">
                  {duration < 60 ? `${duration}s` : duration < 3600 ? `${Math.floor(duration / 60)}m` : `${Math.floor(duration / 3600)}h`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-sm text-zinc-500">
        <span>Potencia máxima: <strong className="text-orange-400">{Math.round(maxPower)} W</strong></span>
        <span>Peso: {weight} kg</span>
      </div>
    </div>
  );
}
