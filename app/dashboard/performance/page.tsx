'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { FitnessCurvesChart } from '@/components/fitness';

interface FitnessData {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  tss: number;
}

type PeriodOption = '7d' | '30d' | '90d' | '6m' | '1y' | '2y' | 'all';

interface PeriodConfig {
  label: string;
  days: number | null;
}

const PERIOD_OPTIONS: Record<PeriodOption, PeriodConfig> = {
  '7d': { label: '7 días', days: 7 },
  '30d': { label: '30 días', days: 30 },
  '90d': { label: '90 días', days: 90 },
  '6m': { label: '6 meses', days: 180 },
  '1y': { label: '1 año', days: 365 },
  '2y': { label: '2 años', days: 730 },
  all: { label: 'Todo', days: null },
};

export default function PerformancePage() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('90d');
  const [data, setData] = useState<FitnessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMetrics, setCurrentMetrics] = useState<{
    ctl: number;
    atl: number;
    tsb: number;
  } | null>(null);
  const [lastActivityDate, setLastActivityDate] = useState<string | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  // Get athleteId from cookie
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

  useEffect(() => {
    if (!athleteId) return;

    const fetchMetrics = async () => {
      setIsLoading(true);
      try {
        // Siempre traemos datos hasta hoy (incluso si no hay actividad)
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const period = PERIOD_OPTIONS[selectedPeriod];
        const fromDate = period.days
          ? new Date(today.getTime() - period.days * 24 * 60 * 60 * 1000)
          : new Date('2000-01-01');

        const response = await fetch(
          `/api/athletes/${athleteId}/fitness-metrics?from=${fromDate.toISOString()}&to=${today.toISOString()}`
        );

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch metrics');
        }

        const result = await response.json();
        const metrics = result.metrics || [];
        
        // Encontrar la última fecha con datos reales
        if (metrics.length > 0) {
          const lastMetric = metrics[metrics.length - 1];
          setLastActivityDate(lastMetric.date);
          
          // Si la última métrica no es de hoy, interpolamos hasta hoy
          const lastDate = new Date(lastMetric.date);
          const todayStr = new Date().toISOString().split('T')[0];
          
          if (lastDate.toISOString().split('T')[0] !== todayStr) {
            // Añadir puntos interpolados hasta hoy manteniendo los últimos valores
            const extendedMetrics = [...metrics];
            const lastCtl = lastMetric.ctl;
            const lastAtl = lastMetric.atl;
            const lastTsb = lastMetric.tsb;
            
            // Añadir punto para hoy con los últimos valores conocidos
            extendedMetrics.push({
              date: todayStr,
              ctl: lastCtl,
              atl: lastAtl,
              tsb: lastTsb,
              tss: 0
            });
            
            setData(extendedMetrics);
            setCurrentMetrics({
              ctl: lastCtl,
              atl: lastAtl,
              tsb: lastTsb,
            });
          } else {
            setData(metrics);
            setCurrentMetrics({
              ctl: lastMetric.ctl,
              atl: lastMetric.atl,
              tsb: lastMetric.tsb,
            });
          }
        } else {
          setData([]);
          setCurrentMetrics(null);
        }
      } catch (error) {
        console.error('Error fetching fitness metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedPeriod, athleteId, router]);

  // Interpretar estado de forma
  const getFormState = (tsb: number) => {
    if (tsb > 15) return { label: 'Fresco', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30' };
    if (tsb > -10) return { label: 'Neutro', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' };
    if (tsb > -25) return { label: 'Fatigado', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' };
    return { label: 'Sobrecarga', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' };
  };

  const formState = currentMetrics ? getFormState(currentMetrics.tsb) : null;

  // Formatear fecha
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (!athleteId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-[#FC4C02]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Rendimiento</h1>
            <p className="mt-2 text-zinc-400">
              Análisis de tu carga de entrenamiento y curvas de fitness
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-500">Hoy</p>
            <p className="text-lg font-semibold text-white">{today}</p>
            {lastActivityDate && (
              <p className="text-xs text-zinc-600">
                Última actividad: {formatDate(lastActivityDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Selector de período */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(PERIOD_OPTIONS) as PeriodOption[]).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedPeriod === period
                ? 'bg-[#FC4C02] text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            } border border-zinc-700`}
          >
            {PERIOD_OPTIONS[period].label}
          </button>
        ))}
      </div>

      {/* Métricas actuales */}
      {currentMetrics && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-medium text-blue-400">CTL (Carga Crónica)</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {currentMetrics.ctl.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Nivel de forma general</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-medium text-red-400">ATL (Carga Aguda)</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {currentMetrics.atl.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Fatiga actual (7 días)</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-medium text-green-400">TSB (Balance)</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {currentMetrics.tsb.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Forma para competir</p>
          </div>

          {formState && (
            <div className={`rounded-xl border ${formState.border} ${formState.bg} p-4`}>
              <p className={`text-sm font-medium ${formState.color}`}>Estado</p>
              <p className="mt-1 text-2xl font-bold text-white">{formState.label}</p>
              <p className="mt-1 text-xs text-zinc-500">Basado en TSB</p>
            </div>
          )}
        </div>
      )}

      {/* Gráfico */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Curvas de Fitness</h2>
        <FitnessCurvesChart data={data} isLoading={isLoading} />
      </div>

      {/* Leyenda explicativa */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="mb-3 font-semibold text-white">¿Qué significan estas curvas?</h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>
            <strong className="text-blue-400">CTL (Carga Crónica):</strong> Promedio ponderado
            de 42 días de tu TSS. Representa tu nivel de forma general. Cuanto más alto, mejor
            forma tienes.
          </p>
          <p>
            <strong className="text-red-400">ATL (Carga Aguda):</strong> Promedio ponderado de 7
            días de tu TSS. Representa tu fatiga actual. Picos altos indican sobrecarga.
          </p>
          <p>
            <strong className="text-green-400">TSB (Balance):</strong> Diferencia entre CTL y ATL
            del día anterior. Valores positivos (TSB {'>'} 0) significas que estás descansado y listo
            para competir.
          </p>
        </div>
      </div>
    </div>
  );
}
