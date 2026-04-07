/**
 * Metric PR History Chart Component
 * Displays evolution of metric PRs over time
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { MetricType, ActivityType, FormattedMetricPR, METRIC_CONFIGS } from '@/types/metricPR';

interface MetricPRHistoryChartProps {
  athleteId: string;
  activityType: ActivityType;
  metricType: MetricType;
  onClose?: () => void;
}

interface HistoryData {
  activityType: ActivityType;
  metricType: MetricType;
  history: FormattedMetricPR[];
  count: number;
}

export function MetricPRHistoryChart({
  athleteId,
  activityType,
  metricType,
  onClose,
}: MetricPRHistoryChartProps) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = METRIC_CONFIGS[metricType];

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(
          `/api/athletes/${athleteId}/metric-prs/history?activityType=${activityType}&metricType=${metricType}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch PR history');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [athleteId, activityType, metricType]);

  if (loading) {
    return (
      <Card className="w-full border-zinc-800 bg-zinc-900">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-zinc-800 bg-zinc-900">
        <CardContent className="p-6">
          <p className="text-red-400">Error loading history: {error}</p>
          {onClose && (
            <Button onClick={onClose} className="mt-4">
              Cerrar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.count === 0) {
    return (
      <Card className="w-full border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Historial
            </span>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-zinc-400">No hay historial para esta métrica</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.history.map((record) => ({
    date: new Date(record.recordDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    }),
    fullDate: record.recordDate,
    value: record.metricValue,
    formattedValue: record.formattedValue,
    activityName: record.activityName,
    improvement: record.improvementPercent || 0,
  }));

  const bestValue = config.higherIsBetter
    ? Math.max(...chartData.map((d) => d.value))
    : Math.min(...chartData.map((d) => d.value));

  return (
    <Card className="w-full border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Historial: {config.label}
            <span className="text-sm font-normal text-zinc-400">({data.count} récords)</span>
          </span>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#71717a"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => config.formatValue(value)}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
                        <p className="font-medium text-white">{data.formattedValue}</p>
                        <p className="text-sm text-zinc-400">{data.activityName}</p>
                        <p className="text-xs text-zinc-500">{data.date}</p>
                        {data.improvement !== 0 && (
                          <p
                            className={`text-sm ${
                              data.improvement > 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {data.improvement > 0 ? '+' : ''}
                            {data.improvement.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={bestValue}
                stroke="#22c55e"
                strokeDasharray="3 3"
                label={{
                  value: 'Mejor',
                  fill: '#22c55e',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#60a5fa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
