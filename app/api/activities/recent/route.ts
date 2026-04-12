import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getRecentActivities } from '@/lib/strava/fetchActivities';
import { Activity, RecentActivitiesResponse } from '@/types/activity';

/**
 * GET /api/activities/recent
 *
 * Devuelve las últimas actividades del atleta autenticado.
 * Intenta obtener de Strava API primero (con cache), fallback a DB si falla.
 *
 * Query params:
 * - limit: número de actividades a devolver (default: 10, max: 50)
 * - athleteId: ID del atleta (requerido)
 * - source: 'strava' | 'db' | 'auto' (default: 'auto')
 *
 * Response:
 * {
 *   activities: Activity[],
 *   totalCount: number,
 *   source: 'strava' | 'db' | 'cache'
 * }
 */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Simple in-memory cache para respuestas exitosas
interface CacheEntry {
  data: RecentActivitiesResponse;
  timestamp: number;
}

const CACHE_TTL_SECONDS = 60;
const responseCache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Obtener query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10),
      MAX_LIMIT
    );
    const athleteId = searchParams.get('athleteId');
    const source = searchParams.get('source') || 'auto';

    // Validar limit
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json({ error: 'limit debe ser un número positivo' }, { status: 400 });
    }

    // Validar athleteId
    if (!athleteId) {
      return NextResponse.json({ error: 'athleteId es requerido' }, { status: 400 });
    }

    // Verificar que el atleta existe
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Atleta no encontrado' }, { status: 404 });
    }

    // Verificar cache de respuesta
    const cacheKey = `${athleteId}:${limit}:${source}`;
    const cached = responseCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_SECONDS * 1000) {
      const responseTime = Date.now() - startTime;
      console.log(`[Activities Recent] Cache HIT for ${cacheKey} (${responseTime}ms)`);

      return NextResponse.json(
        { ...cached.data, source: 'cache', responseTime },
        {
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Age': String(Math.round((now - cached.timestamp) / 1000)),
            'X-Response-Time': `${responseTime}ms`,
          },
        }
      );
    }

    let activities: Activity[] = [];
    let dataSource: 'strava' | 'db' = 'db';

    // Estrategia de obtención de datos
    if (source === 'strava') {
      try {
        // Solo Strava (sin fallback)
        activities = await getRecentActivities(athleteId, limit, true);
        dataSource = 'strava';
      } catch (stravaError) {
        return NextResponse.json(
          {
            error: 'Strava API no disponible',
            details: stravaError instanceof Error ? stravaError.message : 'Unknown error',
          },
          { status: 503 }
        );
      }
    } else if (source === 'auto') {
      // Modo auto: obtener de Strava y complementar con BD (incluyendo manuales)
      try {
        const stravaActivities = await getRecentActivities(athleteId, limit, true);
        const dbActivities = await getActivitiesFromDB(athleteId, limit);
        
        // Combinar: primero Strava, luego manuales de BD que no estén en Strava
        const stravaIds = new Set(stravaActivities.map(a => a.id));
        const manualActivities = dbActivities.filter(a => !stravaIds.has(a.id));
        
        activities = [...stravaActivities, ...manualActivities].slice(0, limit);
        dataSource = 'strava';
      } catch (stravaError) {
        // Si falla Strava, usar solo BD
        console.warn('[Activities Recent] Strava API failed, falling back to DB:', stravaError);
        activities = await getActivitiesFromDB(athleteId, limit);
        dataSource = 'db';
      }
    } else {
      // Source = 'db', obtener solo de base de datos
      activities = await getActivitiesFromDB(athleteId, limit);
    }

    // Contar total de actividades del atleta (siempre de DB para precisión)
    const totalCount = await prisma.activity.count({
      where: { athleteId },
    });

    const response: RecentActivitiesResponse = {
      activities,
      totalCount,
    };

    // Guardar en cache
    responseCache.set(cacheKey, { data: response, timestamp: now });

    const responseTime = Date.now() - startTime;
    console.log(
      `[Activities Recent] ${dataSource.toUpperCase()} fetch for ${cacheKey} (${responseTime}ms)`
    );

    return NextResponse.json(
      { ...response, source: dataSource, responseTime },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-Source': dataSource,
          'X-Response-Time': `${responseTime}ms`,
          'Cache-Control': `private, max-age=${CACHE_TTL_SECONDS}`,
        },
      }
    );
  } catch (error) {
    console.error('[Activities Recent API] Error:', error);

    // Error específico si es problema de base de datos
    if (error instanceof Error && error.message.includes('prisma')) {
      return NextResponse.json(
        { error: 'Error de base de datos al obtener actividades' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Error al obtener actividades recientes' }, { status: 500 });
  }
}

/**
 * Obtiene actividades desde la base de datos local
 */
async function getActivitiesFromDB(athleteId: string, limit: number): Promise<Activity[]> {
  const dbActivities = await prisma.activity.findMany({
    where: { athleteId },
    orderBy: { startDate: 'desc' },
    take: limit,
    select: {
      id: true,
      stravaActivityId: true,
      name: true,
      type: true,
      source: true,
      startDate: true,
      movingTime: true,
      distance: true,
      totalElevationGain: true,
      averageSpeed: true,
      maxSpeed: true,
      averageHeartrate: true,
      maxHeartrate: true,
    },
  });

  return dbActivities.map((activity) => {
    const mapped: Activity = {
      id: activity.stravaActivityId?.toString() ?? activity.id,
      name: activity.name,
      type: mapActivityType(activity.type),
      startDate: activity.startDate.toISOString(),
      duration: activity.movingTime ?? 0,
      distance: activity.distance ?? 0,
      elevationGain: activity.totalElevationGain ?? 0,
      averageSpeed: activity.averageSpeed ?? 0,
      source: (activity.source as 'STRAVA' | 'MANUAL') || 'STRAVA',
    };

    if (activity.maxSpeed != null) mapped.maxSpeed = activity.maxSpeed;
    if (activity.averageHeartrate != null) mapped.averageHeartrate = activity.averageHeartrate;
    if (activity.maxHeartrate != null) mapped.maxHeartrate = activity.maxHeartrate;

    return mapped;
  });
}

/**
 * Mapea el tipo de actividad de Prisma al tipo de la API
 */
function mapActivityType(type: string): Activity['type'] {
  const typeMap: Record<string, Activity['type']> = {
    RUN: 'Run',
    RIDE: 'Ride',
    SWIM: 'Swim',
    HIKE: 'Hike',
    WALK: 'Walk',
    ALPINE_SKI: 'AlpineSki',
    BACKCOUNTRY_SKI: 'BackcountrySki',
    CANOEING: 'Canoeing',
    CROSSFIT: 'Crossfit',
    E_BIKE_RIDE: 'EBikeRide',
    ELLIPTICAL: 'Elliptical',
    GOLF: 'Golf',
    HANDCYCLE: 'Handcycle',
    ICE_SKATE: 'IceSkate',
    INLINE_SKATE: 'InlineSkate',
    KAYAKING: 'Kayaking',
    KITESURF: 'Kitesurf',
    NORDIC_SKI: 'NordicSki',
    ROCK_CLIMBING: 'RockClimbing',
    ROLLER_SKI: 'RollerSki',
    ROWING: 'Rowing',
    SAIL: 'Sail',
    SKATEBOARD: 'Skateboard',
    SNOWBOARD: 'Snowboard',
    SNOWSHOE: 'Snowshoe',
    SOCCER: 'Soccer',
    STAIRSTEPPER: 'StairStepper',
    STAND_UP_PADDLING: 'StandUpPaddling',
    SURFING: 'Surfing',
    VELOMOBILE: 'Velomobile',
    VIRTUAL_RIDE: 'VirtualRide',
    VIRTUAL_RUN: 'VirtualRun',
    WEIGHT_TRAINING: 'WeightTraining',
    WHEELCHAIR: 'Wheelchair',
    WINDSURF: 'Windsurf',
    WORKOUT: 'Workout',
    YOGA: 'Yoga',
  };

  return typeMap[type] || 'Workout';
}
