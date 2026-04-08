import { prisma } from '@/lib/db';

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
  if (!athlete) throw new Error('Athlete not found');

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

export async function getTrainingDashboardData(athleteId: string) {
  const { athlete, conversation, weekPlan } = await ensureTrainingMvpData(athleteId);

  const goals = await prisma.trainingGoal.findMany({
    where: { athleteId },
    orderBy: { eventDate: 'asc' },
  });

  const weekStart = weekPlan.weekStart;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const activities = await prisma.activity.findMany({
    where: {
      athleteId,
      type: { in: ['RIDE', 'VIRTUAL_RIDE'] },
      startDate: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { startDate: 'asc' },
  });

  const plannedTSS = weekPlan.days.reduce((sum, day) => sum + (day.targetTSS || 0), 0);
  const completedDistanceKm = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
  const completedElevation = activities.reduce((sum, a) => sum + (a.totalElevationGain || 0), 0);

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
      completedActivities: activities.length,
      completedDistanceKm,
      completedElevation,
      days: weekPlan.days.map((day) => {
        const realActivities = activities.filter((activity) => {
          const a = new Date(activity.startDate);
          return a.toDateString() === new Date(day.dayDate).toDateString();
        });
        return {
          ...day,
          actualActivities: realActivities.map((activity) => ({
            id: activity.id,
            name: activity.name,
            distanceKm: ((activity.distance || 0) / 1000).toFixed(1),
            elevationM: Math.round(activity.totalElevationGain || 0),
            movingTimeMin: Math.round((activity.movingTime || 0) / 60),
            averagePower: activity.averagePower,
          })),
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
      elevationM: input.elevationM,
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

  const reply = buildFallbackTrainerReply(
    {
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
    },
    userMessage
  );

  const assistantMessage = await prisma.trainingMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: reply,
      metadata: {
        source: 'fallback-trainer',
        gatewayReady: true,
      },
    },
  });

  return assistantMessage;
}
