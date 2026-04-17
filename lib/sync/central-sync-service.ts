/**
 * Central Sync Service
 * Servicio centralizado para sincronizar todos los datos desde Strava a la BD local
 * Maneja: actividades, perfil, PRs de distancia, PRs de potencia, estadísticas
 */

import { prisma } from '@/lib/db';
import { 
  fetchActivitiesPage, 
  getAthleteProfile, 
  getAthleteStats,
  getActivityStreams 
} from '@/lib/strava/api-service';
import { mapStravaActivity } from '@/lib/strava/mappers';

export interface SyncStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  total: number;
  message: string;
}

export interface SyncState {
  isRunning: boolean;
  stages: SyncStage[];
  currentStage: string | null;
  overallProgress: number;
  errors: string[];
  lastSyncAt: Date | null;
}

// Estado global de sincronización (en memoria para el servidor)
const syncStates = new Map<string, SyncState>();

const SYNC_STAGES = [
  { id: 'profile', name: 'Perfil del atleta' },
  { id: 'activities', name: 'Actividades' },
  { id: 'power-data', name: 'Datos de potencia' },
  { id: 'calculate-prs', name: 'Cálculo de récords' },
  { id: 'stats', name: 'Estadísticas' },
];

const DELTA_SYNC_STAGES = [
  { id: 'profile', name: 'Perfil del atleta' },
  { id: 'activities', name: 'Actividades nuevas' },
  { id: 'power-data', name: 'Datos de potencia (delta)' },
  { id: 'calculate-prs', name: 'Actualización de récords' },
  { id: 'stats', name: 'Estadísticas' },
];

/**
 * Obtiene el estado de sincronización de un atleta
 */
export function getSyncState(athleteId: string): SyncState {
  return syncStates.get(athleteId) || {
    isRunning: false,
    stages: SYNC_STAGES.map(s => ({
      ...s,
      status: 'pending' as const,
      progress: 0,
      total: 0,
      message: 'Pendiente',
    })),
    currentStage: null,
    overallProgress: 0,
    errors: [],
    lastSyncAt: null,
  };
}

/**
 * Inicia una sincronización completa
 */
export async function startFullSync(athleteId: string): Promise<void> {
  // Verificar si ya hay una sincronización en curso
  const existingState = syncStates.get(athleteId);
  if (existingState?.isRunning) {
    throw new Error('Ya hay una sincronización en curso');
  }

  // Inicializar estado
  const state: SyncState = {
    isRunning: true,
    stages: SYNC_STAGES.map(s => ({
      ...s,
      status: 'pending',
      progress: 0,
      total: 0,
      message: 'Pendiente',
    })),
    currentStage: null,
    overallProgress: 0,
    errors: [],
    lastSyncAt: null,
  };
  syncStates.set(athleteId, state);

  try {
    // Etapa 1: Perfil
    await updateStage(athleteId, 'profile', 'running', 0, 1, 'Obteniendo perfil...');
    await syncProfile(athleteId);
    await updateStage(athleteId, 'profile', 'completed', 1, 1, 'Perfil actualizado');

    // Etapa 2: Actividades (FULL SYNC - todas las actividades)
    await updateStage(athleteId, 'activities', 'running', 0, 100, 'Descargando actividades históricas...');
    const activitiesResult = await syncActivities(athleteId, (progress, total, message) => {
      updateStage(athleteId, 'activities', 'running', progress, total, message);
    });
    await updateStage(athleteId, 'activities', 'completed', 100, 100, 
      `${activitiesResult.imported} actividades sincronizadas`);

    // Etapa 3: Datos de potencia (streams)
    await updateStage(athleteId, 'power-data', 'running', 0, 100, 'Analizando datos de potencia...');
    await syncPowerData(athleteId, (progress) => {
      updateStage(athleteId, 'power-data', 'running', progress, 100, 'Procesando streams...');
    });
    await updateStage(athleteId, 'power-data', 'completed', 100, 100, 'Datos de potencia listos');

    // Etapa 4: Calcular PRs (full recalculation)
    await updateStage(athleteId, 'calculate-prs', 'running', 0, 100, 'Calculando récords personales...');
    await syncAthleteRecords(athleteId, (progress) => {
      updateStage(athleteId, 'calculate-prs', 'running', progress, 100, 'Procesando PRs...');
    });
    await updateStage(athleteId, 'calculate-prs', 'completed', 100, 100, 'Récords calculados');

    // Etapa 5: Estadísticas
    await updateStage(athleteId, 'stats', 'running', 0, 1, 'Obteniendo estadísticas...');
    await syncStats(athleteId);
    await updateStage(athleteId, 'stats', 'completed', 1, 1, 'Estadísticas actualizadas');

    // Actualizar fecha de sincronización
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { 
        lastSyncAt: new Date(),
        syncStatus: 'completed',
      },
    });

    // Marcar como completado
    const finalState = syncStates.get(athleteId);
    if (finalState) {
      finalState.isRunning = false;
      finalState.overallProgress = 100;
      finalState.lastSyncAt = new Date();
    }

  } catch (error) {
    const state = syncStates.get(athleteId);
    if (state) {
      state.isRunning = false;
      state.errors.push(error instanceof Error ? error.message : 'Error desconocido');
    }
    throw error;
  }
}

/**
 * Inicia una sincronización delta (solo cambios desde la última sincronización)
 * Mucho más rápida que full sync
 */
export async function startDeltaSync(athleteId: string): Promise<void> {
  // Verificar si ya hay una sincronización en curso
  const existingState = syncStates.get(athleteId);
  if (existingState?.isRunning) {
    throw new Error('Ya hay una sincronización en curso');
  }

  // Obtener última sincronización
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { lastSyncAt: true, weight: true },
  });

  const lastSyncAt = athlete?.lastSyncAt;
  const lastSyncTimestamp = lastSyncAt ? Math.floor(lastSyncAt.getTime() / 1000) : undefined;

  // Inicializar estado
  const state: SyncState = {
    isRunning: true,
    stages: DELTA_SYNC_STAGES.map(s => ({
      ...s,
      status: 'pending',
      progress: 0,
      total: 0,
      message: 'Pendiente',
    })),
    currentStage: null,
    overallProgress: 0,
    errors: [],
    lastSyncAt: lastSyncAt,
  };
  syncStates.set(athleteId, state);

  try {
    // Etapa 1: Perfil (siempre verificar cambios)
    await updateStage(athleteId, 'profile', 'running', 0, 1, 'Verificando perfil...');
    const profileChanged = await syncProfileDelta(athleteId);
    await updateStage(athleteId, 'profile', 'completed', 1, 1, 
      profileChanged ? 'Perfil actualizado' : 'Sin cambios en perfil');

    // Etapa 2: Actividades (DELTA - solo nuevas desde lastSyncAt)
    await updateStage(athleteId, 'activities', 'running', 0, 100, 
      lastSyncAt ? `Buscando actividades nuevas desde ${lastSyncAt.toLocaleDateString('es-ES')}...` : 'Descargando actividades...');
    
    const activitiesResult = await syncActivitiesDelta(athleteId, lastSyncTimestamp, (progress, total, message) => {
      updateStage(athleteId, 'activities', 'running', progress, total, message);
    });
    
    await updateStage(athleteId, 'activities', 'completed', 100, 100, 
      activitiesResult.imported > 0 
        ? `${activitiesResult.imported} actividades nuevas sincronizadas`
        : 'Sin actividades nuevas');

    // Etapa 3: Datos de potencia (solo para nuevas actividades)
    if (activitiesResult.imported > 0) {
      await updateStage(athleteId, 'power-data', 'running', 0, 100, 'Analizando potencia de nuevas actividades...');
      await syncPowerDataDelta(athleteId, activitiesResult.syncedIds, (progress) => {
        updateStage(athleteId, 'power-data', 'running', progress, 100, 'Procesando streams...');
      });
      await updateStage(athleteId, 'power-data', 'completed', 100, 100, 'Datos de potencia listos');

      // Etapa 4: Recalcular PRs (incremental - solo si hay nuevas actividades)
      await updateStage(athleteId, 'calculate-prs', 'running', 0, 100, 'Recalculando récords con nuevas actividades...');
      await recalculateRecordsDelta(athleteId, activitiesResult.syncedActivities, athlete?.weight || 70, (progress) => {
        updateStage(athleteId, 'calculate-prs', 'running', progress, 100, 'Procesando PRs...');
      });
      await updateStage(athleteId, 'calculate-prs', 'completed', 100, 100, 'Récords actualizados');
    } else {
      // Saltar etapas si no hay actividades nuevas
      await updateStage(athleteId, 'power-data', 'completed', 100, 100, 'Sin actividades nuevas');
      await updateStage(athleteId, 'calculate-prs', 'completed', 100, 100, 'Sin cambios en récords');
    }

    // Etapa 5: Estadísticas
    await updateStage(athleteId, 'stats', 'running', 0, 1, 'Actualizando estadísticas...');
    await syncStats(athleteId);
    await updateStage(athleteId, 'stats', 'completed', 1, 1, 'Estadísticas actualizadas');

    // Actualizar fecha de sincronización
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { 
        lastSyncAt: new Date(),
        syncStatus: 'completed',
      },
    });

    // Marcar como completado
    const finalState = syncStates.get(athleteId);
    if (finalState) {
      finalState.isRunning = false;
      finalState.overallProgress = 100;
      finalState.lastSyncAt = new Date();
    }

  } catch (error) {
    const state = syncStates.get(athleteId);
    if (state) {
      state.isRunning = false;
      state.errors.push(error instanceof Error ? error.message : 'Error desconocido');
    }
    throw error;
  }
}

/**
 * Actualiza el estado de una etapa
 */
async function updateStage(
  athleteId: string, 
  stageId: string, 
  status: SyncStage['status'], 
  progress: number, 
  total: number,
  message: string
): Promise<void> {
  const state = syncStates.get(athleteId);
  if (!state) return;

  const stage = state.stages.find(s => s.id === stageId);
  if (stage) {
    stage.status = status;
    stage.progress = progress;
    stage.total = total;
    stage.message = message;
  }

  if (status === 'running') {
    state.currentStage = stageId;
  }

  // Calcular progreso global
  const completedStages = state.stages.filter(s => s.status === 'completed').length;
  const runningStage = state.stages.find(s => s.status === 'running');
  
  let overallProgress = (completedStages / state.stages.length) * 100;
  if (runningStage) {
    const stageProgress = (runningStage.progress / runningStage.total) * (100 / state.stages.length);
    overallProgress += stageProgress;
  }
  state.overallProgress = Math.min(Math.round(overallProgress), 100);
}

/**
 * Sincroniza el perfil del atleta
 */
async function syncProfile(athleteId: string): Promise<void> {
  const stravaProfile = await getAthleteProfile(athleteId);
  
  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      firstname: stravaProfile.firstname,
      lastname: stravaProfile.lastname,
      profileImage: stravaProfile.profile,
      city: stravaProfile.city,
      country: stravaProfile.country,
      sex: stravaProfile.sex,
      weight: stravaProfile.weight,
      updatedAt: new Date(),
    },
  });
}

/**
 * Sincroniza actividades con callback de progreso
 */
async function syncActivities(
  athleteId: string, 
  onProgress: (progress: number, total: number, message: string) => void
): Promise<{ imported: number; total: number }> {
  let imported = 0;
  let page = 1;
  let hasMore = true;
  const limit = 200;
  const syncedActivities: any[] = [];

  while (hasMore && imported < limit) {
    const { activities, hasMore: morePages } = await fetchActivitiesPage(athleteId, page, 100);

    for (const activity of activities) {
      if (imported >= limit) break;

      try {
        const mappedActivity = mapStravaActivity(activity);

        await prisma.activity.upsert({
          where: { stravaActivityId: BigInt(activity.id) },
          create: {
            ...mappedActivity,
            athleteId,
          },
          update: {
            name: mappedActivity.name,
            type: mappedActivity.type,
            distance: mappedActivity.distance,
            movingTime: mappedActivity.movingTime,
            elapsedTime: mappedActivity.elapsedTime,
            totalElevationGain: mappedActivity.totalElevationGain,
            startDate: mappedActivity.startDate,
            averageSpeed: mappedActivity.averageSpeed,
            maxSpeed: mappedActivity.maxSpeed,
            ...(mappedActivity.averageHeartrate !== undefined && {
              averageHeartrate: mappedActivity.averageHeartrate,
            }),
            ...(mappedActivity.maxHeartrate !== undefined && {
              maxHeartrate: mappedActivity.maxHeartrate,
            }),
            ...((mappedActivity as any).averagePower !== undefined && {
              averagePower: (mappedActivity as any).averagePower,
            }),
            ...((mappedActivity as any).maxPower !== undefined && {
              maxPower: (mappedActivity as any).maxPower,
            }),
          },
        });

        imported++;
        syncedActivities.push({
          id: activity.id.toString(),
          distance: activity.distance,
          movingTime: activity.moving_time,
          startDate: new Date(activity.start_date),
          type: activity.type,
          elapsedTime: activity.elapsed_time,
          totalElevationGain: activity.total_elevation_gain,
          averageSpeed: activity.average_speed,
        });

        onProgress(imported, limit, `Sincronizando actividad ${imported} de ${limit}...`);

      } catch (error) {
        console.error(`Error syncing activity ${activity.id}:`, error);
      }
    }

    hasMore = morePages && activities.length > 0 && imported < limit;
    page++;

    if (hasMore && imported < limit) {
      await sleep(9000); // Rate limiting: 9 segundos entre requests
    }
  }

  return { imported, total: imported };
}

/**
 * Sincroniza datos de potencia desde streams
 */
async function syncPowerData(
  athleteId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  // Obtener actividades con potencia
  const activities = await prisma.activity.findMany({
    where: { 
      athleteId,
      averagePower: { not: null },
    },
    orderBy: { startDate: 'desc' },
    take: 20, // Analizar las 20 más recientes con potencia
  });

  let processed = 0;
  for (const activity of activities) {
    try {
      if (!activity.stravaActivityId) {
        processed++;
        continue;
      }
      
      const streams = await getActivityStreams(
        athleteId, 
        activity.stravaActivityId, 
        ['watts']
      );
      
      if (streams?.watts?.data) {
        // Aquí podríamos guardar los streams procesados si fuera necesario
        // Por ahora, solo verificamos que existen
      }
      
      processed++;
      onProgress(Math.round((processed / activities.length) * 100));
      
      // Rate limiting
      if (processed < activities.length) {
        await sleep(2000);
      }
    } catch (error) {
      console.error(`Error fetching streams for activity ${activity.id}:`, error);
    }
  }
}

/**
 * Sincroniza estadísticas del atleta
 */
async function syncStats(athleteId: string): Promise<void> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { stravaId: true },
  });

  if (!athlete?.stravaId) return;

  const stats = await getAthleteStats(athleteId, Number(athlete.stravaId));
  
  if (!stats) return;

  // Guardar o actualizar estadísticas (podríamos crear un modelo Stats si es necesario)
  // Por ahora, las estadísticas se calculan sobre la marcha desde las actividades
}

/**
 * Calcula y guarda los récords del atleta
 */
async function syncAthleteRecords(
  athleteId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { weight: true },
  });

  const weight = athlete?.weight || 70;

  // Obtener SOLO actividades de CICLISMO (Ride y VirtualRide)
  const activities = await prisma.activity.findMany({
    where: { 
      athleteId,
      type: { in: ['RIDE', 'VIRTUAL_RIDE'] },
    },
    orderBy: { startDate: 'desc' },
  });

  onProgress(10);

  // Calcular PRs de distancia para CICLISMO
  const distances = [
    { dist: 5000, field: 'pr5km', label: '5 km' },
    { dist: 10000, field: 'pr10km', label: '10 km' },
    { dist: 20000, field: 'pr20km', label: '20 km' },
    { dist: 30000, field: 'pr30km', label: '30 km' },
    { dist: 50000, field: 'pr50km', label: '50 km' },
    { dist: 75000, field: 'pr75km', label: '75 km' },
    { dist: 90000, field: 'pr90km', label: '90 km' },
    { dist: 100000, field: 'pr100km', label: '100 km' },
  ];

  const prData: Record<string, number | null> = {};

  for (const { dist, field } of distances) {
    const matching = activities.filter(a => {
      if (!a.distance) return false;
      const tolerance = dist * 0.02;
      return a.distance >= dist - tolerance && a.distance <= dist + tolerance;
    });

    if (matching.length > 0) {
      const best = matching.reduce((min, a) => 
        a.movingTime && a.movingTime < (min.movingTime || Infinity) ? a : min
      );
      prData[field] = best.movingTime;
    } else {
      prData[field] = null;
    }
  }

  onProgress(50);

  // Calcular PRs de potencia y distancia con STREAMS reales de Strava
  const powerDurations = [
    { dur: 5, field: 'power5s' },
    { dur: 15, field: 'power15s' },
    { dur: 30, field: 'power30s' },
    { dur: 60, field: 'power1m' },
    { dur: 120, field: 'power2m' },
    { dur: 180, field: 'power3m' },
    { dur: 300, field: 'power5m' },
    { dur: 480, field: 'power8m' },
    { dur: 600, field: 'power10m' },
    { dur: 900, field: 'power15m' },
    { dur: 1200, field: 'power20m' },
    { dur: 1800, field: 'power30m' },
    { dur: 2700, field: 'power45m' },
    { dur: 3600, field: 'power1h' },
    { dur: 7200, field: 'power2h' },
  ];

  for (const { field } of powerDurations) prData[field] = null;

  const cyclingActivities = activities.filter(a => a.stravaActivityId);
  let processed = 0;

  for (const activity of cyclingActivities) {
    try {
      if (!activity.stravaActivityId) continue;
      
      const streams = await getActivityStreams(
        athleteId,
        activity.stravaActivityId,
        ['time', 'distance', 'watts']
      );

      if (streams?.distance?.data && streams?.time?.data) {
        const bestDistanceTimes = computeBestDistanceTimes(streams.time.data, streams.distance.data, distances.map(d => d.dist));
        for (const { dist, field } of distances) {
          const candidate = bestDistanceTimes[dist];
          if (candidate != null && (prData[field] == null || candidate < (prData[field] as number))) {
            prData[field] = candidate;
          }
        }
      }

      if (streams?.watts?.data && streams?.time?.data) {
        const bestPowerByDuration = computeBestPowerDurations(streams.time.data, streams.watts.data, powerDurations.map(d => d.dur));
        for (const { dur, field } of powerDurations) {
          const candidate = bestPowerByDuration[dur];
          if (candidate != null && (prData[field] == null || candidate > (prData[field] as number))) {
            prData[field] = Math.round(candidate);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing streams for activity ${activity.id}:`, error);
    }

    processed++;
    onProgress(Math.min(50 + Math.round((processed / cyclingActivities.length) * 30), 80));
  }

  onProgress(80);

  // Calcular FTP
  let ftp = null;
  let ftpMethod = null;
  
  if (prData['power20m']) {
    ftp = Math.round(prData['power20m'] * 0.95);
    ftpMethod = '95% de 20 min';
  } else if (prData['power1h']) {
    ftp = prData['power1h'];
    ftpMethod = '1 hora';
  } else if (prData['power5m']) {
    ftp = Math.round(prData['power5m'] * 0.85);
    ftpMethod = 'Est. desde 5 min';
  }

  // Calcular totales
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalTime = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
  const totalElevation = activities.reduce((sum, a) => sum + (a.totalElevationGain || 0), 0);

  onProgress(90);

  // Guardar en BD - CICLISMO
  await prisma.athleteRecord.upsert({
    where: { athleteId },
    create: {
      athleteId,
      pr5km: prData['pr5km'],
      pr10km: prData['pr10km'],
      pr20km: prData['pr20km'],
      pr30km: prData['pr30km'],
      pr50km: prData['pr50km'],
      pr75km: prData['pr75km'],
      pr90km: prData['pr90km'],
      pr100km: prData['pr100km'],
      power5s: prData['power5s'],
      power15s: prData['power15s'],
      power30s: prData['power30s'],
      power1m: prData['power1m'],
      power2m: prData['power2m'],
      power3m: prData['power3m'],
      power5m: prData['power5m'],
      power8m: prData['power8m'],
      power10m: prData['power10m'],
      power15m: prData['power15m'],
      power20m: prData['power20m'],
      power30m: prData['power30m'],
      power45m: prData['power45m'],
      power1h: prData['power1h'],
      power2h: prData['power2h'],
      estimatedFTP: ftp,
      ftpMethod,
      totalDistance,
      totalTime,
      totalElevation,
      totalActivities: activities.length,
    },
    update: {
      pr5km: prData['pr5km'],
      pr10km: prData['pr10km'],
      pr20km: prData['pr20km'],
      pr30km: prData['pr30km'],
      pr50km: prData['pr50km'],
      pr75km: prData['pr75km'],
      pr90km: prData['pr90km'],
      pr100km: prData['pr100km'],
      power5s: prData['power5s'],
      power15s: prData['power15s'],
      power30s: prData['power30s'],
      power1m: prData['power1m'],
      power2m: prData['power2m'],
      power3m: prData['power3m'],
      power5m: prData['power5m'],
      power8m: prData['power8m'],
      power10m: prData['power10m'],
      power15m: prData['power15m'],
      power20m: prData['power20m'],
      power30m: prData['power30m'],
      power45m: prData['power45m'],
      power1h: prData['power1h'],
      power2h: prData['power2h'],
      estimatedFTP: ftp,
      ftpMethod,
      totalDistance,
      totalTime,
      totalElevation,
      totalActivities: activities.length,
    },
  });

  onProgress(100);
}

function computeBestDistanceTimes(times: number[], distances: number[], targets: number[]): Record<number, number | null> {
  const result: Record<number, number | null> = {};
  for (const target of targets) result[target] = null;

  for (const target of targets) {
    let start = 0;
    for (let end = 0; end < distances.length; end++) {
      while (start < end && (distances[end] - distances[start]) >= target) {
        const duration = times[end] - times[start];
        if (duration > 0 && (result[target] == null || duration < (result[target] as number))) {
          result[target] = duration;
        }
        start++;
      }
    }
  }

  return result;
}

function computeBestPowerDurations(times: number[], watts: number[], targets: number[]): Record<number, number | null> {
  const result: Record<number, number | null> = {};
  for (const target of targets) result[target] = null;

  const prefix: number[] = [0];
  for (let i = 0; i < watts.length; i++) prefix.push(prefix[i] + (watts[i] || 0));

  for (const target of targets) {
    let start = 0;
    for (let end = 0; end < times.length; end++) {
      while (start < end && (times[end] - times[start]) >= target) {
        const samples = end - start + 1;
        const total = prefix[end + 1] - prefix[start];
        const avg = samples > 0 ? total / samples : 0;
        if (avg > 0 && (result[target] == null || avg > (result[target] as number))) {
          result[target] = avg;
        }
        start++;
      }
    }
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sincroniza el perfil del atleta (versión delta)
 * Devuelve true si hubo cambios
 */
async function syncProfileDelta(athleteId: string): Promise<boolean> {
  const stravaProfile = await getAthleteProfile(athleteId);
  
  // Obtener perfil actual para comparar
  const currentProfile = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { 
      firstname: true, 
      lastname: true, 
      profileImage: true, 
      city: true, 
      country: true, 
      weight: true 
    },
  });

  const hasChanges = !currentProfile || 
    currentProfile.firstname !== stravaProfile.firstname ||
    currentProfile.lastname !== stravaProfile.lastname ||
    currentProfile.profileImage !== stravaProfile.profile ||
    currentProfile.city !== stravaProfile.city ||
    currentProfile.country !== stravaProfile.country ||
    currentProfile.weight !== stravaProfile.weight;

  if (hasChanges) {
    await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        firstname: stravaProfile.firstname,
        lastname: stravaProfile.lastname,
        profileImage: stravaProfile.profile,
        city: stravaProfile.city,
        country: stravaProfile.country,
        sex: stravaProfile.sex,
        weight: stravaProfile.weight,
        updatedAt: new Date(),
      },
    });
  }

  return hasChanges;
}

/**
 * Sincroniza solo actividades nuevas desde un timestamp (delta sync)
 */
async function syncActivitiesDelta(
  athleteId: string, 
  afterTimestamp: number | undefined,
  onProgress: (progress: number, total: number, message: string) => void
): Promise<{ imported: number; total: number; syncedIds: string[]; syncedActivities: Array<{id: string; stravaActivityId: bigint; type: string; distance: number; movingTime: number; startDate: Date}> }> {
  let imported = 0;
  let page = 1;
  let hasMore = true;
  const limit = 200;
  const syncedIds: string[] = [];
  const syncedActivities: Array<{id: string; stravaActivityId: bigint; type: string; distance: number; movingTime: number; startDate: Date}> = [];

  // Si no hay timestamp (primera sincronización), hacer full sync limitado
  const isFirstSync = !afterTimestamp;

  while (hasMore && imported < limit) {
    const { activities, hasMore: morePages } = await fetchActivitiesPage(
      athleteId, 
      page, 
      100, 
      isFirstSync ? undefined : afterTimestamp
    );

    for (const activity of activities) {
      if (imported >= limit) break;

      try {
        const mappedActivity = mapStravaActivity(activity);

        const savedActivity = await prisma.activity.upsert({
          where: { stravaActivityId: BigInt(activity.id) },
          create: {
            ...mappedActivity,
            athleteId,
          },
          update: {
            name: mappedActivity.name,
            type: mappedActivity.type,
            distance: mappedActivity.distance,
            movingTime: mappedActivity.movingTime,
            elapsedTime: mappedActivity.elapsedTime,
            totalElevationGain: mappedActivity.totalElevationGain,
            startDate: mappedActivity.startDate,
            averageSpeed: mappedActivity.averageSpeed,
            maxSpeed: mappedActivity.maxSpeed,
            ...(mappedActivity.averageHeartrate !== undefined && {
              averageHeartrate: mappedActivity.averageHeartrate,
            }),
            ...(mappedActivity.maxHeartrate !== undefined && {
              maxHeartrate: mappedActivity.maxHeartrate,
            }),
            ...((mappedActivity as any).averagePower !== undefined && {
              averagePower: (mappedActivity as any).averagePower,
            }),
            ...((mappedActivity as any).maxPower !== undefined && {
              maxPower: (mappedActivity as any).maxPower,
            }),
          },
        });

        imported++;
        syncedIds.push(savedActivity.id);
        syncedActivities.push({
          id: savedActivity.id,
          stravaActivityId: savedActivity.stravaActivityId,
          type: savedActivity.type,
          distance: savedActivity.distance ?? 0,
          movingTime: savedActivity.movingTime ?? 0,
          startDate: savedActivity.startDate,
        });

        onProgress(imported, Math.min(activities.length, limit), 
          isFirstSync 
            ? `Sincronizando actividad ${imported}...`
            : `Nueva actividad ${imported}: ${activity.name}`);

      } catch (error) {
        console.error(`Error syncing activity ${activity.id}:`, error);
      }
    }

    hasMore = morePages && activities.length > 0 && imported < limit;
    page++;

    if (hasMore && imported < limit) {
      await sleep(9000);
    }
  }

  return { imported, total: imported, syncedIds, syncedActivities };
}

/**
 * Sincroniza datos de potencia solo para actividades nuevas (delta)
 */
async function syncPowerDataDelta(
  athleteId: string,
  activityIds: string[],
  onProgress: (progress: number) => void
): Promise<void> {
  // Obtener las actividades nuevas que tienen potencia
  const activities = await prisma.activity.findMany({
    where: { 
      id: { in: activityIds },
      averagePower: { not: null },
    },
    orderBy: { startDate: 'desc' },
  });

  if (activities.length === 0) {
    onProgress(100);
    return;
  }

  let processed = 0;
  for (const activity of activities) {
    try {
      const streams = await getActivityStreams(
        athleteId, 
        activity.stravaActivityId, 
        ['watts']
      );
      
      if (streams?.watts?.data) {
        // Los streams se procesan durante el cálculo de PRs
        // Aquí solo verificamos que existen
      }
      
      processed++;
      onProgress(Math.round((processed / activities.length) * 100));
      
      if (processed < activities.length) {
        await sleep(2000);
      }
    } catch (error) {
      console.error(`Error fetching streams for activity ${activity.id}:`, error);
    }
  }
}

/**
 * Recalcula récords personales incorporando solo las nuevas actividades (delta)
 * CRÍTICO: Mantiene los récords históricos y solo los actualiza si las nuevas actividades los mejoran
 * Si no hay récords previos, calcula desde TODAS las actividades en BD local
 */
async function recalculateRecordsDelta(
  athleteId: string,
  newActivities: Array<{id: string; stravaActivityId: bigint; type: string; distance: number; movingTime: number; startDate: Date}>,
  weight: number,
  onProgress: (progress: number) => void
): Promise<void> {
  onProgress(10);

  // Filtrar solo actividades de CICLISMO relevantes para PRs
  const cyclingActivities = newActivities.filter(a => 
    (a.type === 'RIDE' || a.type === 'VIRTUAL_RIDE') && a.distance > 0
  );

  // Obtener récords actuales
  const currentRecords = await prisma.athleteRecord.findUnique({
    where: { athleteId },
  });

  onProgress(20);

  // Si NO hay récords previos y hay nuevas actividades, necesitamos calcular desde TODAS las actividades
  // porque no podemos saber si las nuevas son récords sin comparar con el histórico completo
  const needsFullRecalculation = !currentRecords && cyclingActivities.length > 0;

  if (needsFullRecalculation) {
    // Fallback: calcular desde todas las actividades en BD (comportamiento de full sync)
    await updateStage(athleteId, 'calculate-prs', 'running', 30, 100, 'Calculando récords desde histórico completo...');
    await syncAthleteRecords(athleteId, onProgress);
    return;
  }

  onProgress(30);

  // Definir las distancias y sus campos en la BD
  const distanceTargets = [
    { dist: 5000, field: 'pr5km' as const },
    { dist: 10000, field: 'pr10km' as const },
    { dist: 20000, field: 'pr20km' as const },
    { dist: 30000, field: 'pr30km' as const },
    { dist: 50000, field: 'pr50km' as const },
    { dist: 75000, field: 'pr75km' as const },
    { dist: 90000, field: 'pr90km' as const },
    { dist: 100000, field: 'pr100km' as const },
  ];

  // Preparar datos para actualizar (copiar actuales o null)
  // ESTO ES CRÍTICO: Mantener los récords históricos
  const prData: Record<string, number | null> = {
    pr5km: currentRecords?.pr5km ?? null,
    pr10km: currentRecords?.pr10km ?? null,
    pr20km: currentRecords?.pr20km ?? null,
    pr30km: currentRecords?.pr30km ?? null,
    pr50km: currentRecords?.pr50km ?? null,
    pr75km: currentRecords?.pr75km ?? null,
    pr90km: currentRecords?.pr90km ?? null,
    pr100km: currentRecords?.pr100km ?? null,
  };

  onProgress(40);

  // Solo verificar mejoras si hay nuevas actividades de ciclismo
  if (cyclingActivities.length > 0) {
    // Para cada distancia, verificar si alguna actividad nueva mejora el récord
    for (const { dist, field } of distanceTargets) {
      const currentBest = prData[field];
      
      // Buscar actividades que podrían mejorar este récord (con tolerancia del 2%)
      const candidates = cyclingActivities.filter(a => {
        if (!a.distance || a.distance < dist * 0.98) return false;
        // Si no hay récord actual, cualquiera es candidato
        if (currentBest === null) return true;
        // Si hay récord, la actividad debe estar cerca de la distancia
        return a.distance >= dist - (dist * 0.02) && a.distance <= dist + (dist * 0.02);
      });

      // Si hay candidatos, necesitamos verificar con streams si hay mejoras
      if (candidates.length > 0) {
        // Para cada candidato, obtener streams y calcular mejor tiempo exacto
        for (const activity of candidates) {
          if (!activity.stravaActivityId) continue;
          
          try {
            const streams = await getActivityStreams(
              athleteId,
              activity.stravaActivityId,
              ['time', 'distance']
            );

            if (streams?.time?.data && streams?.distance?.data) {
              const bestTime = computeBestDistanceTimes(
                streams.time.data,
                streams.distance.data,
                [dist]
              )[dist];

              // Solo actualizar si el nuevo tiempo es MEJOR (menor)
              if (bestTime != null && bestTime > 0 && (currentBest === null || bestTime < currentBest)) {
                prData[field] = bestTime;
              }
            }
          } catch (error) {
            console.error(`Error checking streams for PR: ${activity.stravaActivityId}`, error);
          }
        }
      }
    }
  }

  onProgress(60);

  // Para potencia, mantener récords existentes y verificar mejoras
  const powerDurations = [
    { dur: 5, field: 'power5s' as const },
    { dur: 15, field: 'power15s' as const },
    { dur: 30, field: 'power30s' as const },
    { dur: 60, field: 'power1m' as const },
    { dur: 120, field: 'power2m' as const },
    { dur: 180, field: 'power3m' as const },
    { dur: 300, field: 'power5m' as const },
    { dur: 480, field: 'power8m' as const },
    { dur: 600, field: 'power10m' as const },
    { dur: 900, field: 'power15m' as const },
    { dur: 1200, field: 'power20m' as const },
    { dur: 1800, field: 'power30m' as const },
    { dur: 2700, field: 'power45m' as const },
    { dur: 3600, field: 'power1h' as const },
    { dur: 7200, field: 'power2h' as const },
  ];

  // Inicializar power fields desde actuales (MANTENER HISTÓRICOS)
  for (const { field } of powerDurations) {
    prData[field] = currentRecords?.[field] ?? null;
  }

  onProgress(70);

  // Verificar potencia en nuevas actividades solo si hay actividades con potencia
  if (cyclingActivities.length > 0) {
    for (const activity of cyclingActivities) {
      if (!activity.stravaActivityId) continue;
      
      try {
        const streams = await getActivityStreams(
          athleteId,
          activity.stravaActivityId,
          ['time', 'watts']
        );

        if (streams?.watts?.data && streams?.time?.data) {
          const bestPowers = computeBestPowerDurations(
            streams.time.data,
            streams.watts.data,
            powerDurations.map(d => d.dur)
          );

          for (const { dur, field } of powerDurations) {
            const candidate = bestPowers[dur];
            const current = prData[field];
            // Solo actualizar si el nuevo valor es MEJOR (mayor)
            if (candidate != null && candidate > 0 && (current === null || candidate > current)) {
              prData[field] = Math.round(candidate);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing power streams: ${activity.stravaActivityId}`, error);
      }
    }
  }

  onProgress(80);

  // Calcular FTP basado en los MEJORES récords (existentes + nuevos mejorados)
  let ftp = currentRecords?.estimatedFTP ?? null;
  let ftpMethod = currentRecords?.ftpMethod ?? null;
  
  // Recalcular FTP solo si hay datos de potencia
  if (prData['power20m'] || prData['power1h'] || prData['power5m']) {
    if (prData['power20m']) {
      ftp = Math.round(prData['power20m'] * 0.95);
      ftpMethod = '95% de 20 min';
    } else if (prData['power1h']) {
      ftp = prData['power1h'];
      ftpMethod = '1 hora';
    } else if (prData['power5m']) {
      ftp = Math.round(prData['power5m'] * 0.85);
      ftpMethod = 'Est. desde 5 min';
    }
  }

  onProgress(90);

  // Actualizar totales sumando las nuevas actividades a los existentes
  const totalDistance = (currentRecords?.totalDistance ?? 0) + cyclingActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalTime = (currentRecords?.totalTime ?? 0) + cyclingActivities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
  const totalActivities = (currentRecords?.totalActivities ?? 0) + cyclingActivities.length;

  // Guardar récords actualizados (manteniendo históricos + nuevos mejorados)
  await prisma.athleteRecord.upsert({
    where: { athleteId },
    create: {
      athleteId,
      pr5km: prData['pr5km'],
      pr10km: prData['pr10km'],
      pr20km: prData['pr20km'],
      pr30km: prData['pr30km'],
      pr50km: prData['pr50km'],
      pr75km: prData['pr75km'],
      pr90km: prData['pr90km'],
      pr100km: prData['pr100km'],
      power5s: prData['power5s'],
      power15s: prData['power15s'],
      power30s: prData['power30s'],
      power1m: prData['power1m'],
      power2m: prData['power2m'],
      power3m: prData['power3m'],
      power5m: prData['power5m'],
      power8m: prData['power8m'],
      power10m: prData['power10m'],
      power15m: prData['power15m'],
      power20m: prData['power20m'],
      power30m: prData['power30m'],
      power45m: prData['power45m'],
      power1h: prData['power1h'],
      power2h: prData['power2h'],
      estimatedFTP: ftp,
      ftpMethod,
      totalDistance,
      totalTime,
      totalElevation: currentRecords?.totalElevation ?? 0,
      totalActivities,
    },
    update: {
      pr5km: prData['pr5km'],
      pr10km: prData['pr10km'],
      pr20km: prData['pr20km'],
      pr30km: prData['pr30km'],
      pr50km: prData['pr50km'],
      pr75km: prData['pr75km'],
      pr90km: prData['pr90km'],
      pr100km: prData['pr100km'],
      power5s: prData['power5s'],
      power15s: prData['power15s'],
      power30s: prData['power30s'],
      power1m: prData['power1m'],
      power2m: prData['power2m'],
      power3m: prData['power3m'],
      power5m: prData['power5m'],
      power8m: prData['power8m'],
      power10m: prData['power10m'],
      power15m: prData['power15m'],
      power20m: prData['power20m'],
      power30m: prData['power30m'],
      power45m: prData['power45m'],
      power1h: prData['power1h'],
      power2h: prData['power2h'],
      estimatedFTP: ftp,
      ftpMethod,
      totalDistance,
      totalTime,
      totalActivities,
    },
  });

  onProgress(100);
}

/**
 * Verifica si el atleta necesita sincronización
 */
export async function needsSync(athleteId: string): Promise<{ needsSync: boolean; reason: string }> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { lastSyncAt: true },
  });

  if (!athlete?.lastSyncAt) {
    return { needsSync: true, reason: 'Nunca sincronizado' };
  }

  // Verificar si han pasado más de 24h
  const hoursSinceLastSync = (Date.now() - new Date(athlete.lastSyncAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastSync > 24) {
    return { needsSync: true, reason: 'Datos desactualizados (>24h)' };
  }

  // Verificar si existen récords
  const records = await prisma.athleteRecord.findUnique({
    where: { athleteId },
  });

  if (!records) {
    return { needsSync: true, reason: 'Faltan datos de récords' };
  }

  return { needsSync: false, reason: 'Datos actualizados' };
}
