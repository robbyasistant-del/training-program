import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateMetrics, fillGaps, aggregateDailyTSS } from '@/lib/fitness/performanceCurves';
import { calculateTSS } from '@/lib/fitness/tssCalculator';
import { ActivityType } from '@prisma/client';

/**
 * GET /api/athletes/[id]/fitness-metrics
 *
 * Obtiene las métricas de fitness (CTL, ATL, TSB, TSS) para un atleta
 * en un rango de fechas específico.
 *
 * Query params:
 * - from: Fecha de inicio (ISO string, opcional, default: 90 días atrás)
 * - to: Fecha de fin (ISO string, opcional, default: hoy)
 * - recalculate: 'true' para forzar recálculo desde BD (opcional)
 *
 * Response: Array de objetos {date, ctl, atl, tsb, tss}
 */

// Cache de 5 minutos en segundos
const CACHE_MAX_AGE = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const athleteId = params.id;

    // Validar que el atleta existe
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, weight: true, sex: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Atleta no encontrado' }, { status: 404 });
    }

    // Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const recalculateParam = searchParams.get('recalculate');
    const shouldRecalculate = recalculateParam === 'true';

    // Calcular fechas por defecto (últimos 90 días)
    const toDate = toParam ? new Date(toParam) : new Date();
    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Validar fechas
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: 'La fecha "from" debe ser anterior a "to"' },
        { status: 400 }
      );
    }

    let metrics: Array<{
      date: string;
      ctl: number;
      atl: number;
      tsb: number;
      tss: number;
    }> = [];

    if (shouldRecalculate) {
      // Modo recálculo: calcular desde actividades
      metrics = await calculateMetricsFromActivities(athleteId, fromDate, toDate, athlete);
    } else {
      // Intentar obtener de la tabla fitness_metrics primero
      const storedMetrics = await prisma.fitnessMetric.findMany({
        where: {
          athleteId,
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          ctl: true,
          atl: true,
          tsb: true,
          tss: true,
        },
      });

      if (storedMetrics.length > 0) {
        // Usar datos almacenados
        metrics = storedMetrics
          .map((m) => {
            const dateStr = m.date.toISOString().split('T')[0];
            return {
              date: dateStr || '',
              ctl: m.ctl,
              atl: m.atl,
              tsb: m.tsb,
              tss: m.tss,
            };
          })
          .filter((m) => m.date !== '');
      } else {
        // Si no hay datos almacenados, calcular desde actividades
        metrics = await calculateMetricsFromActivities(athleteId, fromDate, toDate, athlete);
      }
    }

    // Calcular tiempo de respuesta
    const responseTime = Date.now() - startTime;

    // Construir respuesta con headers de cache
    const response = NextResponse.json({
      athleteId,
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
      metrics,
      count: metrics.length,
      responseTimeMs: responseTime,
    });

    // Configurar cache headers (5 minutos)
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('X-Response-Time', `${responseTime}ms`);

    return response;
  } catch (error) {
    console.error('[Fitness Metrics API] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * Calcula métricas desde las actividades almacenadas.
 */
async function calculateMetricsFromActivities(
  athleteId: string,
  fromDate: Date,
  toDate: Date,
  athlete: { weight: number | null; sex: string | null }
): Promise<Array<{ date: string; ctl: number; atl: number; tsb: number; tss: number }>> {
  // Obtener actividades en el rango
  const activities = await prisma.activity.findMany({
    where: {
      athleteId,
      startDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      type: true,
      distance: true,
      movingTime: true,
      averagePower: true,
      maxPower: true,
      averageHeartrate: true,
      maxHeartrate: true,
      tss: true,
      rawJson: true,
      startDate: true,
    },
  });

  if (activities.length === 0) {
    return [];
  }

  // Umbrales por defecto basados en el atleta
  const thresholds = {
    ftp: athlete.weight ? athlete.weight * 2.5 : 200, // Estimación conservadora
    thresholdPaceMinPerKm: 4.5, // ~4:30 min/km
    thresholdPaceMinPer100m: 2.0, // ~2:00 min/100m
    restingHeartrate: 60,
    maxHeartrate: athlete.sex === 'F' ? 185 : 190,
  };

  // Calcular TSS para cada actividad
  const activitiesWithTSS = activities
    .map((activity): { date: string; tss: number } | null => {
      // Si ya tiene TSS calculado, usarlo
      if (activity.tss !== null && activity.tss !== undefined) {
        const dateStr = activity.startDate.toISOString().split('T')[0];
        if (!dateStr) return null;
        return { date: dateStr, tss: activity.tss };
      }

      // Si no hay tiempo de movimiento, TSS = 0
      if (!activity.movingTime) {
        const dateStr = activity.startDate.toISOString().split('T')[0];
        if (!dateStr) return null;
        return { date: dateStr, tss: 0 };
      }

      // Intentar obtener NP del rawJson
      let normalizedPower: number | undefined;
      if (activity.rawJson && typeof activity.rawJson === 'object') {
        const raw = activity.rawJson as Record<string, unknown>;
        if (raw.weighted_average_watts && typeof raw.weighted_average_watts === 'number') {
          normalizedPower = raw.weighted_average_watts;
        }
      }

      // Construir datos de actividad
      const activityData: Parameters<typeof calculateTSS>[0] = {
        type: activity.type,
        durationSeconds: activity.movingTime,
        functionalThresholdPower: thresholds.ftp,
        thresholdPaceMinPerKm: thresholds.thresholdPaceMinPerKm,
        thresholdPaceMinPer100m: thresholds.thresholdPaceMinPer100m,
        maxHeartrate: thresholds.maxHeartrate,
      };

      if (activity.distance != null) activityData.distanceMeters = activity.distance;
      if (activity.averagePower != null) activityData.averagePower = activity.averagePower;
      if (normalizedPower != null) activityData.normalizedPower = normalizedPower;
      if (activity.averageHeartrate != null)
        activityData.averageHeartrate = activity.averageHeartrate;

      // Calcular TSS según tipo de actividad
      const result = calculateTSS(activityData);
      const dateStr = activity.startDate.toISOString().split('T')[0];
      if (!dateStr) return null;
      return { date: dateStr, tss: result.tss };
    })
    .filter((item): item is { date: string; tss: number } => item !== null);

  // Agregar TSS por día
  const dailyTSS = aggregateDailyTSS(activitiesWithTSS);

  // Obtener métrica anterior para inicializar valores
  const previousMetric = await prisma.fitnessMetric.findFirst({
    where: {
      athleteId,
      date: { lt: fromDate },
    },
    orderBy: { date: 'desc' },
    select: { ctl: true, atl: true },
  });

  // Rellenar huecos y calcular métricas
  const filledDailyTSS = fillGaps(dailyTSS);
  const metrics = calculateMetrics(filledDailyTSS, {
    initialCtl: previousMetric?.ctl ?? 0,
    initialAtl: previousMetric?.atl ?? 0,
  });

  return metrics;
}
