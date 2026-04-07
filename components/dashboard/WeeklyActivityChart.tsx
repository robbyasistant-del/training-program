'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DayData {
  day: string;
  dayShort: string;
  date: string;
  distance: number;
  duration: number;
  elevation: number;
  activities: number;
}

interface WeeklyActivityChartProps {
  data: DayData[];
  metric?: 'distance' | 'duration' | 'elevation';
}

const metricConfig = {
  distance: {
    label: 'Distancia (km)',
    color: '#fc5200',
    formatter: (value: number) => `${value} km`,
  },
  duration: {
    label: 'Tiempo (min)',
    color: '#3b82f6',
    formatter: (value: number) => `${Math.round(value / 60)} min`,
  },
  elevation: {
    label: 'Elevación (m)',
    color: '#22c55e',
    formatter: (value: number) => `${value} m`,
  },
};

export function WeeklyActivityChart({ data, metric = 'distance' }: WeeklyActivityChartProps) {
  const config = metricConfig[metric];

  // Formatear datos para el gráfico
  const chartData = data.map((day) => ({
    ...day,
    value:
      metric === 'duration' ? day.duration : metric === 'distance' ? day.distance : day.elevation,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="dayShort"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 12 }}
            width={40}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length && payload[0]) {
                const data = payload[0].payload as DayData;
                return (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
                    <p className="mb-1 font-medium text-white">{data.day}</p>
                    <p className="text-sm text-zinc-400">{data.date}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm">
                        <span className="text-orange-500">●</span> {data.distance} km
                      </p>
                      <p className="text-sm">
                        <span className="text-blue-500">●</span> {Math.round(data.duration / 60)}{' '}
                        min
                      </p>
                      {data.activities > 0 && (
                        <p className="text-sm text-zinc-400">
                          {data.activities} actividad{data.activities > 1 ? 'es' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="value" fill={config.color} radius={[4, 4, 0, 0]} maxBarSize={50} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
