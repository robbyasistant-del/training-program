/**
 * Activity type representing a Strava activity
 */
export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  startDate: string;
  duration: number; // segundos
  distance: number; // metros
  elevationGain: number; // metros
  averageSpeed: number; // m/s
  maxSpeed?: number; // m/s
  calories?: number;
  polyline?: string;
  averageHeartrate?: number;
  maxHeartrate?: number;
}

/**
 * Tipos de actividad soportados
 */
export type ActivityType =
  | 'Run'
  | 'Ride'
  | 'Swim'
  | 'Hike'
  | 'Walk'
  | 'AlpineSki'
  | 'BackcountrySki'
  | 'Canoeing'
  | 'Crossfit'
  | 'EBikeRide'
  | 'Elliptical'
  | 'Golf'
  | 'Handcycle'
  | 'IceSkate'
  | 'InlineSkate'
  | 'Kayaking'
  | 'Kitesurf'
  | 'NordicSki'
  | 'RockClimbing'
  | 'RollerSki'
  | 'Rowing'
  | 'Sail'
  | 'Skateboard'
  | 'Snowboard'
  | 'Snowshoe'
  | 'Soccer'
  | 'StairStepper'
  | 'StandUpPaddling'
  | 'Surfing'
  | 'Velomobile'
  | 'VirtualRide'
  | 'VirtualRun'
  | 'WeightTraining'
  | 'Wheelchair'
  | 'Windsurf'
  | 'Workout'
  | 'Yoga'
  | 'Workout';

/**
 * Respuesta del endpoint de actividades recientes
 */
export interface RecentActivitiesResponse {
  activities: Activity[];
  totalCount: number;
}
