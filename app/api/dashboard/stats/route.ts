import { NextRequest, NextResponse } from 'next/server';
import { startOfWeek, endOfWeek, format, subWeeks, addWeeks } from 'date-fns';
import { prisma } from '@/lib/db';

/**
 * GET /api/dashboard/stats
 *
 * Devuelve estadísticas semanales de entrenamiento para el dashboard.
 *
 * Query params:
 * - weekOffset: número de semanas a desplazar (0 = semana actual, -1 = semana pasada, 1 = próxima semana)
 * - athleteId: ID del atleta (opcional, usa el atleta autenticado por defecto)
 *
 * Response:
 * {
 *   week: { start, end, label },
 *   summary: { totalDistance, totalTime, totalElevation, activityCount, avgSpeed },
 *   dailyBreakdown: [...],
 *   goalsProgress: {...}
 * }
 */

export interface WeeklyStatsResponse {
  week: {
    start: string;
    end: string;
    label: string;
  };
  summary: {
    totalDistance: number; // km
    totalTime: number; // segundos
    totalElevation: number; // metros
    activityCount: number;
    avgSpeed: number; // km/h
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Obtener query params
    const { searchParams } = new URL(request.url);
    const weekOffset = parseInt(searchParams.get('weekOffset') || '0', 10);
    const athleteId = searchParams.get('athleteId');

    // Validar weekOffset
    if (isNaN(weekOffset) || weekOffset < -52 || weekOffset > 52) {
      return NextResponse.json({ error: 'weekOffset debe estar entre -52 y 52' }, { status: 400 });
    }

    // TODO: Obtener athleteId de la sesión autenticada si no se proporciona
    // Por ahora, requerimos athleteId
    if (!athleteId) {
      return NextResponse.json({ error: 'athleteId es requerido' }, { status: 400 });
    }

    // Calcular fechas de la semana (domingo a sábado)
    const now = new Date();
    const targetWeek =
      weekOffset === 0
        ? now
        : weekOffset > 0
          ? addWeeks(now, weekOffset)
          : subWeeks(now, Math.abs(weekOffset));

    const weekStart = startOfWeek(targetWeek, { weekStartsOn: 0 }); // Domingo
    const weekEnd = endOfWeek(targetWeek, { weekStartsOn: 0 }); // Sábado

    // Obtener actividades de la semana
    const activities = await prisma.activity.findMany({
      where: {
        athleteId,
        startDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        startDate: true,
        distance: true,
        movingTime: true,
        totalElevationGain: true,
        averageSpeed: true,
        type: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Calcular métricas agregadas
    const summary = activities.reduce(
      (acc, activity) => {
        acc.totalDistance += activity.distance || 0;
        acc.totalTime += activity.movingTime || 0;
        acc.totalElevation += activity.totalElevationGain || 0;
        acc.activityCount += 1;
        return acc;
      },
      {
        totalDistance: 0,
        totalTime: 0,
        totalElevation: 0,
        activityCount: 0,
      }
    );

    // Calcular velocidad promedio (solo si hay distancia y tiempo)
    const avgSpeed =
      summary.totalTime > 0 ? summary.totalDistance / 1000 / (summary.totalTime / 3600) : 0;

    // Preparar desglose diario
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const daysFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const dailyBreakdown = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);

      const dayActivities = activities.filter((a) => {
        const activityDate = new Date(a.startDate);
        return activityDate.toDateString() === date.toDateString();
      });

      const dayStats = dayActivities.reduce(
        (acc, activity) => {
          acc.distance += activity.distance || 0;
          acc.duration += activity.movingTime || 0;
          acc.elevation += activity.totalElevationGain || 0;
          acc.activities += 1;
          return acc;
        },
        { distance: 0, duration: 0, elevation: 0, activities: 0 }
      );

      return {
        day: daysFull[i]!,
        dayShort: daysOfWeek[i]!,
        date: format(date, 'yyyy-MM-dd'),
        distance: Math.round((dayStats.distance / 1000) * 10) / 10, // km con 1 decimal
        duration: dayStats.duration,
        elevation: Math.round(dayStats.elevation),
        activities: dayStats.activities,
      };
    });

    // Obtener objetivos semanales del atleta (valores por defecto si no existen)
    const weeklyGoals = await getWeeklyGoals(athleteId);

    // Calcular progreso hacia objetivos
    const goalsProgress = {
      distance: {
        current: Math.round((summary.totalDistance / 1000) * 10) / 10, // km
        target: weeklyGoals.distance,
        percentage: Math.min(
          Math.round((summary.totalDistance / 1000 / weeklyGoals.distance) * 100),
          100
        ),
      },
      time: {
        current: Math.round(summary.totalTime / 60), // minutos
        target: weeklyGoals.time,
        percentage: Math.min(Math.round((summary.totalTime / 60 / weeklyGoals.time) * 100), 100),
      },
    };

    // Formatear respuesta
    const response: WeeklyStatsResponse = {
      week: {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
        label:
          weekOffset === 0
            ? 'Esta semana'
            : weekOffset === -1
              ? 'Semana pasada'
              : weekOffset === 1
                ? 'Próxima semana'
                : `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
      },
      summary: {
        totalDistance: Math.round((summary.totalDistance / 1000) * 10) / 10, // km
        totalTime: summary.totalTime,
        totalElevation: Math.round(summary.totalElevation),
        activityCount: summary.activityCount,
        avgSpeed: Math.round(avgSpeed * 10) / 10,
      },
      dailyBreakdown,
      goalsProgress,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Dashboard Stats API] Error:', error);

    return NextResponse.json(
      { error: 'Error al obtener estadísticas del dashboard' },
      { status: 500 }
    );
  }
}

/**
 * Obtiene los objetivos semanales del atleta.
 * Si no existen, devuelve valores por defecto.
 */
async function getWeeklyGoals(athleteId: string): Promise<{ distance: number; time: number }> {
  try {
    // Buscar objetivos no completados del atleta
    const goals = await prisma.goal.findFirst({
      where: {
        athleteId,
        isAchieved: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        targetValue: true,
        unit: true,
      },
    });

    if (goals && goals.targetValue) {
      const unit = goals.unit?.toUpperCase() || '';

      // Si el objetivo es en distancia
      if (unit === 'KM' || unit === 'MILES' || unit === 'M' || unit === 'MI') {
        const distanceKm =
          unit === 'KM' || unit === 'M'
            ? goals.targetValue / (unit === 'M' ? 1000 : 1)
            : goals.targetValue * 1.60934; // Convertir millas a km
        return {
          distance: distanceKm,
          time: 300, // 5 horas por defecto
        };
      }
      // Si el objetivo es en tiempo (minutos u horas)
      if (unit === 'MINUTES' || unit === 'HOURS' || unit === 'MIN' || unit === 'HR') {
        const timeMinutes =
          unit === 'MINUTES' || unit === 'MIN' ? goals.targetValue : goals.targetValue * 60;
        return {
          distance: 50, // 50 km por defecto
          time: timeMinutes,
        };
      }
    }

    // Valores por defecto
    return {
      distance: 50, // 50 km semanales
      time: 300, // 5 horas semanales (300 minutos)
    };
  } catch {
    // En caso de error, devolver valores por defecto
    return {
      distance: 50,
      time: 300,
    };
  }
}
