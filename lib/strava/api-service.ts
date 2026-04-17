/**
 * Strava API Service
 * Servicio singleton para interactuar con la API de Strava
 * Incluye rate limiting (max 100 req/15min = 1 req cada 9s)
 */

import { fetchFromStrava } from './rate-limiter';

interface StravaAthlete {
  id: number;
  username: string | null;
  resource_state: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  sex: string | null;
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  badge_type_id: number;
  weight: number;
  profile_medium: string;
  profile: string;
  friend: boolean | null;
  follower: boolean | null;
}

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    id: string;
    polyline: string | null;
    resource_state: number;
  };
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  visibility: string;
  flagged: boolean;
  gear_id: string | null;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_temp?: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  heartrate_opt_out: boolean;
  display_hide_heartrate_option: boolean;
  elev_high?: number;
  elev_low?: number;
  upload_id: number;
  upload_id_str: string;
  external_id: string | null;
  from_accepted_tag: boolean;
  pr_count: number;
  total_photo_count: number;
  has_kudoed: boolean;
  workout_type?: number;
  description?: string;
  calories?: number;
  segment_efforts?: unknown[];
  splits_metric?: unknown[];
  splits_standard?: unknown[];
  laps?: unknown[];
  gear?: unknown;
  partner_brand_tag?: unknown;
  photos?: unknown;
  highlighted_kudosers?: unknown[];
  device_name?: string;
  embed_token?: string;
  similar_activities?: unknown;
  available_zones?: unknown[];
}

// fetchFromStrava is now imported from './rate-limiter'

/**
 * Obtiene el perfil del atleta desde Strava
 */
export async function getAthleteProfile(athleteId: string): Promise<StravaAthlete> {
  const response = await fetchFromStrava('/athlete', athleteId);
  return response.json() as Promise<StravaAthlete>;
}

/**
 * Obtiene las actividades del atleta desde Strava
 * @param after - Timestamp Unix opcional para filtrar actividades después de esta fecha
 */
export async function getAthleteActivities(
  athleteId: string,
  page: number = 1,
  perPage: number = 200,
  after?: number
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });

  // Si se proporciona 'after', filtrar actividades después de esa fecha
  if (after) {
    params.append('after', after.toString());
  }

  const response = await fetchFromStrava(`/athlete/activities?${params.toString()}`, athleteId);
  return response.json() as Promise<StravaActivity[]>;
}

/**
 * Obtiene una página de actividades y devuelve si hay más páginas
 * @param after - Timestamp Unix opcional para filtrar actividades después de esta fecha
 */
export async function fetchActivitiesPage(
  athleteId: string,
  page: number,
  perPage: number = 200,
  after?: number
): Promise<{ activities: StravaActivity[]; hasMore: boolean }> {
  const activities = await getAthleteActivities(athleteId, page, perPage, after);
  return {
    activities,
    hasMore: activities.length === perPage,
  };
}

// Interfaces para estadísticas del atleta
interface AthleteStats {
  biggest_ride_distance: number;
  biggest_climb_elevation_gain: number;
  recent_ride_totals: ActivityTotals;
  recent_run_totals: ActivityTotals;
  recent_swim_totals: ActivityTotals;
  ytd_ride_totals: ActivityTotals;
  ytd_run_totals: ActivityTotals;
  ytd_swim_totals: ActivityTotals;
  all_ride_totals: ActivityTotals;
  all_run_totals: ActivityTotals;
  all_swim_totals: ActivityTotals;
}

interface ActivityTotals {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
  achievement_count?: number;
}

export type { StravaAthlete, StravaActivity, AthleteStats };

/**
 * Obtiene estadísticas del atleta desde Strava
 * Incluye totales, récords personales y más
 */
export async function getAthleteStats(athleteId: string, stravaAthleteId: number): Promise<AthleteStats | null> {
  try {
    const response = await fetchFromStrava(`/athletes/${stravaAthleteId}/stats`, athleteId);
    return (await response.json()) as AthleteStats;
  } catch (error) {
    console.error('[Strava API] Error fetching athlete stats:', error);
    return null;
  }
}

/**
 * Obtiene una actividad específica por su ID de Strava
 * @param athleteId - ID del atleta
 * @param activityId - ID de la actividad en Strava
 * @returns Datos de la actividad
 */
export async function fetchActivityById(
  athleteId: string,
  activityId: bigint
): Promise<StravaActivity | null> {
  try {
    const response = await fetchFromStrava(`/activities/${activityId}`, athleteId);
    return (await response.json()) as StravaActivity;
  } catch (error) {
    console.error('[Strava API] Error fetching activity:', error);
    return null;
  }
}

/**
 * Obtiene los streams (datos detallados) de una actividad
 * Incluye series temporales de watts, velocidad, cadencia, etc.
 */
export async function getActivityStreams(
  athleteId: string,
  activityId: bigint,
  types: string[] = ['watts', 'velocity_smooth', 'heartrate', 'cadence', 'temp']
): Promise<Record<string, { data: number[]; series_type: string; original_size: number; resolution: string }> | null> {
  try {
    const typesParam = types.join(',');
    const response = await fetchFromStrava(`/activities/${activityId}/streams?keys=${typesParam}&key_by_type=true`, athleteId);
    return (await response.json()) as Record<string, { data: number[]; series_type: string; original_size: number; resolution: string }>;
  } catch (error) {
    console.error('[Strava API] Error fetching activity streams:', error);
    return null;
  }
}
