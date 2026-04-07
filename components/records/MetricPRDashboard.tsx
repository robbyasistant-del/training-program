/**
 * Metric PR Dashboard Component
 * Displays current metric PRs grouped by activity type
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';
import { FormattedMetricPR, MetricType, ActivityType, METRIC_CONFIGS } from '@/types/metricPR';
import { MetricPRHistoryChart } from './MetricPRHistoryChart';
import { MetricPRCard } from './MetricPRCard';
import { PRNotificationToast } from './PRNotificationToast';

interface MetricPRData {
  records: FormattedMetricPR[];
  grouped: Record<ActivityType, Record<MetricType, FormattedMetricPR[]>>;
  count: number;
}

export function MetricPRDashboard() {
  const [data, setData] = useState<MetricPRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<{
    activityType: ActivityType;
    metricType: MetricType;
  } | null>(null);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      metricType: MetricType;
      record: FormattedMetricPR;
    }>
  >([]);

  // Fetch metric PRs
  useEffect(() => {
    async function fetchMetricPRs() {
      try {
        // Note: This should use the actual athlete ID from context/auth
        const athleteId = 'current-user-id';
        const response = await fetch(`/api/athletes/${athleteId}/metric-prs`);

        if (!response.ok) {
          throw new Error('Failed to fetch metric PRs');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchMetricPRs();
  }, []);

  // Poll for notifications
  useEffect(() => {
    async function checkNotifications() {
      try {
        const athleteId = 'current-user-id';
        const response = await fetch(`/api/athletes/${athleteId}/notifications`);

        if (response.ok) {
          const result = await response.json();
          if (result.notifications.length > 0) {
            setNotifications(result.notifications);
          }
        }
      } catch (error) {
        // Silent fail for polling
      }
    }

    const interval = setInterval(checkNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  // Dismiss notification
  const dismissNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      const athleteId = 'current-user-id';
      await fetch(`/api/athletes/${athleteId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id] }),
      });
    } catch (error) {
      console.error('Failed to mark notification as seen:', error);
    }
  };

  if (loading) {
    return <MetricPRDashboardSkeleton />;
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

  if (!data || data.count === 0) {
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
            Sincroniza actividades para detectar tus mejores marcas
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get all activity types that have PRs
  const activityTypes = Object.keys(data.grouped) as ActivityType[];

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.map((notification) => (
        <PRNotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => dismissNotification(notification.id)}
        />
      ))}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          title="Total Récords"
          value={data.count.toString()}
          icon={<Trophy className="h-5 w-5 text-yellow-500" />}
        />
        <SummaryCard
          title="Tipos de Actividad"
          value={activityTypes.length.toString()}
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
        />
        <SummaryCard
          title="Este Mes"
          value={getPRsThisMonth(data.records).toString()}
          icon={<Calendar className="h-5 w-5 text-green-500" />}
        />
        <SummaryCard
          title="Mejora Promedio"
          value={`${getAverageImprovement(data.records).toFixed(1)}%`}
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* PR Cards by Activity Type */}
      {activityTypes.map((activityType) => (
        <Card key={activityType} className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {formatActivityType(activityType)}
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                {Object.keys(data.grouped[activityType]).length} métricas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(data.grouped[activityType]).map(([metricType, records]) => {
                const record = records[0]; // Current PR
                if (!record) return null;
                return (
                  <MetricPRCard
                    key={`${activityType}_${metricType}`}
                    record={record}
                    onClick={() =>
                      setSelectedMetric({
                        activityType,
                        metricType: metricType as MetricType,
                      })
                    }
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* History Chart Modal */}
      {selectedMetric && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedMetric(null)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <MetricPRHistoryChart
              athleteId="current-user-id"
              activityType={selectedMetric.activityType}
              metricType={selectedMetric.metricType}
              onClose={() => setSelectedMetric(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Summary Card Component
 */
function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-sm text-zinc-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton Loading State
 */
function MetricPRDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-4">
              <Skeleton className="h-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Format activity type for display
 */
function formatActivityType(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    RUN: 'Running',
    RIDE: 'Ciclismo',
    SWIM: 'Natación',
    HIKE: 'Senderismo',
    WALK: 'Caminata',
    ALPINE_SKI: 'Esquí Alpino',
    BACKCOUNTRY_SKI: 'Esquí de Travesía',
    CANOEING: 'Piragüismo',
    CROSSFIT: 'CrossFit',
    E_BIKE_RIDE: 'Ciclismo Eléctrico',
    ELLIPTICAL: 'Elíptica',
    GOLF: 'Golf',
    HANDCYCLE: 'Handcycle',
    ICE_SKATE: 'Patinaje sobre Hielo',
    INLINE_SKATE: 'Patinaje en Línea',
    KAYAKING: 'Kayak',
    KITESURF: 'Kitesurf',
    NORDIC_SKI: 'Esquí Nórdico',
    ROCK_CLIMBING: 'Escalada',
    ROLLER_SKI: 'Esquí de Rodillos',
    ROWING: 'Remo',
    SAIL: 'Vela',
    SKATEBOARD: 'Skateboard',
    SNOWBOARD: 'Snowboard',
    SNOWSHOE: 'Raquetas de Nieve',
    SOCCER: 'Fútbol',
    STAIRSTEPPER: 'Escaleras',
    STAND_UP_PADDLING: 'Paddle Surf',
    SURFING: 'Surf',
    VELOMOBILE: 'Velomóvil',
    VIRTUAL_RIDE: 'Ciclismo Virtual',
    VIRTUAL_RUN: 'Running Virtual',
    WEIGHT_TRAINING: 'Musculación',
    WHEELCHAIR: 'Silla de Ruedas',
    WINDSURF: 'Windsurf',
    WORKOUT: 'Entrenamiento',
    YOGA: 'Yoga',
  };
  return labels[type] || type;
}

/**
 * Get number of PRs achieved this month
 */
function getPRsThisMonth(records: FormattedMetricPR[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return records.filter((r) => new Date(r.recordDate) >= startOfMonth).length;
}

/**
 * Get average improvement percentage
 */
function getAverageImprovement(records: FormattedMetricPR[]): number {
  const recordsWithImprovement = records.filter((r) => r.improvementPercent);
  if (recordsWithImprovement.length === 0) return 0;
  const sum = recordsWithImprovement.reduce((acc, r) => acc + (r.improvementPercent || 0), 0);
  return sum / recordsWithImprovement.length;
}
