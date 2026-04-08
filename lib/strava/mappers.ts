/**
 * Mappers para transformar datos de Strava API a modelos internos
 */

import type { ActivityType } from '@prisma/client';

import type { StravaAthlete, StravaActivity } from './api-service';

/**
 * Mapea los datos de atleta de Strava al formato interno
 */
export function mapStravaAthlete(athlete: StravaAthlete) {
  return {
    stravaId: BigInt(athlete.id),
    firstname: athlete.firstname,
    lastname: athlete.lastname,
    profileImage: athlete.profile,
    city: athlete.city,
    country: athlete.country,
    sex: athlete.sex,
    weight: athlete.weight,
  };
}

/**
 * Mapea el tipo de actividad de Strava al enum interno
 */
function mapActivityType(stravaType: string): ActivityType {
  const typeMap: Record<string, ActivityType> = {
    Run: 'RUN',
    Ride: 'RIDE',
    Swim: 'SWIM',
    Hike: 'HIKE',
    Walk: 'WALK',
    AlpineSki: 'ALPINE_SKI',
    BackcountrySki: 'BACKCOUNTRY_SKI',
    Canoeing: 'CANOEING',
    Crossfit: 'CROSSFIT',
    EBikeRide: 'E_BIKE_RIDE',
    Elliptical: 'ELLIPTICAL',
    Golf: 'GOLF',
    Handcycle: 'HANDCYCLE',
    IceSkate: 'ICE_SKATE',
    InlineSkate: 'INLINE_SKATE',
    Kayaking: 'KAYAKING',
    Kitesurf: 'KITESURF',
    NordicSki: 'NORDIC_SKI',
    RockClimbing: 'ROCK_CLIMBING',
    RollerSki: 'ROLLER_SKI',
    Rowing: 'ROWING',
    Sail: 'SAIL',
    Skateboard: 'SKATEBOARD',
    Snowboard: 'SNOWBOARD',
    Snowshoe: 'SNOWSHOE',
    Soccer: 'SOCCER',
    StairStepper: 'STAIRSTEPPER',
    StandUpPaddling: 'STAND_UP_PADDLING',
    Surfing: 'SURFING',
    Velomobile: 'VELOMOBILE',
    VirtualRide: 'VIRTUAL_RIDE',
    VirtualRun: 'VIRTUAL_RUN',
    WeightTraining: 'WEIGHT_TRAINING',
    Wheelchair: 'WHEELCHAIR',
    Windsurf: 'WINDSURF',
    Workout: 'WORKOUT',
    Yoga: 'YOGA',
  };

  return typeMap[stravaType] || 'WORKOUT';
}

/**
 * Mapea los datos de actividad de Strava al formato interno
 */
export function mapStravaActivity(activity: StravaActivity) {
  const mapped: {
    stravaActivityId: bigint;
    name: string;
    type: ActivityType;
    distance: number;
    movingTime: number;
    elapsedTime: number;
    totalElevationGain: number;
    startDate: Date;
    averageSpeed: number;
    maxSpeed: number;
    averageHeartrate?: number | null;
    maxHeartrate?: number | null;
  } = {
    stravaActivityId: BigInt(activity.id),
    name: activity.name,
    type: mapActivityType(activity.type),
    distance: activity.distance,
    movingTime: activity.moving_time,
    elapsedTime: activity.elapsed_time,
    totalElevationGain: activity.total_elevation_gain,
    startDate: new Date(activity.start_date),
    averageSpeed: activity.average_speed,
    maxSpeed: activity.max_speed,
  };

  // Only add optional fields if they exist
  if (activity.average_heartrate !== undefined) {
    mapped.averageHeartrate = activity.average_heartrate;
  } else {
    mapped.averageHeartrate = null;
  }

  if (activity.max_heartrate !== undefined) {
    mapped.maxHeartrate = activity.max_heartrate;
  } else {
    mapped.maxHeartrate = null;
  }

  // Power data (watts)
  if ((activity as any).average_watts !== undefined) {
    (mapped as any).averagePower = (activity as any).average_watts;
  } else {
    (mapped as any).averagePower = null;
  }

  if ((activity as any).max_watts !== undefined) {
    (mapped as any).maxPower = (activity as any).max_watts;
  } else {
    (mapped as any).maxPower = null;
  }

  return mapped;
}

/**
 * Calcula estadísticas de actividades
 */
export function calculateActivityStats(activities: StravaActivity[]) {
  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalMovingTime = activities.reduce((sum, a) => sum + a.moving_time, 0);
  const totalActivities = activities.length;

  return {
    totalDistance,
    totalMovingTime,
    totalActivities,
  };
}
