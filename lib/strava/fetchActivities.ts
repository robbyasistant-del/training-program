/**
 * Strava Activities Fetch Service
 *
 * Servicio para obtener actividades de Strava API con:
 * - Rate limiting integrado
 * - Mapeo a tipo Activity interno
 * - Retry con backoff exponencial
 * - Cache de 60 segundos
 */

import { Activity } from '@/types/activity';

import { fetchFromStrava } from './rate-limiter';

// Interfaz de actividad de Strava API (subset usado)
interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed?: number;
  calories?: number;
  map?: {
    id: string;
    polyline: string | null;
    summary_polyline: string | null;
  };
  average_heartrate?: number;
  max_heartrate?: number;
}

// Cache simple en memoria (TTL: 60 segundos)
interface CacheEntry {
  data: Activity[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 segundos
const activitiesCache = new Map<string, CacheEntry>();

/**
 * Obtiene las actividades recientes del atleta desde Strava API
 *
 * @param athleteId - ID interno del atleta (para obtener token)
 * @param limit - Número máximo de actividades (default: 10, max: 50)
 * @param useCache - Si debe usar cache (default: true)
 * @returns Array de actividades mapeadas al tipo Activity
 * @throws Error si la llamada a Strava falla
 */
export async function getRecentActivities(
  athleteId: string,
  limit: number = 10,
  useCache: boolean = true
): Promise<Activity[]> {
  // Validar límites
  const validatedLimit = Math.min(Math.max(limit, 1), 50);

  // Verificar cache
  const cacheKey = `${athleteId}:${validatedLimit}`;
  if (useCache) {
    const cached = activitiesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[fetchActivities] Cache hit for ${cacheKey}`);
      return cached.data;
    }
  }

  console.log(
    `[fetchActivities] Fetching from Strava for athlete ${athleteId}, limit: ${validatedLimit}`
  );

  try {
    // Llamar a Strava API con rate limiting
    const params = new URLSearchParams({
      per_page: validatedLimit.toString(),
      page: '1',
    });

    const response = await fetchFromStrava(`/athlete/activities?${params.toString()}`, athleteId);
    const stravaActivities = (await response.json()) as StravaActivity[];

    // Mapear a tipo interno
    const activities = stravaActivities.map(mapStravaActivityToActivity);

    // Guardar en cache
    if (useCache) {
      activitiesCache.set(cacheKey, {
        data: activities,
        timestamp: Date.now(),
      });
    }

    return activities;
  } catch (error) {
    console.error('[fetchActivities] Error fetching from Strava:', error);
    throw error;
  }
}

/**
 * Invalida el cache de actividades para un atleta
 *
 * @param athleteId - ID del atleta
 */
export function invalidateActivitiesCache(athleteId: string): void {
  const prefix = `${athleteId}:`;
  for (const key of Array.from(activitiesCache.keys())) {
    if (key.startsWith(prefix)) {
      activitiesCache.delete(key);
    }
  }
  console.log(`[fetchActivities] Cache invalidated for athlete ${athleteId}`);
}

/**
 * Limpia todo el cache de actividades
 */
export function clearActivitiesCache(): void {
  activitiesCache.clear();
  console.log('[fetchActivities] All cache cleared');
}

/**
 * Obtiene el estado actual del cache
 */
export function getCacheStatus(): { size: number; keys: string[] } {
  return {
    size: activitiesCache.size,
    keys: Array.from(activitiesCache.keys()),
  };
}

/**
 * Mapea una actividad de Strava API al tipo Activity interno
 */
function mapStravaActivityToActivity(stravaActivity: StravaActivity): Activity {
  const activity: Activity = {
    id: stravaActivity.id.toString(),
    name: stravaActivity.name,
    type: mapStravaActivityType(stravaActivity.type, stravaActivity.sport_type),
    startDate: stravaActivity.start_date,
    duration: stravaActivity.moving_time,
    distance: stravaActivity.distance,
    elevationGain: stravaActivity.total_elevation_gain || 0,
    averageSpeed: stravaActivity.average_speed || 0,
  };

  // Campos opcionales
  if (stravaActivity.max_speed != null) {
    activity.maxSpeed = stravaActivity.max_speed;
  }
  if (stravaActivity.calories != null) {
    activity.calories = stravaActivity.calories;
  }
  if (stravaActivity.map?.summary_polyline) {
    activity.polyline = stravaActivity.map.summary_polyline;
  }
  if (stravaActivity.average_heartrate != null) {
    activity.averageHeartrate = stravaActivity.average_heartrate;
  }
  if (stravaActivity.max_heartrate != null) {
    activity.maxHeartrate = stravaActivity.max_heartrate;
  }

  return activity;
}

/**
 * Mapea el tipo de actividad de Strava al tipo interno
 */
function mapStravaActivityType(type: string, sportType: string): Activity['type'] {
  const typeMap: Record<string, Activity['type']> = {
    Run: 'Run',
    Ride: 'Ride',
    Swim: 'Swim',
    Hike: 'Hike',
    Walk: 'Walk',
    AlpineSki: 'AlpineSki',
    BackcountrySki: 'BackcountrySki',
    Canoeing: 'Canoeing',
    Crossfit: 'Crossfit',
    EBikeRide: 'EBikeRide',
    Elliptical: 'Elliptical',
    Golf: 'Golf',
    Handcycle: 'Handcycle',
    IceSkate: 'IceSkate',
    InlineSkate: 'InlineSkate',
    Kayaking: 'Kayaking',
    Kitesurf: 'Kitesurf',
    NordicSki: 'NordicSki',
    RockClimbing: 'RockClimbing',
    RollerSki: 'RollerSki',
    Rowing: 'Rowing',
    Sail: 'Sail',
    Skateboard: 'Skateboard',
    Snowboard: 'Snowboard',
    Snowshoe: 'Snowshoe',
    Soccer: 'Soccer',
    StairStepper: 'StairStepper',
    StandUpPaddling: 'StandUpPaddling',
    Surfing: 'Surfing',
    Velomobile: 'Velomobile',
    VirtualRide: 'VirtualRide',
    VirtualRun: 'VirtualRun',
    WeightTraining: 'WeightTraining',
    Wheelchair: 'Wheelchair',
    Windsurf: 'Windsurf',
    Workout: 'Workout',
    Yoga: 'Yoga',
  };

  // Intentar con type primero, luego con sport_type
  return typeMap[type] || typeMap[sportType] || 'Workout';
}

// Re-export para compatibilidad
export type { StravaActivity };
