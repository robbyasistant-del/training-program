'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  CalendarDays,
  Flag,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PersonalTrainerWidget } from '@/components/training/PersonalTrainerWidget';
import { formatDurationMinutes } from '@/lib/utils/formatDuration';

interface Goal {
  id: string;
  title: string;
  eventDate: string;
  distanceKm: number;
  elevationM?: number | null;
  objective: string;
  status: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface TrainingDay {
  id: string;
  dayDate: string;
  weekday: number;
  title: string;
  description?: string | null;
  targetIF?: number | null;
  targetTSS?: number | null;
  plannedDurationMin?: number | null;
  plannedMetrics?: {
    tss: number | null;
    ifValue: number | null;
    durationMin: number | null;
    durationLabel: string;
  };
  completion?: {
    label: string;
    tone: string;
    score: number;
    summary: string;
    tssGap: number | null;
    ifGap: number | null;
    durationGapMin: number | null;
  } | null;
  actualActivities: Array<{
    id: string;
    name: string;
    distanceKm: string;
    elevationM: number;
    movingTimeMin: number;
    durationLabel: string;
    averagePower?: number | null;
    tss?: number | null;
    ifValue?: number | null;
    source?: string;
  }>;
}

interface WeatherDay {
  date: string;
  weatherCode: number;
  label: string;
  icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'snow' | 'storm';
  emoji: string;
  tempMax: number;
  tempMin: number;
}

interface DashboardData {
  athlete: { id: string; name: string; ftp: number | null; weight: number | null; lastSyncAt: string | null };
  goals: Goal[];
  conversation: { id: string; title: string; messages: Message[] };
  weekPlan: {
    id: string;
    title: string;
    focus: string;
    weekStart: string;
    plannedTSS: number;
    completedActivities: number;
    completedDistanceKm: number;
    completedElevation: number;
    days: TrainingDay[];
  };
}

const weekdayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const emptyGoalForm = {
  title: '',
  eventDate: '',
  distanceKm: '',
  elevationM: '',
  objective: '',
};

export default function TrainingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalForm, setGoalForm] = useState(emptyGoalForm);
  const [savingGoal, setSavingGoal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayForm, setDayForm] = useState({
    dayDate: '',
    title: '',
    description: '',
    targetTSS: '',
    targetIF: '',
    plannedDurationMin: '',
  });
  const [editingDay, setEditingDay] = useState<TrainingDay | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  
  // Activity form state
  const [activityForm, setActivityForm] = useState({
    id: '',
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
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  
  const [weatherByDate, setWeatherByDate] = useState<Record<string, WeatherDay>>({});

  const loadData = async () => {
    setLoading(true);
    const response = await fetch(`/api/training/dashboard?monthOffset=${monthOffset}`);
    
    // Handle 401 - athlete not found or unauthorized
    if (response.status === 401) {
      // Redirect to login page
      window.location.href = '/login';
      return;
    }
    
    const payload = await response.json();
    setData(payload);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [monthOffset]);

  useEffect(() => {
    async function loadWeather() {
      try {
        const response = await fetch('/api/weather/madrid');
        if (!response.ok) return;
        const payload = await response.json();
        const nextMap: Record<string, WeatherDay> = {};
        for (const day of payload.days || []) {
          nextMap[day.date] = day;
        }
        setWeatherByDate(nextMap);
      } catch (error) {
        console.error('Weather load error:', error);
      }
    }

    loadWeather();
  }, []);

  const completionRate = useMemo(() => {
    if (!data) return 0;
    const totalPlanned = data.weekPlan.days.length;
    const completed = data.weekPlan.days.filter((d) => d.actualActivities.length > 0).length;
    return totalPlanned ? Math.round((completed / totalPlanned) * 100) : 0;
  }, [data]);

  const visibleWeeks = useMemo(() => {
    if (!data) return [];

    const anchor = new Date(data.weekPlan.weekStart);
    anchor.setMonth(anchor.getMonth() + monthOffset);
    
    // Find the Monday of the week containing the anchor date
    const dayOfWeek = anchor.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    anchor.setDate(anchor.getDate() + diffToMonday);

    const weeks = [];
    for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
      const weekStart = new Date(anchor);
      weekStart.setDate(anchor.getDate() + weekIndex * 7);

      const days = Array.from({ length: 7 }).map((_, dayIndex) => {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex);
        
        const dateStr = dayDate.toISOString().slice(0, 10);

        const sourceDay = data.weekPlan.days.find((d) => {
          return d.dayDate.slice(0, 10) === dateStr;
        });

        if (!sourceDay) {
          return {
            id: `empty-${dateStr}`,
            dayDate: dateStr,
            weekday: (dayIndex + 1) % 7 || 7,
            title: 'Descanso',
            description: null,
            targetIF: null,
            targetTSS: null,
            plannedDurationMin: null,
            plannedMetrics: { tss: null, ifValue: null, durationMin: null, durationLabel: '--' },
            completion: null,
            actualActivities: [],
            syntheticDate: dayDate,
            syntheticId: `empty-${dateStr}`,
          };
        }

        return {
          ...sourceDay,
          syntheticDate: dayDate,
          syntheticId: `${weekIndex}-${dayIndex}-${sourceDay.id}`,
        };
      });

      weeks.push({
        label: `Semana ${weekIndex + 1}`,
        weekStart,
        days,
      });
    }

    return weeks;
  }, [data, monthOffset]);

  const currentMonthLabel = useMemo(() => {
    if (!data) return '';
    const base = new Date(data.weekPlan.weekStart);
    base.setMonth(base.getMonth() + monthOffset);
    return base.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }, [data, monthOffset]);

  const openCreateModal = () => {
    setGoalForm(emptyGoalForm);
    setEditingGoalId(null);
    setModalMode('create');
  };

  const openEditModal = (goal: Goal) => {
    setGoalForm({
      title: goal.title,
      eventDate: goal.eventDate.slice(0, 10),
      distanceKm: String(goal.distanceKm),
      elevationM: goal.elevationM ? String(goal.elevationM) : '',
      objective: goal.objective,
    });
    setEditingGoalId(goal.id);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm);
  };

  const handleGoalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoal(true);

    if (modalMode === 'create') {
      await fetch('/api/training/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goalForm.title,
          eventDate: goalForm.eventDate,
          distanceKm: Number(goalForm.distanceKm),
          elevationM: goalForm.elevationM ? Number(goalForm.elevationM) : null,
          objective: goalForm.objective,
        }),
      });
    } else if (modalMode === 'edit' && editingGoalId) {
      await fetch('/api/training/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGoalId,
          title: goalForm.title,
          eventDate: goalForm.eventDate,
          distanceKm: Number(goalForm.distanceKm),
          elevationM: goalForm.elevationM ? Number(goalForm.elevationM) : null,
          objective: goalForm.objective,
        }),
      });
    }

    await loadData();
    setSavingGoal(false);
    closeModal();
  };

  const handleGoalDelete = async () => {
    if (!goalToDelete) return;
    await fetch(`/api/training/goals?id=${goalToDelete.id}`, { method: 'DELETE' });
    await loadData();
    setGoalToDelete(null);
  };

  // Day management functions
  const openDayModal = (day?: TrainingDay) => {
    if (day && day.id && !day.id.startsWith('empty-')) {
      setEditingDay(day);
      setDayForm({
        dayDate: day.dayDate.slice(0, 10),
        title: day.title || '',
        description: day.description || '',
        targetTSS: day.plannedMetrics?.tss?.toString() || '',
        targetIF: day.plannedMetrics?.ifValue?.toString() || '',
        plannedDurationMin: day.plannedMetrics?.durationMin?.toString() || '',
      });
    } else {
      setEditingDay(null);
      setDayForm({
        dayDate: day?.dayDate.slice(0, 10) || '',
        title: '',
        description: '',
        targetTSS: '',
        targetIF: '',
        plannedDurationMin: '',
      });
    }
    setDayModalOpen(true);
  };

  const closeDayModal = () => {
    setDayModalOpen(false);
    setEditingDay(null);
    setDayForm({
      dayDate: '',
      title: '',
      description: '',
      targetTSS: '',
      targetIF: '',
      plannedDurationMin: '',
    });
  };

  const handleDaySave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDay(true);

    await fetch('/api/training/days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayDate: dayForm.dayDate,
        title: dayForm.title,
        description: dayForm.description,
        targetTSS: dayForm.targetTSS ? Number(dayForm.targetTSS) : null,
        targetIF: dayForm.targetIF ? Number(dayForm.targetIF) : null,
        plannedDurationMin: dayForm.plannedDurationMin ? Number(dayForm.plannedDurationMin) : null,
      }),
    });

    await loadData();
    setSavingDay(false);
    closeDayModal();
  };

  const handleDayDelete = async () => {
    if (!editingDay || !editingDay.id) return;
    await fetch(`/api/training/days?id=${editingDay.id}`, { method: 'DELETE' });
    await loadData();
    closeDayModal();
  };

  // Activity management functions
  const openActivityModal = async (dayDate: string, activity?: any) => {
    if (activity && activity.id) {
      // Fetch full activity data from API to ensure all fields are loaded
      try {
        const response = await fetch(`/api/activities/manual/${activity.id}`);
        if (response.ok) {
          const fullActivity = await response.json();
          setEditingActivity(fullActivity);
          setActivityForm({
            id: fullActivity.id,
            name: fullActivity.name || '',
            type: fullActivity.type || 'RIDE',
            startDate: fullActivity.startDate ? fullActivity.startDate.slice(0, 10) : dayDate,
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
        } else {
          // Fallback to provided activity data
          setEditingActivity(activity);
          setActivityForm({
            id: activity.id,
            name: activity.name || '',
            type: activity.type || 'RIDE',
            startDate: activity.startDate ? activity.startDate.slice(0, 10) : dayDate,
            distance: activity.distance ? (activity.distance / 1000).toString() : '',
            movingTime: activity.movingTime ? Math.round(activity.movingTime / 60).toString() : '',
            totalElevationGain: activity.totalElevationGain?.toString() || '',
            averagePower: activity.averagePower?.toString() || '',
            maxPower: activity.maxPower?.toString() || '',
            normalizedPower: activity.normalizedPower?.toString() || '',
            tss: activity.tss?.toString() || '',
            ifValue: activity.ifValue?.toString() || '',
            description: activity.description || '',
          });
        }
      } catch (error) {
        console.error('Error fetching activity details:', error);
        // Fallback to provided activity data
        setEditingActivity(activity);
        setActivityForm({
          id: activity.id,
          name: activity.name || '',
          type: activity.type || 'RIDE',
          startDate: activity.startDate ? activity.startDate.slice(0, 10) : dayDate,
          distance: activity.distance ? (activity.distance / 1000).toString() : '',
          movingTime: activity.movingTime ? Math.round(activity.movingTime / 60).toString() : '',
          totalElevationGain: activity.totalElevationGain?.toString() || '',
          averagePower: activity.averagePower?.toString() || '',
          maxPower: activity.maxPower?.toString() || '',
          normalizedPower: activity.normalizedPower?.toString() || '',
          tss: activity.tss?.toString() || '',
          ifValue: activity.ifValue?.toString() || '',
          description: activity.description || '',
        });
      }
    } else {
      setEditingActivity(null);
      setActivityForm({
        id: '',
        name: '',
        type: 'RIDE',
        startDate: dayDate,
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
    }
    setActivityModalOpen(true);
  };

  const closeActivityModal = () => {
    setActivityModalOpen(false);
    setEditingActivity(null);
    setActivityForm({
      id: '',
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

    await fetch(url, {
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

    await loadData();
    setSavingActivity(false);
    closeActivityModal();
  };

  const handleActivityDelete = async () => {
    if (!editingActivity || !editingActivity.id) return;
    await fetch(`/api/activities/manual/${editingActivity.id}`, { method: 'DELETE' });
    await loadData();
    closeActivityModal();
  };

  const isBeforeToday = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  if (loading || !data) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-400">Cargando entrenamiento...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#FC4C02]/10 p-3"><Bike className="h-7 w-7 text-[#FC4C02]" /></div>
          <div>
            <h1 className="text-3xl font-bold text-white">Entrenamiento</h1>
            <p className="text-zinc-400">Objetivos, coach virtual y calendario semanal multi-semana</p>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          <div className="font-semibold text-white">{data.athlete.name}</div>
          <div>FTP {data.athlete.ftp ?? '--'} W · progreso semana {completionRate}%</div>
        </div>
      </div>

      {/* 1. OBJETIVOS */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white"><Flag className="h-5 w-5 text-pink-400" /> Objetivos</CardTitle>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-xl bg-[#FC4C02] px-4 py-2 text-sm font-medium text-white hover:bg-[#e14602]">
            <Plus className="h-4 w-4" /> Añadir objetivo
          </button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="pb-3 pr-4">Objetivo</th>
                  <th className="pb-3 pr-4">Fecha</th>
                  <th className="pb-3 pr-4">Distancia</th>
                  <th className="pb-3 pr-4">Desnivel</th>
                  <th className="pb-3 pr-4">Meta</th>
                  <th className="pb-3 pr-4">Estado</th>
                  <th className="pb-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.goals.map((goal) => (
                  <tr key={goal.id} className="border-b border-zinc-900 text-zinc-200">
                    <td className="py-4 pr-4 font-medium text-white">{goal.title}</td>
                    <td className="py-4 pr-4">{new Date(goal.eventDate).toLocaleDateString('es-ES')}</td>
                    <td className="py-4 pr-4">{goal.distanceKm} km</td>
                    <td className="py-4 pr-4">{goal.elevationM ?? 0} m+</td>
                    <td className="py-4 pr-4 max-w-[320px] text-zinc-400">{goal.objective}</td>
                    <td className="py-4 pr-4"><span className="rounded-full bg-[#FC4C02]/10 px-3 py-1 text-xs text-[#FC4C02]">{goal.status}</span></td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(goal)} className="rounded-lg bg-zinc-800 p-2 text-zinc-200 hover:bg-zinc-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setGoalToDelete(goal)} className="rounded-lg bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. CALENDARIO */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-white"><CalendarDays className="h-5 w-5 text-[#FC4C02]" /> Calendario de entrenamiento</CardTitle>
          <div className="flex items-center gap-3">
            <button onClick={() => setMonthOffset((m) => m - 1)} className="rounded-xl bg-zinc-800 p-2 text-zinc-200 hover:bg-zinc-700"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-[180px] text-center text-sm font-medium capitalize text-white">{currentMonthLabel}</div>
            <button onClick={() => setMonthOffset((m) => m + 1)} className="rounded-xl bg-zinc-800 p-2 text-zinc-200 hover:bg-zinc-700"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleWeeks.map((week) => {
            // Calculate weekly planned totals (all 7 days)
            const weeklyPlannedTSS = week.days.reduce((sum, day) => sum + (day.plannedMetrics?.tss ?? 0), 0);
            const weeklyPlannedIF = week.days.reduce((sum, day) => sum + (day.plannedMetrics?.ifValue ?? 0), 0) / 7;
            const weeklyPlannedDuration = week.days.reduce((sum, day) => sum + (day.plannedMetrics?.durationMin ?? 0), 0);
            
            // Calculate weekly actual totals (all activities in the week)
            const weeklyActualTSS = week.days.reduce((sum, day) => 
              sum + day.actualActivities.reduce((actSum, act) => actSum + (act.tss ?? 0), 0), 0
            );
            const weeklyActualIF = week.days.reduce((sum, day) => 
              sum + (day.actualActivities.length > 0 
                ? day.actualActivities.reduce((actSum, act) => actSum + (act.ifValue ?? 0), 0) / day.actualActivities.length 
                : 0), 0
            ) / 7;
            const weeklyActualDuration = week.days.reduce((sum, day) => 
              sum + day.actualActivities.reduce((actSum, act) => actSum + (act.movingTimeMin ?? 0), 0), 0
            );
            
            // Calculate completion percentage
            const weeklyCompletionPercent = weeklyPlannedTSS > 0 
              ? Math.round((weeklyActualTSS / weeklyPlannedTSS) * 100) 
              : 0;
            
            // Determine label and tone based on completion percentage
            let weeklyLabel = 'Completado';
            let weeklyTone = 'emerald';
            
            if (weeklyCompletionPercent === 0) {
              weeklyLabel = 'No Realizado';
              weeklyTone = 'red';
            } else if (weeklyCompletionPercent < 70) {
              weeklyLabel = 'Insuficiente';
              weeklyTone = 'red';
            } else if (weeklyCompletionPercent >= 70 && weeklyCompletionPercent < 90) {
              weeklyLabel = 'Corto';
              weeklyTone = 'amber';
            } else if (weeklyCompletionPercent >= 90 && weeklyCompletionPercent < 110) {
              weeklyLabel = 'Perfecto';
              weeklyTone = 'green';
            } else if (weeklyCompletionPercent >= 110 && weeklyCompletionPercent < 125) {
              weeklyLabel = 'Fatiga';
              weeklyTone = 'orange';
            } else if (weeklyCompletionPercent >= 125) {
              weeklyLabel = 'Sobreentrenamiento';
              weeklyTone = 'red';
            }
            
            return (
            <div key={week.label + week.weekStart.toISOString()} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-semibold text-white">{week.label}</div>
                  <div className="text-xs text-zinc-500">
                    {week.weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {new Date(week.weekStart.getFullYear(), week.weekStart.getMonth(), week.weekStart.getDate() + 6).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  {/* Weekly Objective Card */}
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 min-w-[200px]">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2 text-center">Objetivo Semanal</div>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-400 uppercase">TSS</div>
                      <div className="text-sm font-semibold text-white">{weeklyPlannedTSS > 0 ? Math.round(weeklyPlannedTSS) : '--'}</div>
                    </div>
                    <div className="w-px h-8 bg-zinc-700"></div>
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-400 uppercase">IF</div>
                      <div className="text-sm font-semibold text-white">{weeklyPlannedIF > 0 ? weeklyPlannedIF.toFixed(2) : '--'}</div>
                    </div>
                    <div className="w-px h-8 bg-zinc-700"></div>
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-400 uppercase">T</div>
                      <div className="text-sm font-semibold text-white">{formatDurationMinutes(weeklyPlannedDuration)}</div>
                    </div>
                  </div>
                </div>
                
                {/* Weekly Progress Card */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 min-w-[200px]">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-400/80 mb-2 text-center">Realizado</div>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-400 uppercase">TSS</div>
                      <div className="text-sm font-semibold text-white">{weeklyActualTSS > 0 ? Math.round(weeklyActualTSS) : '--'}</div>
                    </div>
                    <div className="w-px h-8 bg-emerald-500/30"></div>
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-400 uppercase">IF</div>
                      <div className="text-sm font-semibold text-white">{weeklyActualIF > 0 ? weeklyActualIF.toFixed(2) : '--'}</div>
                    </div>
                    <div className="w-px h-8 bg-emerald-500/30"></div>
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-400 uppercase">T</div>
                      <div className="text-sm font-semibold text-white">{formatDurationMinutes(weeklyActualDuration)}</div>
                    </div>
                  </div>
                </div>
                
                  {/* Weekly Evaluation Card */}
                  <div className={`rounded-xl border p-3 min-w-[120px] flex flex-col items-center justify-center ${
                    weeklyTone === 'red'
                      ? 'border-red-500/30 bg-red-500/10'
                      : weeklyTone === 'amber'
                        ? 'border-amber-500/30 bg-amber-500/10'
                        : weeklyTone === 'orange'
                          ? 'border-orange-500/30 bg-orange-500/10'
                          : 'border-emerald-500/30 bg-emerald-500/10'
                  }`}>
                    <ResultLabel label={weeklyLabel} tone={weeklyTone} />
                    <div className="mt-1 text-lg font-bold text-white">{weeklyCompletionPercent}%</div>
                  </div>
                </div>
              </div>
              
              {/* Table Layout: 4 rows x 7 columns */}
              <div className="space-y-3">
                {/* Row 1: Headers */}
                <div className="grid grid-cols-7 gap-3">
                  {week.days.map((day, dayIndex) => (
                    <div key={`header-${day.syntheticId}`} className="text-center">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">{weekdayLabels[dayIndex]}</div>
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-sm font-semibold text-white">{day.syntheticDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</div>
                        <WeatherInline weather={weatherByDate[day.syntheticDate.toISOString().slice(0, 10)]} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 2: Objetivo cards */}
                <div className="grid grid-cols-7 gap-3">
                  {week.days.map((day) => (
                    <div key={`obj-${day.syntheticId}`} className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 h-[160px] flex flex-col relative group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[11px] uppercase tracking-wide text-zinc-500">Objetivo</div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openDayModal(day)}
                            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                            title="Editar día"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          {day.id && !day.id.startsWith('empty-') && (
                            <button
                              onClick={() => openDayModal(day)}
                              className="p-1 rounded bg-zinc-800 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              title="Borrar día"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-white line-clamp-2">{day.title}</div>
                      <div className="mt-1 text-xs text-zinc-400 line-clamp-1">{day.description}</div>
                      <div className="mt-auto grid grid-cols-3 gap-2 text-xs">
                        <MetricValueCard label="TSS" value={day.plannedMetrics?.tss ? Math.round(day.plannedMetrics.tss) : '--'} />
                        <MetricValueCard label="IF" value={day.plannedMetrics?.ifValue ?? '--'} />
                        <MetricValueCard label="T" value={day.plannedMetrics?.durationMin ?? '--'} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 3: Actividad/Entrenamiento Realizado cards */}
                <div className="grid grid-cols-7 gap-3">
                  {week.days.map((day) => {
                    // Calculate totals for display
                    const totalTSS = day.actualActivities.reduce((sum, act) => sum + (act.tss ?? 0), 0);
                    const totalIF = day.actualActivities.length > 0 
                      ? day.actualActivities.reduce((sum, act) => sum + (act.ifValue ?? 0), 0) / day.actualActivities.length 
                      : 0;
                    const totalDuration = day.actualActivities.reduce((sum, act) => sum + (act.movingTimeMin ?? 0), 0);
                    
                    return (
                      <div key={`act-${day.syntheticId}`} className="h-[160px]">
                        {day.actualActivities.length === 0 ? (
                          // SIN ACTIVIDAD - Siempre muestra ficha vacía con botón de añadir
                          <div className="rounded-xl border border-dashed border-zinc-700 p-3 h-full flex flex-col items-center justify-center text-xs text-zinc-500 group hover:border-zinc-600 transition-colors">
                            <span>Sin actividad</span>
                            <button
                              onClick={() => openActivityModal(day.dayDate.slice(0, 10))}
                              className="mt-2 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-500/30"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Añadir</span>
                            </button>
                          </div>
                        ) : day.actualActivities.length === 1 ? (
                          // UNA SOLA ACTIVIDAD - Con iconos de editar/borrar si es MANUAL
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 h-full flex flex-col relative group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-[11px] uppercase tracking-wide text-emerald-400/80">Actividad</div>
                              {day.actualActivities[0].source === 'MANUAL' && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => openActivityModal(day.dayDate.slice(0, 10), day.actualActivities[0])}
                                    className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                                    title="Editar actividad"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('¿Seguro que quieres borrar esta actividad?')) {
                                        openActivityModal(day.dayDate.slice(0, 10), day.actualActivities[0]);
                                        setTimeout(() => handleActivityDelete(), 100);
                                      }
                                    }}
                                    className="p-1 rounded bg-zinc-800 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                    title="Borrar actividad"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-medium text-white line-clamp-1">{day.actualActivities[0].name}</div>
                            <div className="mt-1 text-xs text-zinc-300">{day.actualActivities[0].distanceKm} km</div>
                            <div className="text-xs text-emerald-300">{day.actualActivities[0].elevationM} m</div>
                            <div className="mt-auto grid grid-cols-3 gap-2 text-xs">
                              <MetricValueCard label="TSS" value={day.actualActivities[0].tss ?? '--'} dark />
                              <MetricValueCard label="IF" value={day.actualActivities[0].ifValue ?? '--'} dark />
                              <MetricValueCard label="T" value={day.actualActivities[0].movingTimeMin ?? '--'} dark />
                            </div>
                          </div>
                        ) : (
                          // MÚLTIPLES ACTIVIDADES
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 h-full flex flex-col">
                            <div className="text-[11px] uppercase tracking-wide text-emerald-400/80 mb-2">{day.actualActivities.length} actividades</div>
                            <div className="text-sm font-medium text-white line-clamp-1">
                              {day.actualActivities.reduce((sum, act) => sum + parseFloat(String(act.distanceKm || 0)), 0).toFixed(1)} km
                            </div>
                            <div className="text-xs text-emerald-300">
                              {day.actualActivities.reduce((sum, act) => sum + (act.elevationM || 0), 0)} m
                            </div>
                            <div className="mt-auto grid grid-cols-3 gap-2 text-xs">
                              <MetricValueCard label="TSS" value={totalTSS > 0 ? Math.round(totalTSS) : '--'} dark />
                              <MetricValueCard label="IF" value={totalIF || '--'} dark />
                              <MetricValueCard label="T" value={totalDuration > 0 ? totalDuration : '--'} dark />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Row 4: Resultado cards */}
                <div className="grid grid-cols-7 gap-3">
                  {week.days.map((day) => {
                    const plannedTSS = day.plannedMetrics?.tss ?? 0;
                    const plannedIF = day.plannedMetrics?.ifValue ?? 0;
                    const plannedDuration = day.plannedMetrics?.durationMin ?? 0;
                    
                    // Get actual values from activity (sum if multiple)
                    const actualTSS = day.actualActivities.reduce((sum, act) => sum + (act.tss ?? 0), 0);
                    const actualIF = day.actualActivities.length > 0 
                      ? day.actualActivities.reduce((sum, act) => sum + (act.ifValue ?? 0), 0) / day.actualActivities.length 
                      : 0;
                    const actualDuration = day.actualActivities.reduce((sum, act) => sum + (act.movingTimeMin ?? 0), 0);
                    
                    // Calculate completion percentage based on TSS
                    const completionPercent = plannedTSS > 0 ? Math.round((actualTSS / plannedTSS) * 100) : 0;
                    
                    // Determine label and tone based on completion percentage
                    let resultLabel = 'Completado';
                    let resultTone = 'emerald';
                    
                    if (actualTSS === 0) {
                      resultLabel = 'No Realizado';
                      resultTone = 'red';
                    } else if (completionPercent < 70) {
                      resultLabel = 'Insuficiente';
                      resultTone = 'red';
                    } else if (completionPercent >= 70 && completionPercent < 90) {
                      resultLabel = 'Corto';
                      resultTone = 'amber';
                    } else if (completionPercent >= 90 && completionPercent < 110) {
                      resultLabel = 'Perfecto';
                      resultTone = 'green';
                    } else if (completionPercent >= 110 && completionPercent < 125) {
                      resultLabel = 'Fatiga';
                      resultTone = 'orange';
                    } else if (completionPercent >= 125) {
                      resultLabel = 'Sobreentrenamiento';
                      resultTone = 'red';
                    }
                    
                    const hasData = day.actualActivities.length > 0;
                    
                    return (
                      <div key={`res-${day.syntheticId}`} className="h-[80px]">
                        {hasData ? (
                          <div className={`rounded-xl border p-3 h-full flex items-center justify-center ${
                            resultTone === 'red'
                              ? 'border-red-500/30 bg-red-500/10'
                              : resultTone === 'amber'
                                ? 'border-amber-500/30 bg-amber-500/10'
                                : resultTone === 'orange'
                                  ? 'border-orange-500/30 bg-orange-500/10'
                                  : 'border-emerald-500/30 bg-emerald-500/10'
                          }`}>
                            <div className="flex items-center gap-2">
                              <ResultLabel label={resultLabel} tone={resultTone} />
                              <span className="text-sm font-semibold text-white">{completionPercent}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-zinc-800 p-3 h-full flex items-center justify-center text-xs text-zinc-600">
                            --
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            );
          })}
        </CardContent>
      </Card>

      {modalMode && (
        <Modal onClose={closeModal} title={modalMode === 'create' ? 'Añadir objetivo' : 'Editar objetivo'}>
          <form onSubmit={handleGoalSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={goalForm.title} onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))} placeholder="Evento / objetivo" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
            <input type="date" value={goalForm.eventDate} onChange={(e) => setGoalForm((p) => ({ ...p, eventDate: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
            <input value={goalForm.distanceKm} onChange={(e) => setGoalForm((p) => ({ ...p, distanceKm: e.target.value }))} placeholder="Distancia km" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
            <input value={goalForm.elevationM} onChange={(e) => setGoalForm((p) => ({ ...p, elevationM: e.target.value }))} placeholder="Desnivel m" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
            <textarea value={goalForm.objective} onChange={(e) => setGoalForm((p) => ({ ...p, objective: e.target.value }))} placeholder="Objetivo: sub 8h, pacing estable..." className="md:col-span-2 min-h-[110px] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700">Cancelar</button>
              <button type="submit" disabled={savingGoal} className="rounded-xl bg-[#FC4C02] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e14602] disabled:opacity-60">{modalMode === 'create' ? 'Crear objetivo' : 'Guardar cambios'}</button>
            </div>
          </form>
        </Modal>
      )}

      {goalToDelete && (
        <Modal onClose={() => setGoalToDelete(null)} title="Borrar objetivo">
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">¿Seguro que quieres borrar <span className="font-semibold text-white">{goalToDelete.title}</span>?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGoalToDelete(null)} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700">Cancelar</button>
              <button onClick={handleGoalDelete} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">Borrar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Day Edit/Create Modal */}
      {dayModalOpen && (
        <Modal onClose={closeDayModal} title={editingDay ? 'Editar día' : 'Añadir día'}>
          <form onSubmit={handleDaySave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input 
              type="date" 
              value={dayForm.dayDate} 
              onChange={(e) => setDayForm((p) => ({ ...p, dayDate: e.target.value }))}
              className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              required
            />
            <input 
              value={dayForm.title} 
              onChange={(e) => setDayForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Título (ej: Entrenamiento largo)"
              className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <textarea 
              value={dayForm.description} 
              onChange={(e) => setDayForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Descripción del entrenamiento..."
              className="md:col-span-2 min-h-[80px] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <input 
              type="number"
              value={dayForm.targetTSS} 
              onChange={(e) => setDayForm((p) => ({ ...p, targetTSS: e.target.value }))}
              placeholder="TSS objetivo"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <input 
              type="number"
              step="0.01"
              value={dayForm.targetIF} 
              onChange={(e) => setDayForm((p) => ({ ...p, targetIF: e.target.value }))}
              placeholder="IF objetivo (ej: 0.75)"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <input 
              type="number"
              value={dayForm.plannedDurationMin} 
              onChange={(e) => setDayForm((p) => ({ ...p, plannedDurationMin: e.target.value }))}
              placeholder="Duración (minutos)"
              className="md:col-span-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <div className="md:col-span-2 flex justify-between gap-2 pt-2">
              {editingDay && editingDay.id && !editingDay.id.startsWith('empty-') && (
                <button 
                  type="button" 
                  onClick={handleDayDelete}
                  className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-600/30"
                >
                  Borrar
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button 
                  type="button" 
                  onClick={closeDayModal}
                  className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={savingDay}
                  className="rounded-xl bg-[#FC4C02] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e14602] disabled:opacity-60"
                >
                  {editingDay ? 'Guardar cambios' : 'Crear día'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Activity Edit/Create Modal */}
      {activityModalOpen && (
        <Modal onClose={closeActivityModal} title={editingActivity ? 'Editar actividad' : 'Añadir actividad'}>
          <form onSubmit={handleActivitySave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  onClick={handleActivityDelete}
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
                  {editingActivity ? 'Guardar cambios' : 'Crear actividad'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      <PersonalTrainerWidget initialMessages={data.conversation.messages} />
    </div>
  );
}

function MetricValueCard({ label, value, dark = false }: { label: string; value: string | number; dark?: boolean }) {
  // Format the display value
  const displayValue = label === 'T' 
    ? formatDurationMinutes(value)
    : (value === 0 || value === '0' || value === null || value === undefined || value === '' ? '--' : String(value));
  
  const labelStr = String(label);
  
  const getLabelSize = (text: string): string => {
    const len = text.length;
    if (len <= 2) return 'text-[11px]';
    if (len <= 3) return 'text-[10px]';
    if (len <= 4) return 'text-[9px]';
    return 'text-[8px]';
  };
  
  const getValueSize = (text: string): string => {
    const len = text.length;
    if (len <= 2) return 'text-base';
    if (len <= 3) return 'text-sm';
    if (len <= 5) return 'text-xs';
    if (len <= 7) return 'text-[10px]';
    return 'text-[9px]';
  };
  
  return (
    <div className={`rounded-lg px-1 py-2 text-center min-h-[52px] flex flex-col justify-center ${dark ? 'bg-zinc-900/70' : 'bg-zinc-800/70'}`}>
      <div 
        className={`${getLabelSize(labelStr)} uppercase tracking-wider text-zinc-400 mb-1 leading-none truncate`}
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {label}
      </div>
      <div 
        className={`${getValueSize(displayValue)} font-semibold text-white leading-none truncate`}
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {displayValue}
      </div>
    </div>
  );
}

function ResultLabel({ label, tone }: { label: string; tone: string }) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
      : tone === 'green'
        ? 'bg-green-500/15 text-green-300 border-green-500/20'
        : tone === 'amber'
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
          : tone === 'orange'
            ? 'bg-orange-500/15 text-orange-300 border-orange-500/20'
            : tone === 'red'
              ? 'bg-red-500/15 text-red-300 border-red-500/20'
              : tone === 'blue'
                ? 'bg-blue-500/15 text-blue-300 border-blue-500/20'
                : 'bg-zinc-700/40 text-zinc-300 border-zinc-600';

  return <div className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>{label}</div>;
}

function WeatherInline({ weather }: { weather?: WeatherDay }) {
  if (!weather) return null;

  const Icon =
    weather.icon === 'sun'
      ? Sun
      : weather.icon === 'cloud-sun'
        ? CloudSun
        : weather.icon === 'rain'
          ? CloudRain
          : weather.icon === 'snow'
            ? CloudSnow
            : weather.icon === 'storm'
              ? CloudLightning
              : Cloud;

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300">
      <Icon className="h-3.5 w-3.5 text-sky-400" />
      <span className="text-zinc-400">{weather.tempMin}°/{weather.tempMax}°</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
