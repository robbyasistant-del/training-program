/**
 * Performance Curves Calculator
 *
 * Calcula métricas de fitness de entrenamiento usando medias móviles exponenciales (EMA):
 * - CTL (Chronic Training Load / Carga Crónica): EMA de 42 días
 * - ATL (Acute Training Load / Carga Aguda): EMA de 7 días
 * - TSB (Training Stress Balance): CTL - ATL del día anterior
 *
 * @module lib/fitness/performanceCurves
 */

import { prisma } from '@/lib/db';

/**
 * Datos de TSS diario para cálculo de métricas
 */
export interface DailyTSS {
  date: string; // ISO date (YYYY-MM-DD)
  tss: number;
}

/**
 * Métricas de fitness calculadas para un día específico
 */
export interface FitnessMetrics {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  tss: number;
}

/**
 * Configuración para el cálculo de métricas
 */
export interface CalculationConfig {
  ctlDecayDays: number; // Default: 42 días para CTL
  atlDecayDays: number; // Default: 7 días para ATL
  initialCtl?: number; // Valor inicial de CTL (default: 0)
  initialAtl?: number; // Valor inicial de ATL (default: 0)
}

/**
 * Constantes de configuración por defecto
 */
export const DEFAULT_CONFIG: Required<CalculationConfig> = {
  ctlDecayDays: 42,
  atlDecayDays: 7,
  initialCtl: 0,
  initialAtl: 0,
};

/**
 * Factores de decaimiento exponencial precalculados
 *
 * Fórmula: factor = 1 - exp(-1/periodo)
 *
 * Esto representa qué tanto "pesa" el valor nuevo vs el acumulado histórico.
 */
export function calculateDecayFactor(days: number): number {
  return 1 - Math.exp(-1 / days);
}

/**
 * Calcula el CTL (Chronic Training Load) para un día específico.
 *
 * Fórmula: CTL_n = CTL_{n-1} + (TSS_n - CTL_{n-1}) × (1 - e^(-1/42))
 *
 * @param previousCtl - CTL del día anterior
 * @param tss - TSS del día actual
 * @param decayDays - Días de ventana de decaimiento (default: 42)
 * @returns CTL calculado
 */
export function calculateCTL(previousCtl: number, tss: number, decayDays: number = 42): number {
  const decayFactor = calculateDecayFactor(decayDays);
  const ctl = previousCtl + (tss - previousCtl) * decayFactor;
  return Math.round(ctl * 100) / 100;
}

/**
 * Calcula el ATL (Acute Training Load) para un día específico.
 *
 * Fórmula: ATL_n = ATL_{n-1} + (TSS_n - ATL_{n-1}) × (1 - e^(-1/7))
 *
 * @param previousAtl - ATL del día anterior
 * @param tss - TSS del día actual
 * @param decayDays - Días de ventana de decaimiento (default: 7)
 * @returns ATL calculado
 */
export function calculateATL(previousAtl: number, tss: number, decayDays: number = 7): number {
  const decayFactor = calculateDecayFactor(decayDays);
  const atl = previousAtl + (tss - previousAtl) * decayFactor;
  return Math.round(atl * 100) / 100;
}

/**
 * Calcula el TSB (Training Stress Balance) para un día específico.
 *
 * Fórmula: TSB_n = CTL_{n-1} - ATL_{n-1}
 *
 * Nota: El TSB usa los valores del día anterior, no los recién calculados.
 *
 * @param previousCtl - CTL del día anterior
 * @param previousAtl - ATL del día anterior
 * @returns TSB calculado
 */
export function calculateTSB(previousCtl: number, previousAtl: number): number {
  const tsb = previousCtl - previousAtl;
  return Math.round(tsb * 100) / 100;
}

/**
 * Calcula todas las métricas de fitness para una secuencia de días con TSS.
 *
 * Este es el algoritmo principal que recorre todos los días y calcula:
 * - CTL usando EMA de 42 días
 * - ATL usando EMA de 7 días
 * - TSB como diferencia entre CTL y ATL del día anterior
 *
 * @param dailyTSS - Array de objetos {date, tss} ordenados por fecha
 * @param config - Configuración opcional para el cálculo
 * @returns Array de métricas calculadas ordenadas por fecha
 */
export function calculateMetrics(
  dailyTSS: DailyTSS[],
  config: Partial<CalculationConfig> = {}
): FitnessMetrics[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!dailyTSS || dailyTSS.length === 0) {
    return [];
  }

  // Ordenar por fecha ascendente
  const sortedData = [...dailyTSS].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const results: FitnessMetrics[] = [];
  let previousCtl = mergedConfig.initialCtl;
  let previousAtl = mergedConfig.initialAtl;

  for (const day of sortedData) {
    // Calcular métricas para este día
    const ctl = calculateCTL(previousCtl, day.tss, mergedConfig.ctlDecayDays);
    const atl = calculateATL(previousAtl, day.tss, mergedConfig.atlDecayDays);
    const tsb = calculateTSB(previousCtl, previousAtl);

    results.push({
      date: day.date,
      ctl,
      atl,
      tsb,
      tss: day.tss,
    });

    // Actualizar valores para el siguiente día
    previousCtl = ctl;
    previousAtl = atl;
  }

  return results;
}

/**
 * Interpreta el estado de forma basado en los valores de TSB.
 *
 * Rangos basados en convenciones de TrainingPeaks:
 * - TSB < -30: Fatiga alta (riesgo de sobreentrenamiento)
 * - TSB -30 a -10: Fatiga óptima (entrenamiento productivo)
 * - TSB -10 a +10: Neutral (mantenimiento)
 * - TSB +10 a +25: Fresco (bueno para competición)
 * - TSB > +25: Desentrenamiento (pérdida de forma)
 *
 * @param tsb - Valor de Training Stress Balance
 * @returns Descripción del estado de forma
 */
export function interpretTSB(tsb: number): {
  status: string;
  description: string;
  color: string;
} {
  if (tsb < -30) {
    return {
      status: 'high_fatigue',
      description: 'Fatiga muy alta - Riesgo de sobreentrenamiento',
      color: '#ef4444', // red-500
    };
  } else if (tsb < -10) {
    return {
      status: 'optimal_training',
      description: 'Zona de entrenamiento óptimo - Adaptación en progreso',
      color: '#f59e0b', // amber-500
    };
  } else if (tsb <= 10) {
    return {
      status: 'neutral',
      description: 'Balance neutral - Mantenimiento',
      color: '#6b7280', // gray-500
    };
  } else if (tsb <= 25) {
    return {
      status: 'fresh',
      description: 'Bien recuperado - Listo para competir',
      color: '#22c55e', // green-500
    };
  } else {
    return {
      status: 'detraining',
      description: 'Posible desentrenamiento - Perdiendo forma',
      color: '#3b82f6', // blue-500
    };
  }
}

/**
 * Interpreta el nivel de CTL (Carga Crónica) en términos de volumen de entrenamiento.
 *
 * Rangos aproximados para ciclistas:
 * - < 50: Recreativo
 * - 50-100: Intermedio
 * - 100-150: Avanzado
 * - 150-200: Elite amateur
 * - > 200: Profesional
 *
 * @param ctl - Valor de Chronic Training Load
 * @param sport - Deporte ('cycling' | 'running' | 'triathlon')
 * @returns Descripción del nivel de entrenamiento
 */
export function interpretCTL(
  ctl: number,
  sport: 'cycling' | 'running' | 'triathlon' = 'cycling'
): {
  level: string;
  description: string;
} {
  // Ajustar rangos según deporte
  const thresholds: Record<string, number[]> = {
    cycling: [50, 100, 150, 200],
    running: [40, 80, 120, 160],
    triathlon: [60, 120, 180, 240],
  };

  const sportThresholds = thresholds[sport];
  if (!sportThresholds) {
    return { level: 'unknown', description: 'Deporte no reconocido' };
  }

  const rec = sportThresholds[0] ?? 50;
  const inter = sportThresholds[1] ?? 100;
  const adv = sportThresholds[2] ?? 150;
  const elite = sportThresholds[3] ?? 200;

  if (ctl < rec) {
    return { level: 'recreational', description: 'Nivel recreativo/base' };
  } else if (ctl < inter) {
    return { level: 'intermediate', description: 'Nivel intermedio' };
  } else if (ctl < adv) {
    return { level: 'advanced', description: 'Nivel avanzado' };
  } else if (ctl < elite) {
    return { level: 'elite_amateur', description: 'Nivel elite amateur' };
  } else {
    return { level: 'professional', description: 'Nivel profesional' };
  }
}

/**
 * Calcula métricas de tendencia para un período dado.
 *
 * @param metrics - Array de métricas de fitness
 * @returns Objeto con tendencias calculadas
 */
export function calculateTrends(metrics: FitnessMetrics[]): {
  ctlTrend: number; // Cambio de CTL en el período
  atlTrend: number; // Cambio de ATL en el período
  tsbTrend: number; // Cambio de TSB en el período
  avgDailyTSS: number; // TSS promedio diario
  maxCTL: number; // Máximo CTL alcanzado
  minTSB: number; // TSB más negativo (mayor fatiga)
  trainingDays: number; // Días con TSS > 0
  restDays: number; // Días con TSS = 0
} {
  if (!metrics || metrics.length === 0) {
    return {
      ctlTrend: 0,
      atlTrend: 0,
      tsbTrend: 0,
      avgDailyTSS: 0,
      maxCTL: 0,
      minTSB: 0,
      trainingDays: 0,
      restDays: 0,
    };
  }

  const first = metrics[0]!;
  const last = metrics[metrics.length - 1]!;

  const ctlTrend = last.ctl - first.ctl;
  const atlTrend = last.atl - first.atl;
  const tsbTrend = last.tsb - first.tsb;

  const avgDailyTSS = metrics.reduce((sum, m) => sum + m.tss, 0) / metrics.length;
  const maxCTL = Math.max(...metrics.map((m) => m.ctl));
  const minTSB = Math.min(...metrics.map((m) => m.tsb));

  const trainingDays = metrics.filter((m) => m.tss > 0).length;
  const restDays = metrics.length - trainingDays;

  return {
    ctlTrend: Math.round(ctlTrend * 100) / 100,
    atlTrend: Math.round(atlTrend * 100) / 100,
    tsbTrend: Math.round(tsbTrend * 100) / 100,
    avgDailyTSS: Math.round(avgDailyTSS * 100) / 100,
    maxCTL: Math.round(maxCTL * 100) / 100,
    minTSB: Math.round(minTSB * 100) / 100,
    trainingDays,
    restDays,
  };
}

/**
 * Rellena los huecos en los datos de TSS diario con valores de 0.
 * Esto es necesario porque el algoritmo EMA requiere datos para cada día.
 *
 * @param dailyTSS - Array de datos de TSS (puede tener huecos)
 * @returns Array con todos los días rellenos, TSS = 0 para días faltantes
 */
export function fillGaps(dailyTSS: DailyTSS[]): DailyTSS[] {
  if (!dailyTSS || dailyTSS.length === 0) {
    return [];
  }

  // Ordenar por fecha
  const sorted = [...dailyTSS].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const result: DailyTSS[] = [];
  const startDate = new Date(sorted[0]!.date);
  const endDate = new Date(sorted[sorted.length - 1]!.date);

  // Crear un mapa para lookup rápido
  const tssMap = new Map(sorted.map((d) => [d.date, d.tss]));

  // Iterar día por día desde startDate hasta endDate
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (dateStr) {
      result.push({
        date: dateStr,
        tss: tssMap.get(dateStr) || 0,
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Agrega múltiples actividades del mismo día sumando sus TSS.
 *
 * @param activities - Array de actividades con fecha y TSS
 * @returns Array de TSS diario agregado
 */
export function aggregateDailyTSS(activities: { date: string; tss: number }[]): DailyTSS[] {
  const grouped = activities.reduce(
    (acc, activity) => {
      const date = activity.date.split('T')[0]; // Normalizar a YYYY-MM-DD
      if (date) {
        acc[date] = (acc[date] || 0) + activity.tss;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  return Object.entries(grouped).map(([date, tss]) => ({
    date,
    tss: Math.round(tss * 100) / 100,
  }));
}

/**
 * Genera fechas objetivo para alcanzar un CTL específico.
 * Útil para planificación de temporada.
 *
 * @param currentCtl - CTL actual
 * @param targetCtl - CTL objetivo
 * @param dailyTSS - TSS diario promedio planificado
 * @returns Fecha estimada para alcanzar el objetivo
 */
export function estimateTargetDate(
  currentCtl: number,
  targetCtl: number,
  dailyTSS: number
): Date | null {
  if (dailyTSS <= 0 || targetCtl <= currentCtl) {
    return null;
  }

  const ctlFactor = calculateDecayFactor(42);
  let days = 0;
  let ctl = currentCtl;
  const maxDays = 365; // Límite de seguridad

  while (ctl < targetCtl && days < maxDays) {
    ctl = ctl + (dailyTSS - ctl) * ctlFactor;
    days++;
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);
  return targetDate;
}

/**
 * Valida que las métricas calculadas sean consistentes.
 * Útil para tests y debugging.
 *
 * @param metrics - Array de métricas a validar
 * @returns Objeto con resultado de validación
 */
export function validateMetrics(metrics: FitnessMetrics[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i]!;

    // Verificar que CTL sea no negativo
    if (m.ctl < 0) {
      errors.push(`Día ${m.date}: CTL negativo (${m.ctl})`);
    }

    // Verificar que ATL sea no negativo
    if (m.atl < 0) {
      errors.push(`Día ${m.date}: ATL negativo (${m.atl})`);
    }

    // Verificar que TSS sea no negativo
    if (m.tss < 0) {
      errors.push(`Día ${m.date}: TSS negativo (${m.tss})`);
    }

    // Verificar relación TSB = CTL_prev - ATL_prev (aproximada)
    if (i > 0) {
      const prev = metrics[i - 1];
      if (prev) {
        const expectedTsb = prev.ctl - prev.atl;
        if (Math.abs(m.tsb - expectedTsb) > 0.01) {
          errors.push(
            `Día ${m.date}: TSB inconsistente. Esperado: ${expectedTsb}, Actual: ${m.tsb}`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calcula métricas de fitness para un atleta en un rango de fechas.
 * Esta función calcula al vuelo desde las actividades sin usar caché.
 *
 * @param athleteId - ID del atleta
 * @param fromDate - Fecha de inicio
 * @param toDate - Fecha de fin
 * @returns Objeto con métricas calculadas y valores actuales
 */
export async function calculateAthleteFitnessMetrics(
  athleteId: string,
  fromDate: Date,
  toDate: Date
): Promise<{
  metrics: FitnessMetrics[];
  currentCTL: number;
  currentATL: number;
  currentTSB: number;
}> {
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
      startDate: true,
      tss: true,
    },
  });

  // Convertir a formato DailyTSS
  const dailyTSSData: DailyTSS[] = activities
    .map((a) => {
      const dateStr = a.startDate.toISOString().split('T')[0];
      return {
        date: dateStr || '',
        tss: a.tss ?? 0,
      };
    })
    .filter((d) => d.date !== '');

  // Agregar TSS por día (en caso de múltiples actividades)
  const aggregated = aggregateDailyTSS(dailyTSSData);

  // Rellenar huecos
  const filled = fillGaps(aggregated);

  // Obtener valores iniciales si existen
  const previousMetric = await prisma.fitnessMetric.findFirst({
    where: {
      athleteId,
      date: { lt: fromDate },
    },
    orderBy: { date: 'desc' },
    select: { ctl: true, atl: true },
  });

  // Calcular métricas
  const metrics = calculateMetrics(filled, {
    initialCtl: previousMetric?.ctl ?? 0,
    initialAtl: previousMetric?.atl ?? 0,
  });

  const lastMetric = metrics[metrics.length - 1];

  return {
    metrics,
    currentCTL: lastMetric?.ctl ?? 0,
    currentATL: lastMetric?.atl ?? 0,
    currentTSB: lastMetric?.tsb ?? 0,
  };
}
