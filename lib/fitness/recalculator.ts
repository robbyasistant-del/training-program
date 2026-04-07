/**
 * Fitness Metrics Recalculator Service
 *
 * Servicio para recalcular métricas de fitness (CTL, ATL, TSB) de forma batch.
 * Maneja el procesamiento eficiente de grandes volúmenes de datos históricos
 * y actualizaciones incrementales.
 *
 * @module lib/fitness/recalculator
 */

import { ActivityType } from '@prisma/client';

import { prisma } from '@/lib/db';

import {
  calculateMetrics,
  fillGaps,
  aggregateDailyTSS,
  FitnessMetrics,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  DailyTSS,
} from './performanceCurves';
import { calculateTSS, ActivityData } from './tssCalculator';

/**
 * Opciones para el recálculo de métricas
 */
export interface RecalculationOptions {
  /** Fecha desde la cual recalcular (inclusive). Si no se especifica, usa la primera actividad. */
  fromDate: Date | undefined;
  /** Fecha hasta la cual recalcular (inclusive). Default: hoy */
  toDate: Date | undefined;
  /** Procesar en modo batch para mejor performance. Default: true */
  useBatchProcessing?: boolean;
  /** Tamaño del batch para inserts. Default: 1000 */
  batchSize?: number;
  /** Mostrar logs de progreso. Default: false */
  verbose?: boolean;
}

/**
 * Resultado del recálculo de métricas
 */
export interface RecalculationResult {
  /** Total de días procesados */
  daysProcessed: number;
  /** Total de actividades consideradas */
  activitiesConsidered: number;
  /** Métricas insertadas/actualizadas */
  metricsUpserted: number;
  /** Tiempo de ejecución en milisegundos */
  executionTimeMs: number;
  /** Primer día procesado */
  firstDate: string | null;
  /** Último día procesado */
  lastDate: string | null;
  /** CTL final calculado */
  finalCtl: number | null;
  /** ATL final calculado */
  finalAtl: number | null;
  /** TSB final calculado */
  finalTsb: number | null;
}

/**
 * Obtiene el TSS calculado o existente para una actividad.
 * Si la actividad no tiene TSS, lo calcula según el tipo.
 */
async function getActivityTSS(
  activity: {
    id: string;
    type: ActivityType;
    distance: number | null;
    movingTime: number | null;
    averagePower: number | null;
    maxPower: number | null;
    averageHeartrate: number | null;
    maxHeartrate: number | null;
    tss: number | null;
    rawJson: unknown;
    startDate: Date;
  },
  athleteThresholds: {
    ftp?: number | null;
    thresholdPaceMinPerKm?: number | null;
    thresholdPaceMinPer100m?: number | null;
    restingHeartrate?: number | null;
    maxHeartrate?: number | null;
    weight?: number | null;
    gender?: string | null;
  }
): Promise<number> {
  // Si ya tiene TSS calculado, usarlo
  if (activity.tss !== null && activity.tss !== undefined) {
    return activity.tss;
  }

  // Si no hay tiempo de movimiento, no podemos calcular
  if (!activity.movingTime) {
    return 0;
  }

  const activityData: ActivityData = {
    type: activity.type,
    durationSeconds: activity.movingTime,
  };

  // Agregar propiedades opcionales solo si tienen valor
  if (activity.distance != null) activityData.distanceMeters = activity.distance;
  if (activity.averagePower != null) activityData.averagePower = activity.averagePower;
  if (athleteThresholds.ftp != null) activityData.functionalThresholdPower = athleteThresholds.ftp;
  if (athleteThresholds.thresholdPaceMinPerKm != null)
    activityData.thresholdPaceMinPerKm = athleteThresholds.thresholdPaceMinPerKm;
  if (athleteThresholds.thresholdPaceMinPer100m != null)
    activityData.thresholdPaceMinPer100m = athleteThresholds.thresholdPaceMinPer100m;
  if (activity.averageHeartrate != null) activityData.averageHeartrate = activity.averageHeartrate;
  if (athleteThresholds.maxHeartrate != null)
    activityData.maxHeartrate = athleteThresholds.maxHeartrate;
  else if (activity.maxHeartrate != null) activityData.maxHeartrate = activity.maxHeartrate;

  // Intentar obtener NP del rawJson si existe
  if (activity.rawJson && typeof activity.rawJson === 'object') {
    const raw = activity.rawJson as Record<string, unknown>;
    if (raw.weighted_average_watts && typeof raw.weighted_average_watts === 'number') {
      activityData.normalizedPower = raw.weighted_average_watts;
    }
  }

  const result = calculateTSS(activityData);
  return result.tss;
}

/**
 * Obtiene los umbrales del atleta para cálculos de TSS.
 */
async function getAthleteThresholds(athleteId: string): Promise<{
  ftp: number | null;
  thresholdPaceMinPerKm: number | null;
  thresholdPaceMinPer100m: number | null;
  restingHeartrate: number | null;
  maxHeartrate: number | null;
  weight: number | null;
  gender: string | null;
}> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      weight: true,
      sex: true,
    },
  });

  // TODO: Implementar almacenamiento de umbrales en tabla separada
  // Por ahora usamos valores por defecto basados en peso/género
  return {
    ftp: null, // Se calculará dinámicamente o usará default
    thresholdPaceMinPerKm: null,
    thresholdPaceMinPer100m: null,
    restingHeartrate: 60,
    maxHeartrate: athlete?.sex === 'F' ? 185 : 190,
    weight: athlete?.weight ?? null,
    gender: athlete?.sex ?? null,
  };
}

/**
 * Recalcula las métricas de fitness para un atleta desde una fecha dada.
 *
 * Este es el método principal para recalcular CTL/ATL/TSB:
 * 1. Obtiene todas las actividades desde fromDate
 * 2. Calcula TSS para cada actividad
 * 3. Agrega TSS por día
 * 4. Rellena huecos en el calendario
 * 5. Calcula métricas usando EMA
 * 6. Guarda en base de datos usando batch inserts
 *
 * @param athleteId - ID del atleta
 * @param options - Opciones de recálculo
 * @returns Resultado del recálculo
 */
export async function recalculateAthleteMetrics(
  athleteId: string,
  options: RecalculationOptions = { fromDate: undefined, toDate: undefined }
): Promise<RecalculationResult> {
  const startTime = Date.now();

  const {
    fromDate,
    toDate = new Date(),
    useBatchProcessing = true,
    batchSize = 1000,
    verbose = false,
  } = options;

  if (verbose) {
    console.log(`[Recalculator] Iniciando recálculo para atleta ${athleteId}`);
  }

  // Obtener umbrales del atleta
  const thresholds = await getAthleteThresholds(athleteId);

  // Construir query de actividades
  const whereClause: {
    athleteId: string;
    startDate?: { gte: Date; lte: Date };
  } = { athleteId };

  if (fromDate || toDate) {
    whereClause.startDate = {
      gte: fromDate || new Date('2000-01-01'),
      lte: toDate,
    };
  }

  // Obtener actividades ordenadas por fecha
  const activities = await prisma.activity.findMany({
    where: whereClause,
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

  if (verbose) {
    console.log(`[Recalculator] ${activities.length} actividades encontradas`);
  }

  if (activities.length === 0) {
    return {
      daysProcessed: 0,
      activitiesConsidered: 0,
      metricsUpserted: 0,
      executionTimeMs: Date.now() - startTime,
      firstDate: null,
      lastDate: null,
      finalCtl: null,
      finalAtl: null,
      finalTsb: null,
    };
  }

  // Calcular TSS para cada actividad
  const activitiesWithTSS = (
    await Promise.all(
      activities.map(async (activity): Promise<{ date: string; tss: number } | null> => {
        const tss = await getActivityTSS(activity, thresholds);
        const dateStr = activity.startDate.toISOString().split('T')[0];
        if (!dateStr) return null;
        return { date: dateStr, tss };
      })
    )
  ).filter((item): item is { date: string; tss: number } => item !== null);

  // Agregar TSS por día
  const dailyTSS = aggregateDailyTSS(activitiesWithTSS);

  // Rellenar huecos
  const filledDailyTSS = fillGaps(dailyTSS);

  // Obtener valores iniciales si existe un día anterior al rango
  let initialCtl = 0;
  let initialAtl = 0;

  if (fromDate) {
    const previousMetric = await prisma.fitnessMetric.findFirst({
      where: {
        athleteId,
        date: { lt: fromDate },
      },
      orderBy: { date: 'desc' },
    });

    if (previousMetric) {
      initialCtl = previousMetric.ctl;
      initialAtl = previousMetric.atl;
    }
  }

  // Calcular métricas
  const metrics = calculateMetrics(filledDailyTSS, {
    initialCtl,
    initialAtl,
  });

  if (verbose) {
    console.log(`[Recalculator] ${metrics.length} días de métricas calculadas`);
  }

  // Guardar métricas en base de datos
  const metricsUpserted = await saveMetricsBatch(
    athleteId,
    metrics,
    useBatchProcessing,
    batchSize,
    verbose
  );

  const executionTime = Date.now() - startTime;

  if (verbose) {
    console.log(`[Recalculator] Completado en ${executionTime}ms`);
  }

  const lastMetric = metrics[metrics.length - 1];

  return {
    daysProcessed: metrics.length,
    activitiesConsidered: activities.length,
    metricsUpserted,
    executionTimeMs: executionTime,
    firstDate: metrics[0]?.date || null,
    lastDate: lastMetric?.date || null,
    finalCtl: lastMetric?.ctl ?? null,
    finalAtl: lastMetric?.atl ?? null,
    finalTsb: lastMetric?.tsb ?? null,
  };
}

/**
 * Guarda métricas en la base de datos usando batch inserts.
 */
async function saveMetricsBatch(
  athleteId: string,
  metrics: FitnessMetrics[],
  useBatchProcessing: boolean,
  batchSize: number,
  verbose: boolean
): Promise<number> {
  if (metrics.length === 0) return 0;

  let upsertedCount = 0;

  if (useBatchProcessing) {
    // Procesar en batches
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);

      // Usar createMany para inserts masivos (más rápido que upsert individual)
      // Primero intentamos crear, ignorando duplicados
      try {
        await prisma.fitnessMetric.createMany({
          data: batch.map((m) => ({
            athleteId,
            date: new Date(m.date),
            ctl: m.ctl,
            atl: m.atl,
            tsb: m.tsb,
            tss: m.tss,
          })),
          skipDuplicates: true,
        });
        upsertedCount += batch.length;
      } catch (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _error
      ) {
        // Si hay duplicados, caer back a upserts individuales
        if (verbose) {
          console.log('[Recalculator] Fallback a upserts individuales por duplicados');
        }

        for (const m of batch) {
          await prisma.fitnessMetric.upsert({
            where: {
              athleteId_date: {
                athleteId,
                date: new Date(m.date),
              },
            },
            update: {
              ctl: m.ctl,
              atl: m.atl,
              tsb: m.tsb,
              tss: m.tss,
            },
            create: {
              athleteId,
              date: new Date(m.date),
              ctl: m.ctl,
              atl: m.atl,
              tsb: m.tsb,
              tss: m.tss,
            },
          });
          upsertedCount++;
        }
      }

      if (verbose) {
        console.log(
          `[Recalculator] Procesado batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(metrics.length / batchSize)}`
        );
      }
    }
  } else {
    // Upserts individuales (más lento pero más control)
    for (const m of metrics) {
      await prisma.fitnessMetric.upsert({
        where: {
          athleteId_date: {
            athleteId,
            date: new Date(m.date),
          },
        },
        update: {
          ctl: m.ctl,
          atl: m.atl,
          tsb: m.tsb,
          tss: m.tss,
        },
        create: {
          athleteId,
          date: new Date(m.date),
          ctl: m.ctl,
          atl: m.atl,
          tsb: m.tsb,
          tss: m.tss,
        },
      });
      upsertedCount++;
    }
  }

  return upsertedCount;
}

/**
 * Recalcula métricas de forma incremental a partir de una nueva actividad.
 *
 * Este método es más eficiente que recalcular todo el histórico.
 * Solo recalcula desde la fecha de la nueva actividad hacia adelante.
 *
 * @param athleteId - ID del atleta
 * @param activityDate - Fecha de la nueva actividad
 * @returns Resultado del recálculo incremental
 */
export async function incrementalRecalculation(
  athleteId: string,
  activityDate: Date
): Promise<RecalculationResult> {
  // Ajustar a inicio del día para incluir todo el día
  const fromDate = new Date(activityDate);
  fromDate.setHours(0, 0, 0, 0);

  return recalculateAthleteMetrics(athleteId, {
    fromDate,
    toDate: undefined,
    useBatchProcessing: true,
    batchSize: 100,
    verbose: false,
  });
}

/**
 * Recalcula métricas para todos los atletas.
 * Útil para mantenimiento o migraciones.
 *
 * @param options - Opciones de recálculo
 * @returns Resultados por atleta
 */
export async function recalculateAllAthletes(
  options: RecalculationOptions = { fromDate: undefined, toDate: undefined }
): Promise<Record<string, RecalculationResult>> {
  const athletes = await prisma.athlete.findMany({
    select: { id: true },
  });

  const results: Record<string, RecalculationResult> = {};

  for (const athlete of athletes) {
    results[athlete.id] = await recalculateAthleteMetrics(athlete.id, options);
  }

  return results;
}

/**
 * Obtiene el rango de fechas para recálculo completo de un atleta.
 *
 * @param athleteId - ID del atleta
 * @returns Objeto con firstDate y lastDate, o null si no hay actividades
 */
export async function getAthleteDateRange(athleteId: string): Promise<{
  firstDate: Date | null;
  lastDate: Date | null;
}> {
  const [firstActivity, lastActivity] = await Promise.all([
    prisma.activity.findFirst({
      where: { athleteId },
      orderBy: { startDate: 'asc' },
      select: { startDate: true },
    }),
    prisma.activity.findFirst({
      where: { athleteId },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    }),
  ]);

  return {
    firstDate: firstActivity?.startDate || null,
    lastDate: lastActivity?.startDate || null,
  };
}

/**
 * Elimina métricas de fitness para un atleta en un rango de fechas.
 * Útil para limpieza antes de recálculo completo.
 *
 * @param athleteId - ID del atleta
 * @param fromDate - Fecha desde (opcional)
 * @param toDate - Fecha hasta (opcional)
 * @returns Número de registros eliminados
 */
export async function deleteMetrics(
  athleteId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<number> {
  const where: {
    athleteId: string;
    date?: { gte?: Date; lte?: Date };
  } = { athleteId };

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = fromDate;
    if (toDate) where.date.lte = toDate;
  }

  const result = await prisma.fitnessMetric.deleteMany({ where });
  return result.count;
}
