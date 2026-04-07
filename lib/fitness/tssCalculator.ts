/**
 * TSS Calculator Service
 *
 * Calcula el Training Stress Score (TSS) para diferentes tipos de actividad.
 * Basado en las fórmulas de TrainingPeaks y TrainerRoad.
 *
 * @module lib/fitness/tssCalculator
 */

import { ActivityType } from '@prisma/client';

/**
 * Interface para datos de actividad de ciclismo necesarios para TSS
 */
export interface CyclingActivityData {
  normalizedPower: number; // NP - Potencia Normalizada (watts)
  functionalThresholdPower: number; // FTP - Umbral Funcional de Potencia (watts)
  durationSeconds: number; // Duración en segundos
}

/**
 * Interface para datos de actividad de running necesarios para TSS
 */
export interface RunningActivityData {
  distanceMeters: number;
  durationSeconds: number;
  thresholdPaceMinPerKm: number; // Ritmo umbral en min/km
}

/**
 * Interface para datos de actividad de natación necesarios para TSS
 */
export interface SwimmingActivityData {
  distanceMeters: number;
  durationSeconds: number;
  thresholdPaceMinPer100m: number; // Ritmo umbral en min/100m
}

/**
 * Interface genérica para datos de actividad
 */
export interface ActivityData {
  type: ActivityType;
  durationSeconds: number;
  distanceMeters?: number;
  averagePower?: number;
  normalizedPower?: number;
  functionalThresholdPower?: number;
  thresholdPaceMinPerKm?: number;
  thresholdPaceMinPer100m?: number;
  averageHeartrate?: number;
  maxHeartrate?: number;
}

/**
 * Errores específicos del cálculo de TSS
 */
export class TSSCalculationError extends Error {
  constructor(
    message: string,
    public readonly activityType: ActivityType
  ) {
    super(message);
    this.name = 'TSSCalculationError';
  }
}

/**
 * Calcula el TSS para una actividad de ciclismo.
 *
 * Fórmula: TSS = (s × NP × IF) / (FTP × 3600) × 100
 * Donde:
 * - s = duración en segundos
 * - NP = Potencia Normalizada
 * - IF = Intensity Factor = NP / FTP
 * - FTP = Functional Threshold Power
 *
 * @param data - Datos de la actividad de ciclismo
 * @returns TSS calculado
 * @throws TSSCalculationError si faltan datos requeridos
 */
export function calculateCyclingTSS(data: CyclingActivityData): number {
  const { normalizedPower, functionalThresholdPower, durationSeconds } = data;

  if (!normalizedPower || normalizedPower <= 0) {
    throw new TSSCalculationError(
      'Se requiere potencia normalizada (NP) válida para calcular TSS de ciclismo',
      ActivityType.RIDE
    );
  }

  if (!functionalThresholdPower || functionalThresholdPower <= 0) {
    throw new TSSCalculationError(
      'Se requiere FTP válido para calcular TSS de ciclismo',
      ActivityType.RIDE
    );
  }

  if (!durationSeconds || durationSeconds <= 0) {
    throw new TSSCalculationError(
      'Se requiere duración válida para calcular TSS de ciclismo',
      ActivityType.RIDE
    );
  }

  // Intensity Factor
  const intensityFactor = normalizedPower / functionalThresholdPower;

  // Fórmula TSS para ciclismo
  const tss =
    ((durationSeconds * normalizedPower * intensityFactor) / (functionalThresholdPower * 3600)) *
    100;

  return Math.round(tss * 100) / 100; // Redondear a 2 decimales
}

/**
 * Calcula el TSS para una actividad de running.
 *
 * Fórmula simplificada basada en pace:
 * TSS = (tiempo_en_segundos × factor_intensidad) / (umbral_pace × 3600) × 100
 *
 * Alternativa más precisa usando la fórmula de Dr. Andrew Coggan:
 * TSS = (tiempo_en_segundos / 3600) × IF² × 100
 * Donde IF = (threshold_pace / actual_pace)
 *
 * @param data - Datos de la actividad de running
 * @returns TSS calculado
 * @throws TSSCalculationError si faltan datos requeridos
 */
export function calculateRunningTSS(data: RunningActivityData): number {
  const { distanceMeters, durationSeconds, thresholdPaceMinPerKm } = data;

  if (!distanceMeters || distanceMeters <= 0) {
    throw new TSSCalculationError(
      'Se requiere distancia válida para calcular TSS de running',
      ActivityType.RUN
    );
  }

  if (!durationSeconds || durationSeconds <= 0) {
    throw new TSSCalculationError(
      'Se requiere duración válida para calcular TSS de running',
      ActivityType.RUN
    );
  }

  if (!thresholdPaceMinPerKm || thresholdPaceMinPerKm <= 0) {
    throw new TSSCalculationError(
      'Se requiere ritmo umbral válido para calcular TSS de running',
      ActivityType.RUN
    );
  }

  // Convertir distancia a km
  const distanceKm = distanceMeters / 1000;

  // Calcular pace actual en min/km
  const actualPaceMinPerKm = durationSeconds / 60 / distanceKm;

  // Intensity Factor para running (ratio de paces inverso)
  // Si corres más rápido que tu umbral, IF > 1
  const intensityFactor = thresholdPaceMinPerKm / actualPaceMinPerKm;

  // Fórmula TSS para running (similar a ciclismo)
  const durationHours = durationSeconds / 3600;
  const tss = durationHours * Math.pow(intensityFactor, 2) * 100;

  return Math.round(tss * 100) / 100;
}

/**
 * Calcula el TSS para una actividad de natación.
 *
 * Fórmula similar al running pero adaptada a natación:
 * TSS = (tiempo_en_segundos / 3600) × IF² × 100
 * Donde IF = (threshold_pace / actual_pace)
 *
 * @param data - Datos de la actividad de natación
 * @returns TSS calculado
 * @throws TSSCalculationError si faltan datos requeridos
 */
export function calculateSwimmingTSS(data: SwimmingActivityData): number {
  const { distanceMeters, durationSeconds, thresholdPaceMinPer100m } = data;

  if (!distanceMeters || distanceMeters <= 0) {
    throw new TSSCalculationError(
      'Se requiere distancia válida para calcular TSS de natación',
      ActivityType.SWIM
    );
  }

  if (!durationSeconds || durationSeconds <= 0) {
    throw new TSSCalculationError(
      'Se requiere duración válida para calcular TSS de natación',
      ActivityType.SWIM
    );
  }

  if (!thresholdPaceMinPer100m || thresholdPaceMinPer100m <= 0) {
    throw new TSSCalculationError(
      'Se requiere ritmo umbral válido para calcular TSS de natación',
      ActivityType.SWIM
    );
  }

  // Calcular pace actual en min/100m
  const distance100m = distanceMeters / 100;
  const actualPaceMinPer100m = durationSeconds / 60 / distance100m;

  // Intensity Factor para natación
  const intensityFactor = thresholdPaceMinPer100m / actualPaceMinPer100m;

  // Fórmula TSS para natación
  const durationHours = durationSeconds / 3600;
  const tss = durationHours * Math.pow(intensityFactor, 2) * 100;

  return Math.round(tss * 100) / 100;
}

/**
 * Estimación de TSS usando solo frecuencia cardíaca.
 * Útil cuando no hay datos de potencia o pace.
 *
 * Basado en el método de TRIMP (Training Impulse) de Banister:
 * TSS_estimado = (tiempo_minutos × HR_factor) donde
 * HR_factor = (HR_avg - HR_rest) / (HR_max - HR_rest) × factor_género
 *
 * @param durationSeconds - Duración en segundos
 * @param averageHeartrate - FC promedio
 * @param maxHeartrate - FC máxima del atleta
 * @param restingHeartrate - FC en reposo (default: 60)
 * @param gender - Género ('M' o 'F', default: 'M')
 * @returns TSS estimado
 */
export function estimateTSSFromHeartrate(
  durationSeconds: number,
  averageHeartrate: number,
  maxHeartrate: number,
  restingHeartrate: number = 60,
  gender: 'M' | 'F' = 'M'
): number {
  if (!averageHeartrate || !maxHeartrate || !durationSeconds) {
    return 0;
  }

  const hrReserve = maxHeartrate - restingHeartrate;
  const hrReserveUsed = averageHeartrate - restingHeartrate;

  // Factor de intensidad basado en FC
  const intensityFactor = hrReserveUsed / hrReserve;

  // Factor de género (mujeres tienen ligeramente diferente respuesta de FC)
  const genderFactor = gender === 'F' ? 1.67 : 1.92;

  // TRIMP exp
  const durationMinutes = durationSeconds / 60;
  const trimp =
    durationMinutes * intensityFactor * genderFactor * Math.exp(genderFactor * intensityFactor);

  // Convertir TRIMP a escala TSS aproximada (dividir por un factor de escala)
  const tss = trimp / 2;

  return Math.round(tss * 100) / 100;
}

/**
 * Función principal que calcula TSS basado en el tipo de actividad.
 * Intenta usar el método más preciso disponible según los datos.
 *
 * @param data - Datos completos de la actividad
 * @returns Objeto con TSS calculado y método usado
 */
export function calculateTSS(data: ActivityData): {
  tss: number;
  method: 'power' | 'pace' | 'heartrate' | 'estimated';
  details?: string;
} {
  const { type, durationSeconds } = data;

  try {
    switch (type) {
      case ActivityType.RIDE:
      case ActivityType.VIRTUAL_RIDE:
      case ActivityType.E_BIKE_RIDE: {
        // Priorizar cálculo por potencia si está disponible
        if (data.normalizedPower && data.functionalThresholdPower) {
          const tss = calculateCyclingTSS({
            normalizedPower: data.normalizedPower,
            functionalThresholdPower: data.functionalThresholdPower,
            durationSeconds,
          });
          return { tss, method: 'power' };
        }

        // Fallback a estimación por FC
        if (data.averageHeartrate && data.maxHeartrate) {
          const tss = estimateTSSFromHeartrate(
            durationSeconds,
            data.averageHeartrate,
            data.maxHeartrate
          );
          return {
            tss,
            method: 'heartrate',
            details: 'Estimado por FC (no hay datos de potencia)',
          };
        }
        break;
      }

      case ActivityType.RUN:
      case ActivityType.VIRTUAL_RUN: {
        // Usar cálculo por pace
        if (data.distanceMeters && data.thresholdPaceMinPerKm) {
          const tss = calculateRunningTSS({
            distanceMeters: data.distanceMeters,
            durationSeconds,
            thresholdPaceMinPerKm: data.thresholdPaceMinPerKm,
          });
          return { tss, method: 'pace' };
        }

        // Fallback a estimación por FC
        if (data.averageHeartrate && data.maxHeartrate) {
          const tss = estimateTSSFromHeartrate(
            durationSeconds,
            data.averageHeartrate,
            data.maxHeartrate
          );
          return {
            tss,
            method: 'heartrate',
            details: 'Estimado por FC (no hay datos de distancia/ritmo)',
          };
        }
        break;
      }

      case ActivityType.SWIM: {
        if (data.distanceMeters && data.thresholdPaceMinPer100m) {
          const tss = calculateSwimmingTSS({
            distanceMeters: data.distanceMeters,
            durationSeconds,
            thresholdPaceMinPer100m: data.thresholdPaceMinPer100m,
          });
          return { tss, method: 'pace' };
        }
        break;
      }

      default:
        // Para otros tipos de actividad, usar estimación por FC si está disponible
        if (data.averageHeartrate && data.maxHeartrate) {
          const tss = estimateTSSFromHeartrate(
            durationSeconds,
            data.averageHeartrate,
            data.maxHeartrate
          );
          return {
            tss,
            method: 'heartrate',
            details: `Estimado por FC para actividad tipo ${type}`,
          };
        }
    }

    // Si no hay datos suficientes, hacer estimación básica por tiempo
    // 1 hora de actividad moderada ≈ 50-60 TSS
    const estimatedTSS = (durationSeconds / 3600) * 55;
    return {
      tss: Math.round(estimatedTSS * 100) / 100,
      method: 'estimated',
      details: 'Estimación básica por tiempo (datos insuficientes)',
    };
  } catch (error) {
    if (error instanceof TSSCalculationError) {
      // Fallback a estimación por tiempo
      const estimatedTSS = (durationSeconds / 3600) * 55;
      return {
        tss: Math.round(estimatedTSS * 100) / 100,
        method: 'estimated',
        details: `Error en cálculo específico: ${error.message}. Usando estimación por tiempo.`,
      };
    }
    throw error;
  }
}

/**
 * Convierte velocidad (m/s) a ritmo (min/km)
 * Útil para preparar datos de running.
 *
 * @param speedMps - Velocidad en metros por segundo
 * @returns Ritmo en minutos por kilómetro
 */
export function speedToPace(speedMps: number): number {
  if (!speedMps || speedMps <= 0) return 0;
  const paceMinPerKm = 1000 / speedMps / 60;
  return Math.round(paceMinPerKm * 100) / 100;
}

/**
 * Convierte ritmo (min/km) a velocidad (m/s)
 *
 * @param paceMinPerKm - Ritmo en minutos por kilómetro
 * @returns Velocidad en metros por segundo
 */
export function paceToSpeed(paceMinPerKm: number): number {
  if (!paceMinPerKm || paceMinPerKm <= 0) return 0;
  const speedMps = 1000 / (paceMinPerKm * 60);
  return Math.round(speedMps * 100) / 100;
}

/**
 * Calcula la potencia normalizada estimada a partir de potencia promedio.
 * Esto es una simplificación - la NP real requiere datos de potencia segundo a segundo.
 *
 * @param averagePower - Potencia promedio
 * @param variabilityIndex - Índice de variabilidad (default: 1.05 para carretera, 1.15 para montaña)
 * @returns Potencia normalizada estimada
 */
export function estimateNormalizedPower(
  averagePower: number,
  variabilityIndex: number = 1.05
): number {
  if (!averagePower) return 0;
  return Math.round(averagePower * variabilityIndex * 100) / 100;
}

/**
 * Sugerir valores por defecto de FTP basados en peso y género.
 * Basado en tablas de referencia de watts por kg.
 *
 * @param weightKg - Peso en kg
 * @param gender - Género ('M' o 'F')
 * @param fitnessLevel - Nivel de forma: 'recreational' | 'intermediate' | 'advanced' | 'elite'
 * @returns FTP estimado en watts
 */
export function suggestFTP(
  weightKg: number,
  gender: 'M' | 'F' = 'M',
  fitnessLevel: 'recreational' | 'intermediate' | 'advanced' | 'elite' = 'intermediate'
): number {
  // Watts por kg según nivel y género
  const wattsPerKg: Record<string, Record<string, number>> = {
    recreational: { M: 2.0, F: 1.7 },
    intermediate: { M: 2.8, F: 2.3 },
    advanced: { M: 3.8, F: 3.0 },
    elite: { M: 5.0, F: 4.0 },
  };

  const wpk = wattsPerKg[fitnessLevel]?.[gender] ?? wattsPerKg.intermediate?.M ?? 2.8;
  return Math.round(weightKg * wpk);
}

/**
 * Sugerir ritmo umbral para running basado en nivel de forma.
 *
 * @param fitnessLevel - Nivel de forma
 * @returns Ritmo umbral en min/km
 */
export function suggestThresholdPace(
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'elite' = 'intermediate'
): number {
  const paces: Record<string, number> = {
    beginner: 5.5, // ~5:30 min/km
    intermediate: 4.5, // ~4:30 min/km
    advanced: 3.8, // ~3:48 min/km
    elite: 3.2, // ~3:12 min/km
  };
  return paces[fitnessLevel] ?? paces.intermediate ?? 4.5;
}
