'use client';

import { Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

/**
 * Datos de volumen semanal
 */
export interface WeeklyVolumeData {
  /** Etiqueta de la semana (ej: "S1", "S2", "Ene 1") */
  weekLabel: string;
  /** Volumen acumulado de la semana */
  volume: number;
  /** Indica si es la semana actual */
  isCurrentWeek?: boolean;
  /** Fecha de inicio de la semana (para tooltip) */
  weekStartDate?: string;
}

/**
 * Props del componente WeeklyVolumeChart
 */
export interface WeeklyVolumeChartProps {
  /** Array de datos de volumen semanal */
  data: WeeklyVolumeData[];
  /** Título del gráfico */
  title?: string;
  /** Unidad de medida */
  unit?: 'km' | 'hours' | 'sessions';
  /** Estado de carga */
  loading?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

/**
 * Configuración por unidad
 */
const unitConfig = {
  km: {
    label: 'km',
    color: '#FC5200',
    currentWeekColor: '#FF7A3D',
    gradientFrom: '#FC5200',
    gradientTo: '#E04402',
    formatter: (value: number) => `${value.toFixed(1)} km`,
  },
  hours: {
    label: 'h',
    color: '#3B82F6',
    currentWeekColor: '#60A5FA',
    gradientFrom: '#3B82F6',
    gradientTo: '#2563EB',
    formatter: (value: number) => `${Math.round(value)} h`,
  },
  sessions: {
    label: 'sesiones',
    color: '#22C55E',
    currentWeekColor: '#4ADE80',
    gradientFrom: '#22C55E',
    gradientTo: '#16A34A',
    formatter: (value: number) => `${Math.round(value)} sesiones`,
  },
};

/**
 * Componente WeeklyVolumeChart
 *
 * Gráfico de barras que muestra el volumen semanal de entrenamiento.
 * Diseño inspirado en Strava con estilo visual limpio y moderno.
 *
 * @example
 * ```tsx
 * <WeeklyVolumeChart
 *   data={weeklyData}
 *   title="Volumen Semanal"
 *   unit="km"
 * />
 * ```
 */
export function WeeklyVolumeChart({
  data,
  title = 'Volumen Semanal',
  unit = 'km',
  loading = false,
  className = '',
}: WeeklyVolumeChartProps) {
  const [animatedData, setAnimatedData] = useState<WeeklyVolumeData[]>([]);

  const config = unitConfig[unit];

  // Animación de entrada: barras crecen desde cero
  useEffect(() => {
    if (loading || data.length === 0) {
      setAnimatedData([]);
      return;
    }

    // Iniciar con valores en cero
    const zeroData = data.map((item) => ({ ...item, volume: 0 }));
    setAnimatedData(zeroData);

    // Animar hacia los valores reales
    const timer = setTimeout(() => {
      setAnimatedData(data);
    }, 100);

    return () => clearTimeout(timer);
  }, [data, loading]);

  // Estado de carga
  if (loading) {
    return (
      <div className={`rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 ${className}`}>
        <div className="mb-4 flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="h-[200px] animate-pulse rounded-lg bg-zinc-800/50 md:h-[300px]" />
      </div>
    );
  }

  // Estado vacío
  if (data.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-8 ${className}`}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-4 rounded-full bg-zinc-800 p-4">
            <Activity className="h-8 w-8 text-zinc-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">{title}</h3>
          <p className="mb-4 max-w-sm text-sm text-zinc-400">
            No hay actividades registradas estas semanas. Sincroniza con Strava para ver tu volumen
            de entrenamiento.
          </p>
          <button
            onClick={() => (window.location.href = '/api/strava/connect')}
            className="rounded-lg bg-[#FC5200] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E04402]"
          >
            Conectar con Strava
          </button>
        </div>
      </div>
    );
  }

  // Calcular el valor máximo para ajustar el dominio del eje Y
  const maxVolume = Math.max(...data.map((d) => d.volume), 1);
  const yDomainMax = Math.ceil(maxVolume * 1.1); // 10% de margen superior

  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6 ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-sm text-zinc-400">Últimas {data.length} semanas</span>
      </div>

      {/* Gráfico */}
      <div className="relative w-full" style={{ minHeight: '200px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={animatedData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            barCategoryGap="20%"
          >
            {/* Definición de gradiente */}
            <defs>
              <linearGradient id={`gradient-${unit}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.gradientFrom} stopOpacity={1} />
                <stop offset="100%" stopColor={config.gradientTo} stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id={`gradient-current-${unit}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.currentWeekColor} stopOpacity={1} />
                <stop offset="100%" stopColor={config.currentWeekColor} stopOpacity={0.7} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

            <XAxis
              dataKey="weekLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#a1a1aa', fontSize: 12 }}
              dy={10}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              domain={[0, yDomainMax]}
              tickFormatter={(value) =>
                unit === 'km'
                  ? `${Math.round(value)}`
                  : unit === 'hours'
                    ? `${Math.round(value)}h`
                    : `${Math.round(value)}`
              }
              width={40}
            />

            <Tooltip
              cursor={{ fill: '#27272a', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length && payload[0]) {
                  const item = payload[0].payload as WeeklyVolumeData;
                  return (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
                      <p className="mb-1 font-medium text-white">
                        {item.weekLabel}
                        {item.isCurrentWeek && (
                          <span className="ml-2 text-xs text-[#FC5200]">(Actual)</span>
                        )}
                      </p>
                      {item.weekStartDate && (
                        <p className="mb-2 text-xs text-zinc-400">{item.weekStartDate}</p>
                      )}
                      <p className="text-lg font-bold" style={{ color: config.color }}>
                        {config.formatter(item.volume)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Bar
              dataKey="volume"
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {animatedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isCurrentWeek
                      ? `url(#gradient-current-${unit})`
                      : `url(#gradient-${unit})`
                  }
                  stroke={entry.isCurrentWeek ? config.currentWeekColor : 'none'}
                  strokeWidth={entry.isCurrentWeek ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Indicador de semana actual */}
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: config.color }} />
            <span>Semanas anteriores</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: config.currentWeekColor }} />
            <span>Semana actual</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Versión compacta del gráfico para espacios reducidos
 */
export function WeeklyVolumeChartCompact({
  data,
  unit = 'km',
  loading = false,
  className = '',
}: Omit<WeeklyVolumeChartProps, 'title'>) {
  const config = unitConfig[unit];

  if (loading) {
    return <div className={`h-32 animate-pulse rounded-lg bg-zinc-800/50 ${className}`} />;
  }

  if (data.length === 0) {
    return (
      <div
        className={`flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 ${className}`}
      >
        <p className="text-sm text-zinc-500">Sin datos</p>
      </div>
    );
  }

  return (
    <div className={`h-32 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis dataKey="weekLabel" hide />
          <YAxis hide domain={[0, 'auto']} />
          <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell
                key={`compact-cell-${index}`}
                fill={entry.isCurrentWeek ? config.currentWeekColor : config.color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
