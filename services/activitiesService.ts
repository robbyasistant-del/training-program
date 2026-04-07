/**
 * Activities Service
 *
 * Servicio para obtener y gestionar actividades del atleta.
 * Proporciona funciones para comunicarse con la API de actividades.
 */

import { Activity, RecentActivitiesResponse } from '@/types/activity';

/**
 * Opciones para obtener actividades recientes
 */
interface GetRecentActivitiesOptions {
  /** ID del atleta (requerido) */
  athleteId: string;
  /** Número de actividades a obtener (default: 10) */
  limit?: number;
  /** Fuente de datos: 'strava' | 'db' | 'auto' (default: 'auto') */
  source?: 'strava' | 'db' | 'auto';
}

/**
 * Opciones para obtener estadísticas semanales
 */
interface GetWeeklyStatsOptions {
  /** ID del atleta (requerido) */
  athleteId: string;
  /** Offset de semanas (0 = semana actual, -1 = anterior, etc.) */
  weekOffset?: number;
}

/**
 * Estadísticas semanales del atleta
 */
interface WeeklyStats {
  week: {
    start: string;
    end: string;
    label: string;
  };
  summary: {
    totalDistance: number;
    totalTime: number;
    totalElevation: number;
    activityCount: number;
    avgSpeed: number;
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

/**
 * Resultado de la operación con metadatos
 */
interface ServiceResult<T> {
  /** Datos obtenidos */
  data: T;
  /** Fuente de los datos */
  source: 'strava' | 'db' | 'cache';
  /** Tiempo de respuesta en ms */
  responseTime: number;
  /** Timestamp de la petición */
  timestamp: number;
}

/**
 * Error del servicio
 */
class ActivitiesServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ActivitiesServiceError';
  }
}

/**
 * Obtiene las actividades recientes del atleta
 *
 * @param options - Opciones de la petición
 * @returns Promise con las actividades y metadatos
 * @throws ActivitiesServiceError si hay un error
 *
 * @example
 * ```typescript
 * const { data, source } = await getRecentActivities({
 *   athleteId: '123',
 *   limit: 10,
 *   source: 'auto'
 * });
 * console.log(`Obtenidas ${data.activities.length} actividades desde ${source}`);
 * ```
 */
export async function getRecentActivities(
  options: GetRecentActivitiesOptions
): Promise<ServiceResult<RecentActivitiesResponse>> {
  const { athleteId, limit = 10, source = 'auto' } = options;

  if (!athleteId) {
    throw new ActivitiesServiceError('athleteId es requerido', 400, 'MISSING_ATHLETE_ID');
  }

  const startTime = Date.now();

  try {
    const params = new URLSearchParams({
      athleteId,
      limit: limit.toString(),
      source,
    });

    const response = await fetch(`/api/activities/recent?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new ActivitiesServiceError(
          'Sesión expirada. Por favor, inicia sesión nuevamente.',
          401,
          'SESSION_EXPIRED'
        );
      }

      if (response.status === 404) {
        throw new ActivitiesServiceError('Atleta no encontrado.', 404, 'ATHLETE_NOT_FOUND');
      }

      if (response.status === 503) {
        throw new ActivitiesServiceError(
          errorData.error || 'Servicio temporalmente no disponible. Intenta más tarde.',
          503,
          'SERVICE_UNAVAILABLE'
        );
      }

      throw new ActivitiesServiceError(
        errorData.error || 'Error al cargar actividades recientes',
        response.status,
        'FETCH_ERROR'
      );
    }

    const result = await response.json();
    const responseTime = Date.now() - startTime;

    return {
      data: {
        activities: result.activities,
        totalCount: result.totalCount,
      },
      source: result.source || 'db',
      responseTime: result.responseTime || responseTime,
      timestamp: Date.now(),
    };
  } catch (error) {
    if (error instanceof ActivitiesServiceError) {
      throw error;
    }

    throw new ActivitiesServiceError(
      error instanceof Error ? error.message : 'Error desconocido al obtener actividades',
      undefined,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Obtiene las estadísticas semanales del atleta
 *
 * @param options - Opciones de la petición
 * @returns Promise con las estadísticas y metadatos
 * @throws ActivitiesServiceError si hay un error
 *
 * @example
 * ```typescript
 * const { data } = await getWeeklyStats({
 *   athleteId: '123',
 *   weekOffset: 0
 * });
 * console.log(`Distancia total: ${data.summary.totalDistance} km`);
 * ```
 */
export async function getWeeklyStats(
  options: GetWeeklyStatsOptions
): Promise<ServiceResult<WeeklyStats>> {
  const { athleteId, weekOffset = 0 } = options;

  if (!athleteId) {
    throw new ActivitiesServiceError('athleteId es requerido', 400, 'MISSING_ATHLETE_ID');
  }

  const startTime = Date.now();

  try {
    const params = new URLSearchParams({
      athleteId,
      weekOffset: weekOffset.toString(),
    });

    const response = await fetch(`/api/dashboard/stats?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new ActivitiesServiceError(
          'Sesión expirada. Por favor, inicia sesión nuevamente.',
          401,
          'SESSION_EXPIRED'
        );
      }

      throw new ActivitiesServiceError(
        errorData.error || 'Error al cargar estadísticas',
        response.status,
        'FETCH_ERROR'
      );
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    return {
      data,
      source: 'db',
      responseTime,
      timestamp: Date.now(),
    };
  } catch (error) {
    if (error instanceof ActivitiesServiceError) {
      throw error;
    }

    throw new ActivitiesServiceError(
      error instanceof Error ? error.message : 'Error desconocido al obtener estadísticas',
      undefined,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Obtiene el perfil del atleta con estadísticas
 *
 * @param athleteId - ID del atleta
 * @returns Promise con el perfil y metadatos
 * @throws ActivitiesServiceError si hay un error
 */
export async function getAthleteProfile(athleteId: string): Promise<
  ServiceResult<{
    name: string;
    avatar?: string;
    stravaConnected: boolean;
    stats: {
      totalActivities: number;
      totalDistance: number;
      totalTime: number;
    };
  }>
> {
  if (!athleteId) {
    throw new ActivitiesServiceError('athleteId es requerido', 400, 'MISSING_ATHLETE_ID');
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`/api/athlete/profile?athleteId=${athleteId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new ActivitiesServiceError('Error al cargar perfil', response.status, 'FETCH_ERROR');
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    return {
      data,
      source: 'db',
      responseTime,
      timestamp: Date.now(),
    };
  } catch (error) {
    if (error instanceof ActivitiesServiceError) {
      throw error;
    }

    throw new ActivitiesServiceError(
      error instanceof Error ? error.message : 'Error desconocido',
      undefined,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Sincroniza actividades con Strava
 *
 * @param athleteId - ID del atleta
 * @returns Promise con el resultado de la sincronización
 */
export async function syncActivities(athleteId: string): Promise<{
  success: boolean;
  syncedCount: number;
  message: string;
}> {
  if (!athleteId) {
    throw new ActivitiesServiceError('athleteId es requerido', 400, 'MISSING_ATHLETE_ID');
  }

  try {
    const response = await fetch('/api/strava/sync/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ athleteId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ActivitiesServiceError(
        errorData.error || 'Error al sincronizar',
        response.status,
        'SYNC_ERROR'
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ActivitiesServiceError) {
      throw error;
    }

    throw new ActivitiesServiceError(
      error instanceof Error ? error.message : 'Error desconocido durante sincronización',
      undefined,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Datos mock para desarrollo y testing
 */
export const mockActivities: Activity[] = [
  {
    id: '1',
    name: 'Morning Run - Parque Central',
    type: 'Run',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 horas atrás
    duration: 3600, // 1 hora
    distance: 8500, // 8.5 km
    elevationGain: 45,
    averageSpeed: 2.36,
    averageHeartrate: 155,
  },
  {
    id: '2',
    name: 'Ciclismo por la costa',
    type: 'Ride',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // Ayer
    duration: 7200, // 2 horas
    distance: 42000, // 42 km
    elevationGain: 120,
    averageSpeed: 5.83,
    averageHeartrate: 142,
  },
  {
    id: '3',
    name: 'Natación - Piscina Municipal',
    type: 'Swim',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // Hace 2 días
    duration: 2700, // 45 min
    distance: 1500, // 1.5 km
    elevationGain: 0,
    averageSpeed: 0.56,
    averageHeartrate: 148,
  },
  {
    id: '4',
    name: 'Senderismo - Monte Verde',
    type: 'Hike',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // Hace 3 días
    duration: 10800, // 3 horas
    distance: 12000, // 12 km
    elevationGain: 450,
    averageSpeed: 1.11,
    averageHeartrate: 138,
  },
  {
    id: '5',
    name: 'Entrenamiento de fuerza',
    type: 'WeightTraining',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // Hace 4 días
    duration: 2700, // 45 min
    distance: 0,
    elevationGain: 0,
    averageSpeed: 0,
    averageHeartrate: 125,
  },
  {
    id: '6',
    name: 'Evening Run - Vuelta corta',
    type: 'Run',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), // Hace 5 días
    duration: 1800, // 30 min
    distance: 5200, // 5.2 km
    elevationGain: 25,
    averageSpeed: 2.89,
    averageHeartrate: 162,
  },
  {
    id: '7',
    name: 'Ciclismo de montaña',
    type: 'Ride',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(), // Hace 6 días
    duration: 5400, // 1.5 horas
    distance: 28000, // 28 km
    elevationGain: 380,
    averageSpeed: 5.19,
    averageHeartrate: 158,
  },
  {
    id: '8',
    name: 'Caminata matutina',
    type: 'Walk',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString(), // Hace 7 días
    duration: 3600, // 1 hora
    distance: 5500, // 5.5 km
    elevationGain: 15,
    averageSpeed: 1.53,
    averageHeartrate: 115,
  },
  {
    id: '9',
    name: 'Long Run - Preparación maratón',
    type: 'Run',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 192).toISOString(), // Hace 8 días
    duration: 9000, // 2.5 horas
    distance: 21000, // 21 km
    elevationGain: 85,
    averageSpeed: 2.33,
    averageHeartrate: 152,
  },
  {
    id: '10',
    name: 'CrossFit WOD',
    type: 'Crossfit',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 216).toISOString(), // Hace 9 días
    duration: 2400, // 40 min
    distance: 0,
    elevationGain: 0,
    averageSpeed: 0,
    averageHeartrate: 175,
  },
  {
    id: '11',
    name: 'Natación técnica',
    type: 'Swim',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(), // Hace 10 días
    duration: 1800, // 30 min
    distance: 1000, // 1 km
    elevationGain: 0,
    averageSpeed: 0.56,
    averageHeartrate: 140,
  },
  {
    id: '12',
    name: 'Carrera de montaña',
    type: 'Run',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 264).toISOString(), // Hace 11 días
    duration: 6300, // 1.75 horas
    distance: 15000, // 15 km
    elevationGain: 520,
    averageSpeed: 2.38,
    averageHeartrate: 168,
  },
  {
    id: '13',
    name: 'Yoga - Clase grupal',
    type: 'Workout',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 288).toISOString(), // Hace 12 días
    duration: 3600, // 1 hora
    distance: 0,
    elevationGain: 0,
    averageSpeed: 0,
    averageHeartrate: 95,
  },
  {
    id: '14',
    name: 'Ciclismo largo con amigos',
    type: 'Ride',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 312).toISOString(), // Hace 13 días
    duration: 10800, // 3 horas
    distance: 75000, // 75 km
    elevationGain: 220,
    averageSpeed: 6.94,
    averageHeartrate: 145,
  },
  {
    id: '15',
    name: 'Intervalos en pista',
    type: 'Run',
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 336).toISOString(), // Hace 14 días
    duration: 2400, // 40 min
    distance: 6000, // 6 km
    elevationGain: 0,
    averageSpeed: 2.5,
    averageHeartrate: 178,
  },
];

// Exportar tipos
export type { GetRecentActivitiesOptions, GetWeeklyStatsOptions, WeeklyStats, ServiceResult };
export { ActivitiesServiceError };
