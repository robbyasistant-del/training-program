'use client';

import { useState, useEffect } from 'react';

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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('90d');
  const [data, setData] = useState<FitnessData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMetrics, setCurrentMetrics] = useState<{
    ctl: number;
    atl: number;
    tsb: number;
  } | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      try {
        const period = PERIOD_OPTIONS[selectedPeriod];
        const fromDate = period.days
          ? new Date(Date.now() - period.days * 24 * 60 * 60 * 1000)
          : new Date('2000-01-01');

        const response = await fetch(
          `/api/athletes/me/fitness-metrics?from=${fromDate.toISOString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const result = await response.json();
        setData(result.metrics || []);

        if (result.metrics?.length > 0) {
          const last = result.metrics[result.metrics.length - 1];
          setCurrentMetrics({
            ctl: last.ctl,
            atl: last.atl,
            tsb: last.tsb,
          });
        }
      } catch (error) {
        console.error('Error fetching fitness metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedPeriod]);

  // Interpretar estado de forma
  const getFormState = (tsb: number) => {
    if (tsb > 15) return { label: 'Fresco', color: 'text-green-600', bg: 'bg-green-50' };
    if (tsb > -10) return { label: 'Neutro', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (tsb > -25) return { label: 'Fatigado', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { label: 'Sobrecarga', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const formState = currentMetrics ? getFormState(currentMetrics.tsb) : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rendimiento</h1>
        <p className="mt-2 text-gray-600">
          Análisis de tu carga de entrenamiento y curvas de fitness
        </p>
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
                : 'bg-white text-gray-700 hover:bg-gray-100'
            } border border-gray-200`}
          >
            {PERIOD_OPTIONS[period].label}
          </button>
        ))}
      </div>

      {/* Métricas actuales */}
      {currentMetrics && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-600">CTL (Carga Crónica)</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {currentMetrics.ctl.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-blue-600">Nivel de forma general</p>
          </div>

          <div className="rounded-xl bg-red-50 p-4">
            <p className="text-sm font-medium text-red-600">ATL (Carga Aguda)</p>
            <p className="mt-1 text-2xl font-bold text-red-900">
              {currentMetrics.atl.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-red-600">Fatiga actual (7 días)</p>
          </div>

          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-sm font-medium text-green-600">TSB (Balance)</p>
            <p className="mt-1 text-2xl font-bold text-green-900">
              {currentMetrics.tsb.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-green-600">Forma para competir</p>
          </div>

          {formState && (
            <div className={`rounded-xl p-4 ${formState.bg}`}>
              <p className={`text-sm font-medium ${formState.color}`}>Estado</p>
              <p className={`mt-1 text-2xl font-bold ${formState.color}`}>
                {formState.label}
              </p>
              <p className="mt-1 text-xs text-gray-600">Basado en TSB</p>
            </div>
          )}
        </div>
      )}

      {/* Gráfico */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Curvas de Fitness
        </h2>
        <FitnessCurvesChart data={data} isLoading={isLoading} />
      </div>

      {/* Leyenda explicativa */}
      <div className="mt-6 rounded-xl bg-gray-50 p-6">
        <h3 className="mb-3 font-semibold text-gray-900">¿Qué significan estas curvas?</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <strong className="text-blue-600">CTL (Carga Crónica):</strong> Promedio ponderado
            de 42 días de tu TSS. Representa tu nivel de forma general. Cuanto más alto, mejor
            forma tienes.
          </p>
          <p>
            <strong className="text-red-600">ATL (Carga Aguda):</strong> Promedio ponderado de 7
            días de tu TSS. Representa tu fatiga actual. Picos altos indican sobrecarga.
          </p>
          <p>
            <strong className="text-green-600">TSB (Balance):</strong> Diferencia entre CTL y ATL
            del día anterior. Valores positivos (TSB {'>'} 0) significas que estás descansado y listo
            para competir.
          </p>
        </div>
      </div>
    </div>
  );
}
