'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Bot, CalendarDays, Flag, Target, Send, Mountain, Gauge, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  actualActivities: Array<{
    id: string;
    name: string;
    distanceKm: string;
    elevationM: number;
    movingTimeMin: number;
    averagePower?: number | null;
  }>;
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

const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function TrainingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [goalForm, setGoalForm] = useState({
    title: '',
    eventDate: '',
    distanceKm: '',
    elevationM: '',
    objective: '',
  });
  const [sending, setSending] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

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

  const completionRate = useMemo(() => {
    if (!data) return 0;
    const totalPlanned = data.weekPlan.days.length;
    const completed = data.weekPlan.days.filter((d) => d.actualActivities.length > 0).length;
    return totalPlanned ? Math.round((completed / totalPlanned) * 100) : 0;
  }, [data]);

  const handleSend = async () => {
    if (!chatInput.trim()) return;
    setSending(true);
    await fetch('/api/training/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: chatInput }),
    });
    setChatInput('');
    await loadData();
    setSending(false);
  };

  const handleGoalCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoal(true);
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
    setGoalForm({ title: '', eventDate: '', distanceKm: '', elevationM: '', objective: '' });
    await loadData();
    setSavingGoal(false);
  };

  if (loading || !data) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-400">Cargando entrenamiento...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#FC4C02]/10 p-3"><Bike className="h-7 w-7 text-[#FC4C02]" /></div>
            <div>
              <h1 className="text-3xl font-bold text-white">Entrenamiento</h1>
              <p className="text-zinc-400">Coach virtual + objetivos + semana planificada vs actividad real</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          <div className="font-semibold text-white">{data.athlete.name}</div>
          <div>FTP {data.athlete.ftp ?? '--'} W · progreso semana {completionRate}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Flag className="h-5 w-5 text-emerald-400" />} title="Objetivos activos" value={String(data.goals.length)} subtitle="carreras / retos" />
        <SummaryCard icon={<Target className="h-5 w-5 text-blue-400" />} title="TSS planificado" value={String(data.weekPlan.plannedTSS)} subtitle={data.weekPlan.focus} />
        <SummaryCard icon={<CalendarDays className="h-5 w-5 text-purple-400" />} title="Ciclismo real" value={`${Math.round(data.weekPlan.completedDistanceKm)} km`} subtitle={`${data.weekPlan.completedActivities} actividades`} />
        <SummaryCard icon={<Mountain className="h-5 w-5 text-orange-400" />} title="Desnivel semana" value={`${Math.round(data.weekPlan.completedElevation)} m`} subtitle="actividad completada" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><CalendarDays className="h-5 w-5 text-[#FC4C02]" /> Semana de entrenamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
              {data.weekPlan.days.map((day, index) => (
                <div key={day.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 min-h-[240px]">
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{weekdayLabels[index]}</div>
                    <div className="text-sm font-semibold text-white">{new Date(day.dayDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-900 p-3 border border-zinc-800 mb-3">
                    <div className="text-sm font-semibold text-white">{day.title}</div>
                    <div className="mt-1 text-xs text-zinc-400">{day.description}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-zinc-800/70 p-2 text-zinc-300">IF <span className="font-semibold text-white">{day.targetIF ?? '--'}</span></div>
                      <div className="rounded-lg bg-zinc-800/70 p-2 text-zinc-300">TSS <span className="font-semibold text-white">{day.targetTSS ?? '--'}</span></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {day.actualActivities.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">Sin actividad registrada todavía</div>
                    ) : day.actualActivities.map((activity) => (
                      <div key={activity.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <div className="text-sm font-medium text-white">{activity.name}</div>
                        <div className="mt-1 text-xs text-zinc-300">{activity.distanceKm} km · {activity.movingTimeMin} min</div>
                        <div className="text-xs text-emerald-300">{activity.elevationM} m · {activity.averagePower ? `${Math.round(activity.averagePower)} W` : 'sin potencia'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Bot className="h-5 w-5 text-cyan-400" /> Personal Trainer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-2xl bg-zinc-950 p-4 border border-zinc-800">
                {data.conversation.messages.map((message) => (
                  <div key={message.id} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm ${message.role === 'assistant' ? 'bg-[#FC4C02]/10 text-zinc-100 border border-[#FC4C02]/20' : 'ml-auto bg-zinc-800 text-white border border-zinc-700'}`}>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">{message.role === 'assistant' ? 'Coach' : 'Tú'}</div>
                    {message.content}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Pregunta por el plan, tu fatiga o qué tocar hoy..."
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-[#FC4C02]"
                />
                <button onClick={handleSend} disabled={sending} className="rounded-xl bg-[#FC4C02] px-4 py-3 text-white hover:bg-[#e14602] disabled:opacity-60">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs text-zinc-500">MVP: respuesta persistida en BD y preparada para integrar gateway con contexto completo del atleta.</div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Flag className="h-5 w-5 text-pink-400" /> Objetivos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleGoalCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <input value={goalForm.title} onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))} placeholder="Evento / objetivo" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                <input type="date" value={goalForm.eventDate} onChange={(e) => setGoalForm((p) => ({ ...p, eventDate: e.target.value }))} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                <input value={goalForm.distanceKm} onChange={(e) => setGoalForm((p) => ({ ...p, distanceKm: e.target.value }))} placeholder="Distancia km" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                <input value={goalForm.elevationM} onChange={(e) => setGoalForm((p) => ({ ...p, elevationM: e.target.value }))} placeholder="Desnivel m" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                <textarea value={goalForm.objective} onChange={(e) => setGoalForm((p) => ({ ...p, objective: e.target.value }))} placeholder="Objetivo: sub 8h, pacing estable..." className="md:col-span-2 min-h-[84px] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                <button type="submit" disabled={savingGoal} className="md:col-span-2 rounded-xl bg-white text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-60">Añadir objetivo</button>
              </form>

              <div className="space-y-3">
                {data.goals.map((goal) => (
                  <div key={goal.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold">{goal.title}</div>
                        <div className="text-sm text-zinc-400">{new Date(goal.eventDate).toLocaleDateString('es-ES')} · {goal.distanceKm} km · {goal.elevationM ?? 0} m+</div>
                      </div>
                      <span className="rounded-full bg-[#FC4C02]/10 px-3 py-1 text-xs text-[#FC4C02]">{goal.status}</span>
                    </div>
                    <div className="mt-2 text-sm text-zinc-300">{goal.objective}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, value, subtitle }: { icon: React.ReactNode; title: string; value: string; subtitle: string }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-zinc-800 p-2">{icon}</div>
          <div>
            <div className="text-sm text-zinc-500">{title}</div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-zinc-400">{subtitle}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
