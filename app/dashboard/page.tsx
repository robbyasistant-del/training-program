'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useMemo } from 'react';

import { ActivityList } from '@/components/activity';
import { WeeklyStatsCard } from '@/components/dashboard/WeeklyStatsCard';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { WeeklyActivityChart } from '@/components/dashboard/WeeklyActivityChart';
import { WeekSelector } from '@/components/dashboard/WeekSelector';
import { ActivitySummaryRing } from '@/components/dashboard/ActivitySummaryRing';
import { WeeklyVolumeChart } from '@/components/charts';
import { StravaConnectionButton } from '@/components/strava';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivities } from '@/hooks/useRecentActivities';
import { useWeeklyVolume } from '@/hooks/useWeeklyVolume';
import { Activity } from '@/types/activity';

interface WeeklyStats {
  week: {
    start: string;
    end: string;
    label: string;
  };
  summary: {
    totalDistance: number;
    totalTime: number;
    totalElevation: number;
    activityCount: number;
    avgSpeed: number;
  };
  dailyBreakdown: Array<{
    day: string;
    dayShort: string;
    date: string;
    distance: number;
    duration: number;
    elevation: number;
    activities: number;
  }>;
  goalsProgress: {
    distance: { current: number; target: number; percentage: number };
    time: { current: number; target: number; percentage: number };
  };
}

/**
 * Dashboard Page - Client Component
 * Muestra estadísticas semanales de entrenamiento con navegación entre semanas
 */
export default function DashboardPage() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  // Obtener athleteId de la cookie al cargar
  useEffect(() => {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('athlete_id='));
    if (cookie) {
      const id = cookie.split('=')[1];
      if (id) {
        setAthleteId(id);
      } else {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  // Cargar estadísticas cuando cambia athleteId o weekOffset
  useEffect(() => {
    if (!athleteId) return;

    async function fetchStats() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/dashboard/stats?athleteId=${athleteId}&weekOffset=${weekOffset}`
        );

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Error al cargar estadísticas');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [athleteId, weekOffset, router]);

  // Hook para actividades recientes
  const {
    activities: recentActivities,
    isLoading: activitiesLoading,
    error: activitiesError,
    refetch: refetchActivities,
  } = useRecentActivities(athleteId, 15);

  // Hook para volumen semanal (últimas 8 semanas)
  const {
    data: weeklyVolumeData,
    isLoading: weeklyVolumeLoading,
  } = useWeeklyVolume(athleteId, 'km');

  // Handler para click en actividad
  const handleActivityClick = useCallback((activity: Activity) => {
    // Navegar a detalle de actividad (o abrir modal en el futuro)
    console.log('Actividad seleccionada:', activity);
  }, []);

  const handlePreviousWeek = () => setWeekOffset((prev) => prev - 1);
  const handleNextWeek = () => setWeekOffset((prev) => prev + 1);
  const handleCurrentWeek = () => setWeekOffset(0);

  // Formatear tiempo total
  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!athleteId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FC4C02] to-[#e04402]">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L8.423 0 2.5 12.343h4.172" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Training Program</h1>
          </div>
          <StravaConnectionButton />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header con selector de semana */}
        <div className="mb-6">
          <h2 className="mb-4 text-2xl font-bold text-white">Dashboard</h2>
          {loading ? (
            <Skeleton className="h-10 w-64" />
          ) : stats ? (
            <WeekSelector
              weekLabel={stats.week.label}
              weekOffset={weekOffset}
              onPreviousWeek={handlePreviousWeek}
              onNextWeek={handleNextWeek}
              onCurrentWeek={handleCurrentWeek}
            />
          ) : null}
        </div>

        {error ? (
          <Card className="border-red-800 bg-red-900/20">
            <CardContent className="p-6">
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-sm text-red-400 underline hover:text-red-300"
              >
                Reintentar
              </button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {loading ? (
                <>
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </>
              ) : stats ? (
                <>
                  <WeeklyStatsCard
                    title="Distancia"
                    value={stats.summary.totalDistance}
                    unit="km"
                    icon="distance"
                  />
                  <WeeklyStatsCard
                    title="Tiempo"
                    value={formatTotalTime(stats.summary.totalTime)}
                    unit=""
                    icon="time"
                  />
                  <WeeklyStatsCard
                    title="Elevación"
                    value={stats.summary.totalElevation}
                    unit="m"
                    icon="elevation"
                  />
                  <WeeklyStatsCard
                    title="Actividades"
                    value={stats.summary.activityCount}
                    unit=""
                    icon="activities"
                  />
                </>
              ) : null}
            </div>

            {/* Progress Rings & Chart */}
            <div className="mb-6 grid gap-6 lg:grid-cols-3">
              {/* Progress Goals */}
              <Card className="border-zinc-800 bg-zinc-900 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-white">Progreso Semanal</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-around">
                      <Skeleton className="h-32 w-32 rounded-full" />
                      <Skeleton className="h-32 w-32 rounded-full" />
                    </div>
                  ) : stats ? (
                    <div className="flex justify-around">
                      <ProgressRing
                        percentage={stats.goalsProgress.distance.percentage}
                        label="Distancia"
                        value={`${stats.goalsProgress.distance.current}`}
                        subvalue={`/${stats.goalsProgress.distance.target} km`}
                        color="#fc5200"
                      />
                      <ProgressRing
                        percentage={stats.goalsProgress.time.percentage}
                        label="Tiempo"
                        value={`${Math.round(stats.goalsProgress.time.current / 60)}`}
                        subvalue={`/${Math.round(stats.goalsProgress.time.target / 60)} h`}
                        color="#3b82f6"
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Weekly Chart */}
              <Card className="border-zinc-800 bg-zinc-900 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">Actividad Diaria</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : stats ? (
                    <WeeklyActivityChart data={stats.dailyBreakdown} metric="distance" />
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Weekly Volume Chart */}
            <div className="mb-6">
              {weeklyVolumeLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <WeeklyVolumeChart
                  data={weeklyVolumeData}
                  title="Volumen Semanal"
                  unit="km"
                  loading={false}
                />
              )}
            </div>

            {/* Actividades Recientes y Racha */}
            <div className="mb-6 grid gap-6 lg:grid-cols-3">
              {/* Recent Activities */}
              <div className="lg:col-span-2">
                <ActivityList
                  activities={recentActivities}
                  isLoading={activitiesLoading}
                  error={activitiesError}
                  onRetry={refetchActivities}
                  onActivityClick={handleActivityClick}
                  initialLimit={10}
                  loadMoreIncrement={5}
                  cardVariant="default"
                  title="Actividades Recientes"
                  showCount={true}
                />
              </div>

              {/* Activity Streak */}
              <div className="lg:col-span-1">
                <ActivitySummaryRing activities={recentActivities} isLoading={activitiesLoading} />
              </div>
            </div>

            {/* Estado vacío o mensaje */}
            {!loading && stats && stats.summary.activityCount === 0 && (
              <Card className="animate-in fade-in border-dashed border-zinc-800 bg-zinc-900 duration-500">
                <CardContent className="p-8 text-center">
                  <p className="mb-2 text-zinc-400">No hay actividades registradas esta semana</p>
                  <p className="text-sm text-zinc-500">
                    ¡Sincroniza con Strava para ver tus estadísticas!
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
