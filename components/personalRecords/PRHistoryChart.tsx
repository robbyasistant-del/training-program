/**
 * Personal Record History Chart
 * Displays evolution of PRs over time for a specific distance
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Calendar } from 'lucide-react';
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
import { StandardDistanceLabel, FormattedPersonalRecord } from '@/types/personalRecord';

interface PRHistoryChartProps {
  athleteId: string | null;
  distanceLabel?: StandardDistanceLabel;
}

interface HistoryData {
  distanceLabel: StandardDistanceLabel;
  history: FormattedPersonalRecord[];
}

const distanceNames: Record<StandardDistanceLabel, string> = {
  FIVE_K: '5K',
  TEN_K: '10K',
  FIFTEEN_K: '15K',
  HALF_MARATHON: 'Media Maratón',
  MARATHON: 'Maratón',
};

export function PRHistoryChart({ athleteId, distanceLabel = 'FIVE_K' }: PRHistoryChartProps) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!athleteId) {
      setLoading(false);
      return;
    }

    async function fetchHistory() {
      try {
        const response = await fetch(
          `/api/athletes/${athleteId}/personal-records/history?distanceLabel=${distanceLabel}`
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
  }, [athleteId, distanceLabel]);

  if (loading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
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
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-6">
          <p className="text-red-400">Error loading history: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Historial {distanceNames[distanceLabel]}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-zinc-400">No hay historial para esta distancia</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.history.map((record) => ({
    date: new Date(record.achievedAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    }),
    fullDate: record.achievedAt,
    timeSeconds: record.timeSeconds,
    formattedTime: record.formattedTime,
    improvement: record.improvementSeconds || 0,
  }));

  const bestTime = Math.min(...chartData.map((d) => d.timeSeconds));

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Historial {distanceNames[distanceLabel]}
          <span className="ml-2 text-sm font-normal text-zinc-400">
            ({data.history.length} récords)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#71717a"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => formatTime(value)}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
                        <p className="font-medium text-white">{data.formattedTime}</p>
                        <p className="text-sm text-zinc-400">{data.date}</p>
                        {data.improvement > 0 && (
                          <p className="text-sm text-green-400">-{formatTime(data.improvement)}</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={bestTime}
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
                dataKey="timeSeconds"
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

/**
 * Format time helper
 */
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
