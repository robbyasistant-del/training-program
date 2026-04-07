/**
 * Personal Record Card Component
 * Displays a single PR with time, pace, and improvement info
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingDown, Calendar, Activity } from 'lucide-react';
import { FormattedPersonalRecord } from '@/types/personalRecord';

interface PRCardProps {
  record: FormattedPersonalRecord;
  showBadge?: boolean;
}

const distanceNames: Record<string, string> = {
  '5K': '5 Kilómetros',
  '10K': '10 Kilómetros',
  '15K': '15 Kilómetros',
  HALF_MARATHON: 'Media Maratón',
  MARATHON: 'Maratón',
};

/**
 * Format time helper
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function PRCard({ record, showBadge = false }: PRCardProps) {
  return (
    <Card className="border-zinc-700 bg-zinc-800/50 transition-colors hover:bg-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-400">
              {distanceNames[record.distanceLabel] || record.distanceLabel}
            </p>
            <p className="text-2xl font-bold text-white">{record.formattedTime}</p>
          </div>
          <div className="flex items-center gap-2">
            {showBadge && <RecordBadge />}
            {record.improvementSeconds ? (
              <Badge className="bg-green-600 text-white">
                <TrendingDown className="mr-1 h-3 w-3" />-{formatTime(record.improvementSeconds)}
              </Badge>
            ) : (
              <Trophy className="h-5 w-5 text-yellow-500" />
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            <span>{record.formattedPace}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{new Date(record.achievedAt).toLocaleDateString('es-ES')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Record Badge Component - "Nuevo Récord"
 */
export function RecordBadge() {
  return (
    <Badge className="animate-pulse bg-yellow-500 font-semibold text-zinc-900">
      <Trophy className="mr-1 h-3 w-3" />
      Nuevo Récord
    </Badge>
  );
}

export default PRCard;
