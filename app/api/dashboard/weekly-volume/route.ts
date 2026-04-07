import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { subWeeks, startOfWeek, endOfWeek, format } from 'date-fns';

/**
 * GET /api/dashboard/weekly-volume
 *
 * Devuelve el volumen semanal de entrenamiento para las últimas 8 semanas.
 *
 * Query params:
 * - athleteId: ID del atleta
 * - unit: 'km' | 'hours' | 'sessions' (default: 'km')
 */

export interface WeeklyVolumeResponse {
  data: Array<{
    weekLabel: string;
    volume: number;
    isCurrentWeek: boolean;
    weekStartDate: string;
  }>;
  unit: 'km' | 'hours' | 'sessions';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');
    const unit = (searchParams.get('unit') as 'km' | 'hours' | 'sessions') || 'km';

    if (!athleteId) {
      return NextResponse.json({ error: 'athleteId es requerido' }, { status: 400 });
    }

    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });

    // Obtener actividades de las últimas 8 semanas
    const eightWeeksAgo = subWeeks(now, 7);
    const startDate = startOfWeek(eightWeeksAgo, { weekStartsOn: 0 });

    const activities = await prisma.activity.findMany({
      where: {
        athleteId,
        startDate: {
          gte: startDate,
        },
      },
      select: {
        startDate: true,
        distance: true,
        movingTime: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Agrupar por semana
    const weeks: Array<{
      weekStart: Date;
      weekEnd: Date;
      volume: number;
      isCurrentWeek: boolean;
    }> = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = subWeeks(currentWeekStart, i);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

      const weekActivities = activities.filter((a) => {
        const activityDate = new Date(a.startDate);
        return activityDate >= weekStart && activityDate <= weekEnd;
      });

      let volume = 0;
      if (unit === 'km') {
        volume = weekActivities.reduce((sum, a) => sum + (a.distance || 0) / 1000, 0);
      } else if (unit === 'hours') {
        volume = weekActivities.reduce((sum, a) => sum + (a.movingTime || 0) / 3600, 0);
      } else if (unit === 'sessions') {
        volume = weekActivities.length;
      }

      weeks.push({
        weekStart,
        weekEnd,
        volume: Math.round(volume * 10) / 10,
        isCurrentWeek: i === 0,
      });
    }

    const data = weeks.map((week, index) => {
      const weekNum = 8 - index;
      return {
        weekLabel: week.isCurrentWeek ? 'Actual' : `S${weekNum}`,
        volume: week.volume,
        isCurrentWeek: week.isCurrentWeek,
        weekStartDate: `${format(week.weekStart, 'dd/MM')} - ${format(week.weekEnd, 'dd/MM')}`,
      };
    });

    const response: WeeklyVolumeResponse = {
      data,
      unit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Weekly Volume API] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener volumen semanal' },
      { status: 500 }
    );
  }
}
