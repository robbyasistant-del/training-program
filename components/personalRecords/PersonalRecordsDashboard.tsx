/**
 * Personal Records Dashboard Component
 * Displays current PRs with history and celebration for new records
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingDown, Calendar, Activity } from 'lucide-react';
import { FormattedPersonalRecord } from '@/types/personalRecord';

interface PersonalRecordsDashboardProps {
  athleteId: string | null;
  newRecordDetected?: boolean;
}

interface PRData {
  records: FormattedPersonalRecord[];
  count: number;
}

export function PersonalRecordsDashboard({
  athleteId,
  newRecordDetected = false,
}: PersonalRecordsDashboardProps) {
  const [data, setData] = useState<PRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(newRecordDetected);

  useEffect(() => {
    if (!athleteId) {
      setLoading(false);
      return;
    }

    async function fetchPRs() {
      try {
        const response = await fetch(`/api/athletes/${athleteId}/personal-records`);
        if (!response.ok) {
          throw new Error('Failed to fetch personal records');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchPRs();
  }, [athleteId]);

  // Hide celebration after 5 seconds
  useEffect(() => {
    if (showCelebration) {
      const timer = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showCelebration]);

  if (loading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-6">
          <p className="text-red-400">Error loading records: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.records.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Récords Personales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-zinc-400">No hay récords personales aún</p>
          <p className="mt-2 text-sm text-zinc-500">
            Sincroniza actividades para detectar tus mejores tiempos
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showCelebration && <NewRecordCelebration />}

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Récords Personales
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
              {data.count}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.records.map((record) => (
            <PRCard key={record.id} record={record} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Individual PR Card Component
 */
function PRCard({ record }: { record: FormattedPersonalRecord }) {
  const distanceNames: Record<string, string> = {
    '5K': '5 Kilómetros',
    '10K': '10 Kilómetros',
    '15K': '15 Kilómetros',
    HALF_MARATHON: 'Media Maratón',
    MARATHON: 'Maratón',
  };

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
          {record.improvementSeconds ? (
            <Badge className="bg-green-600 text-white">
              <TrendingDown className="mr-1 h-3 w-3" />-{formatTime(record.improvementSeconds)}
            </Badge>
          ) : (
            <Trophy className="h-5 w-5 text-yellow-500" />
          )}
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
 * Celebration Animation Component
 */
function NewRecordCelebration() {
  return (
    <div className="animate-in fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center duration-500">
      <div className="animate-in zoom-in-50 rounded-2xl bg-yellow-500/90 px-8 py-6 text-zinc-900 shadow-2xl duration-300">
        <div className="flex items-center gap-4">
          <Trophy className="h-12 w-12" />
          <div>
            <p className="text-2xl font-bold">¡Nuevo Récord!</p>
            <p className="text-sm opacity-80">Has batido tu mejor tiempo 🎉</p>
          </div>
        </div>
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 animate-pulse bg-yellow-400/20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Format time helper
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
