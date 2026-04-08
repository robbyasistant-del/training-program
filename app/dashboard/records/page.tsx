'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Trophy, 
  Zap, 
  TrendingUp, 
  Calendar,
  Activity,
  Flame,
  Gauge,
  Bike
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SyncManager } from '@/components/sync/SyncManager';
import { StravaConnectionButton } from '@/components/strava';

// Tipos
interface DistancePR {
  distance: number;
  label: string;
  bestTime: number | null;
  bestPace: number | null;
  bestSpeed: number | null;
  date: string | null;
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
  weight: number;
  recentBests: RecentBest[];
}

const RECENT_PERIODS = [
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '180 días', days: 180 },
  { label: '1 año', days: 365 },
];

// DISTANCIAS DE CICLISMO (no running)
const CYCLING_DISTANCES = [
  { distance: 5000, label: '5 km CRI' },
  { distance: 10000, label: '10 km CRI' },
  { distance: 20000, label: '20 km' },
  { distance: 30000, label: '30 km' },
  { distance: 50000, label: '50 km' },
  { distance: 75000, label: '75 km' },
  { distance: 90000, label: '90 km' },
  { distance: 100000, label: '100 km Century' },
];

export default function RecordsPage() {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [data, setData] = useState<RecordsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

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

  const pr20km = data?.distancePRs.find(p => p.distance === 20000);
  const pr20min = data?.powerPRs.find(p => p.duration === 1200);
  const currentPeriod = data?.recentBests?.find((p) => p.days === selectedPeriod);

  if (!athleteId || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-[#FC4C02]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header con icono de bici */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#FC4C02]/10">
            <Bike className="h-8 w-8 text-[#FC4C02]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Récords de Ciclismo</h1>
            <p className="mt-1 text-zinc-400">Tus mejores marcas y métricas de rendimiento</p>
          </div>
        </div>
        <StravaConnectionButton redirectUrl="/dashboard/records" />
      </div>

      {/* SyncManager */}
      <SyncManager athleteId={athleteId} onSyncComplete={fetchRecords} />

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
                <p className="text-xs text-zinc-600 mt-1">{data?.ftp?.method || 'Sin datos'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mejor 20K */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Trophy className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Mejor 20K</p>
                <p className="text-2xl font-bold text-white">{formatTime(pr20km?.bestTime || null)}</p>
                <p className="text-sm text-blue-400">{formatSpeed(pr20km?.bestSpeed || null)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Potencia 20min (para FTP) */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Flame className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Potencia Máx (20min)</p>
                <p className="text-2xl font-bold text-white">{pr20min?.power || '--'} W</p>
                <p className="text-sm text-green-400">{pr20min?.wkg?.toFixed(2) || '--'} W/kg</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total actividades ciclismo */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Bike className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Total {selectedPeriod} días</p>
                <p className="text-2xl font-bold text-white">{currentPeriod?.activities ?? '--'} act</p>
                <p className="text-sm text-purple-400">{currentPeriod ? `${(currentPeriod.totalDistance / 1000).toFixed(0)} km` : '-- km'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mejores Tiempos por Distancia - CICLISMO */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bike className="h-5 w-5 text-yellow-500" />
              Mejores Tiempos (Ciclismo)
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
                      <span className="text-sm font-medium text-white w-28">{pr.label}</span>
                      <div>
                        <p className="text-lg font-bold text-white">{formatTime(pr.bestTime)}</p>
                        <p className="text-xs text-zinc-500">{formatSpeed(pr.bestSpeed)} avg</p>
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
              Curva de Potencia (Ciclismo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PowerCurveChart data={data.powerCurve} weight={data.weight} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente de Curva de Potencia
function PowerCurveChart({ data, weight }: { data: PowerCurve; weight: number }) {
  const points = data.durations
    .map((duration, i) => ({ duration, power: data.powers[i], wkg: data.wkgs[i] }))
    .filter((p): p is { duration: number; power: number; wkg: number | null } => p.power !== null);

  if (points.length === 0) return null;

  const width = 900;
  const height = 260;
  const padding = 36;
  const maxPower = Math.max(...points.map((p) => p.power));
  const minPower = Math.min(...points.map((p) => p.power));
  const powerRange = Math.max(maxPower - minPower, 1);

  const xFor = (index: number) => padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
  const yFor = (power: number) => height - padding - ((power - minPower) / powerRange) * (height - padding * 2);

  const polyline = points
    .map((point, index) => `${xFor(index)},${yFor(point.power)}`)
    .join(' ');

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[820px] w-full">
          {[0, 1, 2, 3].map((step) => {
            const y = padding + (step * (height - padding * 2)) / 3;
            const label = Math.round(maxPower - (step * powerRange) / 3);
            return (
              <g key={step}>
                <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#27272a" strokeDasharray="4 4" />
                <text x={8} y={y + 4} fill="#71717a" fontSize="12">{label} W</text>
              </g>
            );
          })}

          <polyline fill="none" stroke="#f97316" strokeWidth="4" points={polyline} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((point, index) => {
            const x = xFor(index);
            const y = yFor(point.power);
            return (
              <g key={point.duration}>
                <circle cx={x} cy={y} r="5" fill="#fb923c" />
                <text x={x} y={height - 10} textAnchor="middle" fill="#a1a1aa" fontSize="11">
                  {point.duration < 60 ? `${point.duration}s` : point.duration < 3600 ? `${Math.floor(point.duration / 60)}m` : `${Math.floor(point.duration / 3600)}h`}
                </text>
                <text x={x} y={y - 12} textAnchor="middle" fill="#ffffff" fontSize="11">
                  {Math.round(point.power)}W
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {points.map((point) => (
          <div key={point.duration} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-zinc-500">
              {point.duration < 60 ? `${point.duration}s` : point.duration < 3600 ? `${Math.floor(point.duration / 60)} min` : `${Math.floor(point.duration / 3600)} h`}
            </div>
            <div className="text-white font-semibold">{Math.round(point.power)} W</div>
            <div className="text-orange-400 text-xs">{point.wkg ? `${point.wkg.toFixed(2)} W/kg` : '--'}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-sm text-zinc-500">
        <span>Potencia pico: <strong className="text-orange-400">{Math.round(maxPower)} W</strong></span>
        <span>Peso: {weight} kg</span>
      </div>
    </div>
  );
}
