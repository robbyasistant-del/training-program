/**
 * Metric PR Card Component
 * Displays a single metric PR
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Route, Gauge, Clock, Mountain } from 'lucide-react';
import { FormattedMetricPR, MetricType, METRIC_CONFIGS } from '@/types/metricPR';

interface MetricPRCardProps {
  record: FormattedMetricPR;
  onClick?: () => void;
}

const metricIcons: Record<MetricType, React.ReactNode> = {
  [MetricType.DISTANCE]: <Route className="h-5 w-5" />,
  [MetricType.PACE]: <Gauge className="h-5 w-5" />,
  [MetricType.DURATION]: <Clock className="h-5 w-5" />,
  [MetricType.ELEVATION_GAIN]: <Mountain className="h-5 w-5" />,
};

const metricColors: Record<MetricType, string> = {
  [MetricType.DISTANCE]: 'text-blue-500',
  [MetricType.PACE]: 'text-green-500',
  [MetricType.DURATION]: 'text-orange-500',
  [MetricType.ELEVATION_GAIN]: 'text-purple-500',
};

export function MetricPRCard({ record, onClick }: MetricPRCardProps) {
  const config = METRIC_CONFIGS[record.metricType];
  const hasImprovement = record.improvementPercent !== undefined;

  return (
    <Card
      className="cursor-pointer border-zinc-700 bg-zinc-800/50 transition-colors hover:bg-zinc-800"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={metricColors[record.metricType]}>{metricIcons[record.metricType]}</div>
            <div>
              <p className="text-sm text-zinc-400">{config.label}</p>
              <p className="text-xl font-bold text-white">{record.formattedValue}</p>
            </div>
          </div>

          {hasImprovement ? (
            <Badge
              className={`${
                (record.improvementPercent || 0) >= 0 ? 'bg-green-600' : 'bg-red-600'
              } text-white`}
            >
              {(record.improvementPercent || 0) >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {record.formattedImprovement}
            </Badge>
          ) : (
            <Badge className="border-yellow-500/30 bg-yellow-500/20 text-yellow-400">
              Primer Récord
            </Badge>
          )}
        </div>

        <div className="mt-3 text-sm text-zinc-500">
          <p>{record.activityName}</p>
          <p>
            {new Date(record.recordDate).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
