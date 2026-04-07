'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';

interface FitnessData {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  tss: number;
}

interface FitnessCurvesChartProps {
  data: FitnessData[];
  isLoading?: boolean;
}

/**
 * Componente de gráfico de curvas fitness (CTL, ATL, TSB)
 * Usa Recharts para visualización interactiva
 */
export function FitnessCurvesChart({ data, isLoading }: FitnessCurvesChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('es-ES', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-80 w-full animate-pulse rounded-lg bg-gray-100">
        <div className="flex h-full items-center justify-center text-gray-400">
          Cargando curvas de rendimiento...
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="h-80 w-full rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex h-full items-center justify-center text-gray-500">
          No hay datos suficientes para mostrar las curvas de rendimiento.
          <br />
          Sincroniza tus actividades para ver tu progreso.
        </div>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ color: string; name: string; value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const ctl = payload.find((p) => p.name === 'CTL')?.value;
      const atl = payload.find((p) => p.name === 'ATL')?.value;
      const tsb = payload.find((p) => p.name === 'TSB')?.value;

      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 font-semibold text-gray-700">{label}</p>
          {ctl !== undefined && (
            <p className="text-sm" style={{ color: '#2563eb' }}>
              CTL: {ctl.toFixed(1)}
            </p>
          )}
          {atl !== undefined && (
            <p className="text-sm" style={{ color: '#dc2626' }}>
              ATL: {atl.toFixed(1)}
            </p>
          )}
          {tsb !== undefined && (
            <p className="text-sm" style={{ color: '#16a34a' }}>
              TSB: {tsb.toFixed(1)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            label={{
              value: 'Carga de Entrenamiento',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                CTL: 'CTL (Carga Crónica)',
                ATL: 'ATL (Carga Aguda)',
                TSB: 'TSB (Balance)',
              };
              return labels[value] || value;
            }}
          />

          <Line
            type="monotone"
            dataKey="ctl"
            name="CTL"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="atl"
            name="ATL"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="tsb"
            name="TSB"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />

          <Brush dataKey="date" height={30} stroke="#2563eb" travellerWidth={8} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-600"></div>
          <span>CTL: Carga Crónica (6 semanas)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-600"></div>
          <span>ATL: Carga Aguda (7 días)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-600"></div>
          <span>TSB: Balance (CTL - ATL)</span>
        </div>
      </div>
    </div>
  );
}
