'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';

import { ActivityList } from '@/components/activity';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { WeeklyActivityChart } from '@/components/dashboard/WeeklyActivityChart';
import { WeekSelector } from '@/components/dashboard/WeekSelector';
import { ActivitySummaryRing } from '@/components/dashboard/ActivitySummaryRing';
import { WeeklyVolumeChart } from '@/components/charts';
import { TrainingComplianceChart } from '@/components/dashboard/TrainingComplianceChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  // Activity modal state
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    name: '',
    type: 'RIDE',
    startDate: '',
    distance: '', // km
    movingTime: '', // minutes
    totalElevationGain: '', // meters
    averagePower: '',
    maxPower: '',
    normalizedPower: '',
    tss: '',
    ifValue: '',
    description: '',
  });

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

  // Activity CRUD handlers
  const openCreateActivityModal = () => {
    setEditingActivity(null);
    setActivityForm({
      name: '',
      type: 'RIDE',
      startDate: new Date().toISOString().slice(0, 10),
      distance: '',
      movingTime: '',
      totalElevationGain: '',
      averagePower: '',
      maxPower: '',
      normalizedPower: '',
      tss: '',
      ifValue: '',
      description: '',
    });
    setActivityModalOpen(true);
  };

  const openEditActivityModal = async (activity: Activity) => {
    // Fetch full activity data from API
    try {
      const response = await fetch(`/api/activities/manual/${activity.id}`);
      if (response.ok) {
        const fullActivity = await response.json();
        setEditingActivity(fullActivity);
        setActivityForm({
          name: fullActivity.name || '',
          type: fullActivity.type || 'RIDE',
          startDate: fullActivity.startDate ? fullActivity.startDate.slice(0, 10) : '',
          distance: fullActivity.distance ? (fullActivity.distance / 1000).toString() : '',
          movingTime: fullActivity.movingTime ? Math.round(fullActivity.movingTime / 60).toString() : '',
          totalElevationGain: fullActivity.totalElevationGain?.toString() || '',
          averagePower: fullActivity.averagePower?.toString() || '',
          maxPower: fullActivity.maxPower?.toString() || '',
          normalizedPower: fullActivity.normalizedPower?.toString() || '',
          tss: fullActivity.tss?.toString() || '',
          ifValue: fullActivity.ifValue?.toString() || '',
          description: fullActivity.description || '',
        });
        setActivityModalOpen(true);
      } else {
        console.error('Failed to fetch activity details');
      }
    } catch (error) {
      console.error('Error fetching activity details:', error);
    }
  };

  const closeActivityModal = () => {
    setActivityModalOpen(false);
    setEditingActivity(null);
    setActivityForm({
      name: '',
      type: 'RIDE',
      startDate: '',
      distance: '',
      movingTime: '',
      totalElevationGain: '',
      averagePower: '',
      maxPower: '',
      normalizedPower: '',
      tss: '',
      ifValue: '',
      description: '',
    });
  };

  const handleActivitySave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingActivity(true);

    const url = editingActivity
      ? `/api/activities/manual/${editingActivity.id}`
      : '/api/activities/manual';
    const method = editingActivity ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activityForm.name,
          type: activityForm.type,
          startDate: activityForm.startDate,
          distance: activityForm.distance ? Number(activityForm.distance) : null,
          movingTime: activityForm.movingTime ? Number(activityForm.movingTime) : null,
          totalElevationGain: activityForm.totalElevationGain ? Number(activityForm.totalElevationGain) : null,
          averagePower: activityForm.averagePower ? Number(activityForm.averagePower) : null,
          maxPower: activityForm.maxPower ? Number(activityForm.maxPower) : null,
          normalizedPower: activityForm.normalizedPower ? Number(activityForm.normalizedPower) : null,
          tss: activityForm.tss ? Number(activityForm.tss) : null,
          ifValue: activityForm.ifValue ? Number(activityForm.ifValue) : null,
          description: activityForm.description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save activity');
      }

      await refetchActivities();
      closeActivityModal();
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Error al guardar la actividad');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleActivityDelete = async (activity: Activity) => {
    if (!confirm('¿Seguro que quieres borrar esta actividad?')) {
      return;
    }

    try {
      const response = await fetch(`/api/activities/manual/${activity.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete activity');
      }

      await refetchActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert('Error al borrar la actividad');
    }
  };

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
    <div className="p-4 md:p-8">
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

          {/* Training Compliance Chart - TSS Plan vs Actual */}
          <div className="mb-6">
            <TrainingComplianceChart athleteId={athleteId} days={30} />
          </div>

          {/* Actividades Recientes y Racha */}
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            {/* Recent Activities */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Actividades Recientes</h3>
                <Button
                  onClick={openCreateActivityModal}
                  className="bg-[#FC4C02] hover:bg-[#e14602] text-white"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir manual
                </Button>
              </div>
              <ActivityList
                activities={recentActivities}
                isLoading={activitiesLoading}
                error={activitiesError}
                onRetry={refetchActivities}
                initialLimit={10}
                loadMoreIncrement={5}
                cardVariant="default"
                title=""
                showCount={true}
                enableManualCRUD={true}
                onEditActivity={openEditActivityModal}
                onDeleteActivity={handleActivityDelete}
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

      {/* Activity Modal */}
      {activityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h3 className="text-lg font-semibold text-white">
                {editingActivity ? 'Editar actividad' : 'Añadir actividad'}
              </h3>
              <button
                onClick={closeActivityModal}
                className="rounded-lg bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleActivitySave} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="date"
                value={activityForm.startDate}
                onChange={(e) => setActivityForm((p) => ({ ...p, startDate: e.target.value }))}
                className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                required
              />
              <input
                value={activityForm.name}
                onChange={(e) => setActivityForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nombre de la actividad"
                className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                required
              />
              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm((p) => ({ ...p, type: e.target.value }))}
                className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                <option value="RIDE">Ciclismo</option>
                <option value="RUN">Running</option>
                <option value="SWIM">Natación</option>
                <option value="VIRTUAL_RIDE">Ciclismo Virtual</option>
                <option value="WORKOUT">Entrenamiento</option>
                <option value="HIKE">Senderismo</option>
                <option value="WALK">Caminata</option>
              </select>
              <input
                type="number"
                step="0.1"
                value={activityForm.distance}
                onChange={(e) => setActivityForm((p) => ({ ...p, distance: e.target.value }))}
                placeholder="Distancia (km)"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                value={activityForm.movingTime}
                onChange={(e) => setActivityForm((p) => ({ ...p, movingTime: e.target.value }))}
                placeholder="Tiempo (minutos)"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                value={activityForm.totalElevationGain}
                onChange={(e) => setActivityForm((p) => ({ ...p, totalElevationGain: e.target.value }))}
                placeholder="Desnivel (m)"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                value={activityForm.tss}
                onChange={(e) => setActivityForm((p) => ({ ...p, tss: e.target.value }))}
                placeholder="TSS"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                step="0.01"
                value={activityForm.ifValue}
                onChange={(e) => setActivityForm((p) => ({ ...p, ifValue: e.target.value }))}
                placeholder="IF (ej: 0.75)"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                value={activityForm.averagePower}
                onChange={(e) => setActivityForm((p) => ({ ...p, averagePower: e.target.value }))}
                placeholder="Potencia media (W)"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                value={activityForm.maxPower}
                onChange={(e) => setActivityForm((p) => ({ ...p, maxPower: e.target.value }))}
                placeholder="Potencia máx (W)"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                value={activityForm.normalizedPower}
                onChange={(e) => setActivityForm((p) => ({ ...p, normalizedPower: e.target.value }))}
                placeholder="Potencia normalizada (W)"
                className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <textarea
                value={activityForm.description}
                onChange={(e) => setActivityForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Notas / descripción..."
                className="md:col-span-2 min-h-[60px] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
              <div className="md:col-span-2 flex justify-between gap-2 pt-2">
                {editingActivity && (
                  <button
                    type="button"
                    onClick={() => handleActivityDelete(editingActivity)}
                    className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-600/30"
                  >
                    Borrar
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={closeActivityModal}
                    className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingActivity}
                    className="rounded-xl bg-[#FC4C02] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e14602] disabled:opacity-60"
                  >
                    {savingActivity
                      ? 'Guardando...'
                      : editingActivity
                      ? 'Guardar cambios'
                      : 'Crear actividad'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
