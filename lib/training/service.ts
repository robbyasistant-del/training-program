import { prisma } from '@/lib/db';
import { askGatewayLlm } from '@/lib/gateway-llm';
import { calculateTSS, estimateNormalizedPower } from '@/lib/fitness/tssCalculator';

type TrainerContext = {
  athleteId: string;
  athleteName?: string;
  ftp?: number | null;
  goals: Array<{ title: string; eventDate: Date; objective: string }>;
  recentMessages: Array<{ role: string; content: string }>;
  weekSummary?: {
    plannedTSS: number;
    completedActivities: number;
    totalDistanceKm: number;
  };
};

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function ensureTrainingMvpData(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: { athleteRecord: true },
  });
  if (!athlete) {
    const error = new Error('Athlete not found');
    (error as any).code = 'ATHLETE_NOT_FOUND';
    throw error;
  }

  const goalCount = await prisma.trainingGoal.count({ where: { athleteId } });
  if (goalCount === 0) {
    await prisma.trainingGoal.createMany({
      data: [
        {
          athleteId,
          title: 'Quebrantahuesos',
          eventDate: new Date('2026-06-20'),
          distanceKm: 200,
          elevationM: 3500,
          objective: 'Sub 8h, con pacing estable y sin petar en Marie Blanque',
          status: 'planned',
        },
        {
          athleteId,
          title: 'Gran Fondo local',
          eventDate: new Date('2026-05-10'),
          distanceKm: 140,
          elevationM: 2200,
          objective: 'Acabar fuerte y sostener IF controlado en puertos largos',
          status: 'planned',
        },
      ],
    });
  }

  let conversation = await prisma.trainingConversation.findFirst({
    where: { athleteId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!conversation) {
    conversation = await prisma.trainingConversation.create({
      data: {
        athleteId,
        title: 'Personal Trainer',
        messages: {
          create: [
            {
              role: 'assistant',
              content:
                'Hola. Soy tu entrenador de ciclismo. Puedo ayudarte a preparar tus objetivos, revisar tu carga semanal y ajustar el plan según tus actividades reales.',
            },
          ],
        },
      },
      include: { messages: true },
    });
  }

  const weekStart = startOfWeek(new Date());
  let weekPlan = await prisma.weeklyTrainingPlan.findUnique({
    where: { athleteId_weekStart: { athleteId, weekStart } },
    include: { days: { orderBy: { dayDate: 'asc' } } },
  });

  if (!weekPlan) {
    const defaults = [
      ['Lunes', 'Descarga / movilidad', 'Recuperación activa y core', 0.5, 25, 45, 'recovery'],
      ['Martes', 'Sweet Spot', '3x12 min en zona tempo alta', 0.84, 78, 75, 'sweet-spot'],
      ['Miércoles', 'Endurance', 'Rodaje Z2 constante', 0.68, 55, 90, 'endurance'],
      ['Jueves', 'VO2 Max', '5x4 min cuesta / rodillo', 0.92, 92, 70, 'vo2'],
      ['Viernes', 'Recuperación', 'Paseo suave o descanso total', 0.45, 20, 40, 'recovery'],
      ['Sábado', 'Tirada larga', 'Fondo con puertos, nutrición practicada', 0.75, 140, 240, 'long-ride'],
      ['Domingo', 'Tempo + cadencia', 'Bloque sostenido y técnica', 0.78, 88, 120, 'tempo'],
    ] as const;

    weekPlan = await prisma.weeklyTrainingPlan.create({
      data: {
        athleteId,
        weekStart,
        title: 'Semana Base Builder',
        focus: 'Construcción aeróbica + control de fatiga',
        days: {
          create: defaults.map((d, idx) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + idx);
            return {
              dayDate,
              weekday: idx + 1,
              title: d[1],
              description: d[2],
              targetIF: d[3],
              targetTSS: d[4],
              plannedDurationMin: d[5],
              workoutType: d[6],
            };
          }),
        },
      },
      include: { days: { orderBy: { dayDate: 'asc' } } },
    });
  }

  return { athlete, conversation, weekPlan };
}

function round1(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function formatMinutesLabel(totalMinutes: number | null | undefined) {
  if (totalMinutes == null || totalMinutes <= 0) return '--';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function buildCompletionAssessment(planned: { tss: number | null; ifValue: number | null; durationMin: number | null }, actual: { tss: number | null; ifValue: number | null; durationMin: number | null } | null) {
  if (!planned.tss && !planned.ifValue && !planned.durationMin && !actual) {
    return null;
  }

  if ((planned.tss || planned.ifValue || planned.durationMin) && !actual) {
    return {
      label: 'Sin completar',
      tone: 'slate',
      score: 0,
      summary: 'Había sesión planificada y no consta actividad registrada.',
      tssGap: planned.tss,
      ifGap: planned.ifValue,
      durationGapMin: planned.durationMin,
    };
  }

  if (!(planned.tss || planned.ifValue || planned.durationMin) && actual) {
    return {
      label: 'Sobreentrenamiento',
      tone: 'red',
      score: Infinity,
      summary: 'Hay actividad registrada en un día sin objetivo planificado.',
      tssGap: actual.tss,
      ifGap: actual.ifValue,
      durationGapMin: actual.durationMin,
    };
  }

  if (!actual) return null;

  const plannedTss = planned.tss ?? 0;
  const actualTss = actual.tss ?? 0;
  const tssRatio = plannedTss > 0 ? actualTss / plannedTss : null;
  const tssGap = actualTss - plannedTss;
  const ifGap = (actual.ifValue ?? 0) - (planned.ifValue ?? 0);
  const durationGapMin = (actual.durationMin ?? 0) - (planned.durationMin ?? 0);
  const absIfGap = Math.abs(ifGap);

  let label = 'Desviado';
  let tone = 'amber';
  let score = 60;

  if (tssRatio !== null) {
    if (tssRatio >= 0.9 && tssRatio <= 1.1 && absIfGap <= 0.05) {
      label = 'Perfecto';
      tone = 'emerald';
      score = 100;
    } else if (tssRatio >= 0.8 && tssRatio <= 1.2 && absIfGap <= 0.08) {
      label = 'Muy bien';
      tone = 'green';
      score = 88;
    } else if (tssRatio < 0.8) {
      label = 'Insuficiente';
      tone = 'amber';
      score = Math.max(35, Math.round(tssRatio * 100));
    } else if (tssRatio > 1.35 || ifGap > 0.1) {
      label = 'Sobreentrenado';
      tone = 'red';
      score = 25;
    } else if (tssRatio > 1.2) {
      label = 'Exceso controlado';
      tone = 'orange';
      score = 55;
    }
  }

  return {
    label,
    tone,
    score,
    summary:
      label === 'Perfecto'
        ? 'Carga e intensidad muy alineadas con el objetivo.'
        : label === 'Muy bien'
          ? 'Sesión bien ejecutada, con desviación pequeña.'
          : label === 'Insuficiente'
            ? 'La carga se quedó corta respecto al estímulo planificado.'
            : label === 'Sobreentrenado'
              ? 'La sesión salió claramente más exigente de lo previsto.'
              : label === 'Exceso controlado'
                ? 'Has metido más carga de la prevista, aunque aún cerca del objetivo.'
                : 'La carga total o la intensidad no se parecen del todo al objetivo.',
    tssGap: round1(tssGap),
    ifGap: round1(ifGap),
    durationGapMin,
  };
}

export async function getTrainingDashboardData(athleteId: string, monthOffset: number = 0) {
  const { athlete, conversation, weekPlan } = await ensureTrainingMvpData(athleteId);

  const goals = await prisma.trainingGoal.findMany({
    where: { athleteId },
    orderBy: { eventDate: 'asc' },
  });

  // Simple date calculation matching frontend
  const baseDate = new Date();
  baseDate.setDate(1); // First day of current month
  baseDate.setMonth(baseDate.getMonth() + monthOffset);
  baseDate.setHours(0, 0, 0, 0);
  
  // Find Monday of that week (0=Sunday, 1=Monday)
  const dayOfWeek = baseDate.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const visibleStart = new Date(baseDate);
  visibleStart.setDate(baseDate.getDate() - daysToSubtract);
  visibleStart.setHours(0, 0, 0, 0);
  
  // Load 4 weeks (28 days) + 1 week buffer for timezone safety
  const visibleEnd = new Date(visibleStart);
  visibleEnd.setDate(visibleStart.getDate() + 35);
  visibleEnd.setHours(23, 59, 59, 999);

  // Also load activities from 1 week before for safety
  const loadStart = new Date(visibleStart);
  loadStart.setDate(loadStart.getDate() - 7);

  const activities = await prisma.activity.findMany({
    where: {
      athleteId,
      type: { in: ['RIDE', 'VIRTUAL_RIDE'] },
      startDate: { gte: loadStart, lt: visibleEnd },
    },
    orderBy: { startDate: 'asc' },
  });

  const ftp = athlete.athleteRecord?.estimatedFTP || null;
  const weekStart = weekPlan.weekStart;
  const plannedTSS = weekPlan.days.reduce((sum, day) => sum + (day.targetTSS || 0), 0);
  
  // Calcular stats solo para la semana actual
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekActivities = activities.filter(a => {
    const d = new Date(a.startDate);
    return d >= weekStart && d < weekEnd;
  });
  
  const completedDistanceKm = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
  const completedElevation = weekActivities.reduce((sum, a) => sum + (a.totalElevationGain || 0), 0);

  // Helper to format date as YYYY-MM-DD
  const formatDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate 28 days (4 weeks) dynamically from visibleStart
  const visibleDays = Array.from({ length: 28 }, (_, i) => {
    const dayDate = new Date(visibleStart);
    dayDate.setDate(visibleStart.getDate() + i);
    const dateStr = formatDateStr(dayDate);
    
    // Find if there's a plan for this day
    const planDay = weekPlan.days.find((d: any) => {
      const planDateStr = d.dayDate instanceof Date 
        ? formatDateStr(d.dayDate)
        : String(d.dayDate).slice(0, 10);
      return planDateStr === dateStr;
    });

    // Find activities for this day
    const dayActivities = activities.filter((activity) => {
      const actDate = new Date(activity.startDate);
      const actDateStr = formatDateStr(actDate);
      return actDateStr === dateStr;
    });

    return { dayDate, dateStr, planDay, dayActivities };
  });

  // Calculate weekly totals for the FIRST visible week (Week 1)
  const firstWeekDays = visibleDays.slice(0, 7);
  const weeklyPlannedTSS = firstWeekDays.reduce((sum, { planDay }) => sum + (planDay?.targetTSS || 0), 0);
  const weeklyPlannedIF = firstWeekDays.reduce((sum, { planDay }) => sum + (planDay?.targetIF || 0), 0) / 7;
  const weeklyPlannedDuration = firstWeekDays.reduce((sum, { planDay }) => sum + (planDay?.plannedDurationMin || 0), 0);
  
  const weeklyActualTSS = firstWeekDays.reduce((sum, { dayActivities }) => 
    sum + dayActivities.reduce((actSum, act) => actSum + (act.tss || 0), 0), 0);
  const weeklyActualDuration = firstWeekDays.reduce((sum, { dayActivities }) => 
    sum + dayActivities.reduce((actSum, act) => actSum + Math.round((act.movingTime || 0) / 60), 0), 0);
  const weeklyActualIF = firstWeekDays.reduce((sum, { dayActivities }) => {
    const dayTotalIF = dayActivities.reduce((actSum, act) => actSum + ((act.ifValue || 0) * Math.round((act.movingTime || 0) / 60)), 0);
    const dayTotalDuration = dayActivities.reduce((actSum, act) => actSum + Math.round((act.movingTime || 0) / 60), 0);
    return dayTotalDuration > 0 ? sum + (dayTotalIF / dayTotalDuration) : sum;
  }, 0) / 7;

  return {
    athlete: {
      id: athlete.id,
      name: `${athlete.firstname} ${athlete.lastname}`,
      weight: athlete.weight,
      ftp: athlete.athleteRecord?.estimatedFTP || null,
      lastSyncAt: athlete.lastSyncAt,
    },
    goals,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
    },
    weekPlan: {
      id: weekPlan.id,
      title: weekPlan.title,
      focus: weekPlan.focus,
      weekStart: weekPlan.weekStart,
      plannedTSS,
      completedActivities: weekActivities.length, 
      completedDistanceKm,
      completedElevation,
      // Weekly totals for display in header cards
      weeklyPlannedTSS,
      weeklyPlannedIF,
      weeklyPlannedDuration,
      weeklyActualTSS,
      weeklyActualDuration,
      weeklyActualIF,
      days: visibleDays.map(({ dayDate, dateStr, planDay, dayActivities }, index) => {
        const plannedMetrics = planDay ? {
          tss: planDay.targetTSS ?? null,
          ifValue: round1(planDay.targetIF ?? null),
          durationMin: planDay.plannedDurationMin ?? null,
          durationLabel: formatMinutesLabel(planDay.plannedDurationMin ?? null),
        } : {
          tss: null,
          ifValue: null,
          durationMin: null,
          durationLabel: '--',
        };

        const actualActivities = dayActivities.map((activity) => {
          const durationMin = Math.round((activity.movingTime || 0) / 60);
          const raw = activity.rawJson && typeof activity.rawJson === 'object'
            ? (activity.rawJson as Record<string, unknown>)
            : null;
          const normalizedPower = typeof raw?.weighted_average_watts === 'number'
            ? raw.weighted_average_watts
            : activity.averagePower
              ? estimateNormalizedPower(activity.averagePower)
              : null;
          const inferredIf = ftp && normalizedPower ? normalizedPower / ftp : null;
          const calculatedTss = activity.movingTime
            ? calculateTSS({
                type: activity.type,
                durationSeconds: activity.movingTime,
                ...(activity.distance != null ? { distanceMeters: activity.distance } : {}),
                ...(activity.averagePower != null ? { averagePower: activity.averagePower } : {}),
                ...(normalizedPower != null ? { normalizedPower } : {}),
                ...(ftp != null ? { functionalThresholdPower: ftp } : {}),
                ...(activity.averageHeartrate != null ? { averageHeartrate: activity.averageHeartrate } : {}),
                ...(activity.maxHeartrate != null ? { maxHeartrate: activity.maxHeartrate } : {}),
              }).tss
            : 0;
          const effectiveTss = activity.tss ?? calculatedTss;
          const tssDerivedIf = effectiveTss && activity.movingTime
            ? Math.sqrt((effectiveTss * 3600) / (activity.movingTime * 100))
            : null;
          const resolvedIf = activity.ifValue ?? inferredIf ?? tssDerivedIf;

          return {
            id: activity.id,
            name: activity.name,
            distanceKm: ((activity.distance || 0) / 1000).toFixed(1),
            elevationM: Math.round(activity.totalElevationGain || 0),
            movingTimeMin: durationMin,
            durationLabel: formatMinutesLabel(durationMin),
            averagePower: activity.averagePower,
            tss: round1(effectiveTss),
            ifValue: round1(resolvedIf),
            source: activity.source,
          };
        });

        const aggregatedActual = actualActivities.length
          ? {
              tss: round1(actualActivities.reduce((sum, activity) => sum + (activity.tss ?? 0), 0)),
              ifValue: round1(
                actualActivities.reduce((sum, activity) => sum + ((activity.ifValue ?? 0) * activity.movingTimeMin), 0) /
                  Math.max(1, actualActivities.reduce((sum, activity) => sum + activity.movingTimeMin, 0))
              ),
              durationMin: actualActivities.reduce((sum, activity) => sum + activity.movingTimeMin, 0),
            }
          : null;

        return {
          id: planDay?.id ?? `generated-${dateStr}`,
          dayDate: dateStr,
          weekday: (index % 7) + 1,
          title: planDay?.title ?? 'Descanso',
          description: planDay?.description ?? null,
          targetIF: planDay?.targetIF ?? null,
          targetTSS: planDay?.targetTSS ?? null,
          plannedDurationMin: planDay?.plannedDurationMin ?? null,
          plannedMetrics,
          actualActivities,
          completion: buildCompletionAssessment(plannedMetrics, aggregatedActual),
        };
      }),
    },
  };
}

export async function createTrainingGoal(athleteId: string, input: {
  title: string;
  eventDate: string;
  distanceKm: number;
  elevationM?: number;
  objective: string;
}) {
  return prisma.trainingGoal.create({
    data: {
      athleteId,
      title: input.title,
      eventDate: new Date(input.eventDate),
      distanceKm: input.distanceKm,
      elevationM: input.elevationM ?? null,
      objective: input.objective,
      status: 'planned',
    },
  });
}

function buildFallbackTrainerReply(context: TrainerContext, userMessage: string) {
  const primaryGoal = context.goals[0];
  const ftpLine = context.ftp ? `Tu FTP actual estimado ronda ${context.ftp} W.` : 'Todavía no tengo FTP fiable sincronizado.';
  const goalLine = primaryGoal
    ? `Tu foco principal ahora mismo es ${primaryGoal.title} (${primaryGoal.objective}) para ${primaryGoal.eventDate.toLocaleDateString('es-ES')}.`
    : 'Aún no has definido un gran objetivo prioritario.';

  return [
    `Como entrenador, te diría esto sobre: "${userMessage}"`,
    ftpLine,
    goalLine,
    `Esta semana llevas ${context.weekSummary?.completedActivities ?? 0} salidas y ${(context.weekSummary?.totalDistanceKm ?? 0).toFixed(0)} km reales.`,
    'Mi recomendación MVP: mantén la estructura de la semana, protege las sesiones clave (sweet spot / VO2) y evita meter intensidad extra si vienes con fatiga acumulada.',
  ].join(' ');
}

export async function appendTrainerMessage(athleteId: string, userMessage: string) {
  const { athlete, conversation, weekPlan } = await ensureTrainingMvpData(athleteId);
  const goals = await prisma.trainingGoal.findMany({ where: { athleteId }, orderBy: { eventDate: 'asc' }, take: 3 });
  const recentMessages = await prisma.trainingMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const activitiesThisWeek = await prisma.activity.findMany({
    where: {
      athleteId,
      type: { in: ['RIDE', 'VIRTUAL_RIDE'] },
      startDate: { gte: weekPlan.weekStart },
    },
  });

  await prisma.trainingMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: userMessage,
    },
  });

  const context = {
    athleteId,
    athleteName: `${athlete.firstname} ${athlete.lastname}`,
    ftp: athlete.athleteRecord?.estimatedFTP || null,
    goals: goals.map((g) => ({ title: g.title, eventDate: g.eventDate, objective: g.objective })),
    recentMessages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
    weekSummary: {
      plannedTSS: weekPlan.days.reduce((sum, day) => sum + (day.targetTSS || 0), 0),
      completedActivities: activitiesThisWeek.length,
      totalDistanceKm: activitiesThisWeek.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000,
    },
  };

  let reply = '';
  let metadata: Record<string, unknown> = {
    gatewayReady: true,
  };

  try {
    const systemPrompt = [
      'Eres un entrenador personal de ciclismo, útil, directo y práctico.',
      'Responde en español natural, cercano, corto-medio, con foco en decisiones accionables.',
      'Ten en cuenta objetivos, FTP, carga semanal, fatiga y actividades reales.',
      'Si faltan datos, dilo claramente y evita inventar.',
      'Puedes sugerir ajustes de entrenamiento, pacing, recuperación, nutrición y estrategia.',
    ].join(' ');

    const contextPrompt = [
      `Atleta: ${context.athleteName}`,
      `FTP estimado: ${context.ftp ?? 'desconocido'} W`,
      `TSS planificado semana: ${context.weekSummary.plannedTSS}`,
      `Actividades completadas semana: ${context.weekSummary.completedActivities}`,
      `Distancia real semana: ${context.weekSummary.totalDistanceKm.toFixed(1)} km`,
      `Objetivos: ${context.goals.length ? context.goals.map((g) => `${g.title} (${g.objective}) ${g.eventDate.toLocaleDateString('es-ES')}`).join(' | ') : 'sin objetivos definidos'}`,
      `Contexto reciente: ${context.recentMessages.length ? context.recentMessages.reverse().map((m) => `${m.role}: ${m.content}`).join('\n') : 'sin conversación previa'}`,
    ].join('\n');

    const gateway = await askGatewayLlm([
      { role: 'system', content: systemPrompt },
      { role: 'system', content: contextPrompt },
      { role: 'user', content: userMessage },
    ]);

    reply = gateway.content?.trim();
    metadata = {
      ...metadata,
      source: 'gateway-llm',
      model: gateway.model,
      usage: gateway.usage,
    };
  } catch (error) {
    console.error('Training gateway LLM fallback:', error);
    reply = buildFallbackTrainerReply(context, userMessage);
    metadata = {
      ...metadata,
      source: 'fallback-trainer',
      fallbackReason: error instanceof Error ? error.message : 'unknown-error',
    };
  }

  const assistantMessage = await prisma.trainingMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: reply,
      metadata: metadata as any,
    },
  });

  return assistantMessage;
}
