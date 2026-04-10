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

const weekdayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
  const [weatherByDate, setWeatherByDate] = useState<Record<string, WeatherDay>>({});

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/training/dashboard');
    const payload = await response.json();
    setData(payload);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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

    const weeks = [];
    for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
      const weekStart = new Date(anchor);
      weekStart.setDate(anchor.getDate() + weekIndex * 7);

      const days = Array.from({ length: 7 }).map((_, dayIndex) => {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex);

        const sourceDay = data.weekPlan.days.find((d) => {
          const base = new Date(d.dayDate);
          return base.getDay() === dayDate.getDay() || (dayIndex === 0 && base.getDay() === 1);
        }) || data.weekPlan.days[Math.min(dayIndex, data.weekPlan.days.length - 1)];

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
          {visibleWeeks.map((week) => (
            <div key={week.label + week.weekStart.toISOString()} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{week.label}</div>
                <div className="text-xs text-zinc-500">
                  {week.weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {new Date(week.weekStart.getFullYear(), week.weekStart.getMonth(), week.weekStart.getDate() + 6).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-7 gap-3">
                {week.days.map((day, dayIndex) => (
                  <div key={day.syntheticId} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 min-h-[240px]">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-zinc-500">{weekdayLabels[dayIndex]}</div>
                        <div className="text-sm font-semibold text-white">{day.syntheticDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</div>
                      </div>
                      <WeatherInline weather={weatherByDate[day.syntheticDate.toISOString().slice(0, 10)]} />
                    </div>
                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 mb-3">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">Objetivo</div>
                      <div className="text-sm font-semibold text-white">{day.title}</div>
                      <div className="mt-1 text-xs text-zinc-400">{day.description}</div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <MetricValueCard label="IF" value={day.plannedMetrics?.ifValue ?? '--'} />
                        <MetricValueCard label="TSS" value={day.plannedMetrics?.tss ?? '--'} />
                        <MetricValueCard label="T" value={day.plannedMetrics?.durationLabel ?? '--'} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {day.actualActivities.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">Sin actividad registrada</div>
                      ) : day.actualActivities.map((activity) => (
                        <div key={`${day.syntheticId}-${activity.id}`} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-emerald-400/80 mb-2">Actividad registrada</div>
                          <div className="text-sm font-medium text-white">{activity.name}</div>
                          <div className="mt-1 text-xs text-zinc-300">{activity.distanceKm} km · {activity.durationLabel}</div>
                          <div className="text-xs text-emerald-300">{activity.elevationM} m · {activity.averagePower ? `${Math.round(activity.averagePower)} W` : 'sin potencia'}</div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <MetricValueCard label="IF" value={activity.ifValue ?? '--'} dark />
                            <MetricValueCard label="TSS" value={activity.tss ?? '--'} dark />
                            <MetricValueCard label="T" value={activity.durationLabel} dark />
                          </div>
                        </div>
                      ))}

                      {day.completion && (
                        <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 p-3">
                          <div className="mb-2 flex items-center justify-center">
                            <ResultLabel label={day.completion.label} tone={day.completion.tone} />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <MetricValueCard label="Δ TSS" value={formatDelta(day.completion.tssGap)} dark />
                            <MetricValueCard label="Δ IF" value={formatDelta(day.completion.ifGap)} dark />
                            <MetricValueCard label="Δ T" value={formatMinutesDelta(day.completion.durationGapMin)} dark />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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

      <PersonalTrainerWidget initialMessages={data.conversation.messages} />
    </div>
  );
}

function MetricValueCard({ label, value, dark = false }: { label: string; value: string | number; dark?: boolean }) {
  const valueStr = String(value);
  
  // Calculate dynamic font sizes based on text length
  const getLabelSize = (text: string): string => {
    if (text.length <= 2) return 'text-[10px]';
    if (text.length <= 3) return 'text-[9px]';
    return 'text-[8px]';
  };
  
  const getValueSize = (text: string): string => {
    if (text.length <= 3) return 'text-sm';
    if (text.length <= 5) return 'text-xs';
    if (text.length <= 7) return 'text-[10px]';
    return 'text-[9px]';
  };
  
  return (
    <div className={`rounded-lg px-2 py-2 text-center min-h-[52px] flex flex-col justify-center ${dark ? 'bg-zinc-900/70' : 'bg-zinc-800/70'}`}>
      <div className={`${getLabelSize(label)} uppercase tracking-wider text-zinc-400 mb-1`}>{label}</div>
      <div className={`${getValueSize(valueStr)} font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis`}>{value}</div>
    </div>
  );
}

function formatDelta(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '--';
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatMinutesDelta(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '--';
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}m` : `${rounded}m`;
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
