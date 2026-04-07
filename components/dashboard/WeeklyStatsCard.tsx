'use client';

import { Activity, Mountain, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface WeeklyStatsCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: 'distance' | 'time' | 'elevation' | 'activities';
  trend?: number; // Porcentaje de cambio vs semana anterior
  color?: string;
}

const iconMap = {
  distance: Activity,
  time: Clock,
  elevation: Mountain,
  activities: Zap,
};

const colorMap = {
  distance: 'text-orange-500',
  time: 'text-blue-500',
  elevation: 'text-green-500',
  activities: 'text-purple-500',
};

const bgColorMap = {
  distance: 'bg-orange-500/10',
  time: 'bg-blue-500/10',
  elevation: 'bg-green-500/10',
  activities: 'bg-purple-500/10',
};

export function WeeklyStatsCard({ title, value, unit, icon, trend, color }: WeeklyStatsCardProps) {
  const Icon = iconMap[icon];
  const iconColor = color || colorMap[icon];
  const bgColor = bgColorMap[icon];

  // Formatear tiempo si es necesario
  const formattedValue =
    icon === 'time' && typeof value === 'number' ? formatDuration(value) : value;

  return (
    <Card className="border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${bgColor}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white">{formattedValue}</span>
          <span className="text-sm text-zinc-500">{unit}</span>
        </div>
        {trend !== undefined && (
          <p className={`mt-1 text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs semana pasada
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Formatea segundos a formato legible (h:mm o mm)
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
