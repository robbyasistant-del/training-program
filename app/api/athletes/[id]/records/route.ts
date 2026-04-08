import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/athletes/[id]/records
 * Obtiene todos los récords y métricas de rendimiento de un atleta desde la BD local
 * Datos provenientes de la sincronización con Strava
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const athleteId = params.id;
    const { searchParams } = new URL(request.url);
    const period = parseInt(searchParams.get('period') || '30');

    if (!athleteId) {
      return NextResponse.json({ error: 'Athlete ID required' }, { status: 400 });
    }

    // Verificar que el atleta existe
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, weight: true, lastSyncAt: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const weight = athlete.weight || 70;
    
    // Verificar si necesita sincronización (>24h)
    const needsSync = athlete.lastSyncAt 
      ? (Date.now() - new Date(athlete.lastSyncAt).getTime()) > (24 * 60 * 60 * 1000)
      : true;

    // Obtener TODAS las actividades del atleta de la BD local
    const allActivities = await prisma.activity.findMany({
      where: { athleteId },
      orderBy: { startDate: 'desc' },
    });

    if (allActivities.length === 0) {
      return NextResponse.json({
        weight,
        needsSync: true,
        lastSyncAt: athlete.lastSyncAt,
        distancePRs: getEmptyDistancePRs(),
        powerPRs: getEmptyPowerPRs(weight),
        powerCurve: { durations: [], powers: [], wkgs: [] },
        ftp: { estimatedFTP: null, wkg: null, method: 'No hay datos', date: null },
        recentBests: [],
      });
    }

    // Calcular métricas del período
    const recentBests = await calculateRecentBests(athleteId, weight);

    // Calcular PRs por distancia desde las actividades sincronizadas
    const distancePRs = calculateDistancePRs(allActivities);

    // Calcular PRs de potencia desde las actividades
    const powerPRs = calculatePowerPRs(allActivities, weight);

    // Calcular curva de potencia
    const powerCurve = calculatePowerCurve(allActivities, weight);

    // Estimar FTP
    const ftp = estimateFTP(powerPRs, weight);

    return NextResponse.json({
      weight,
      needsSync,
      lastSyncAt: athlete.lastSyncAt,
      distancePRs,
      powerPRs,
      powerCurve,
      ftp,
      recentBests,
    });
  } catch (error) {
    console.error('Error fetching records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}

// PRs por distancia vacíos
function getEmptyDistancePRs() {
  const distances = [
    { distance: 1000, label: '1 km' },
    { distance: 5000, label: '5 km' },
    { distance: 10000, label: '10 km' },
    { distance: 15000, label: '15 km' },
    { distance: 21097.5, label: 'Media Maratón' },
    { distance: 42195, label: 'Maratón' },
  ];
  
  return distances.map(({ distance, label }) => ({
    distance,
    label,
    bestTime: null,
    bestPace: null,
    date: null,
    activityId: null,
  }));
}

// Power PRs vacíos
function getEmptyPowerPRs(weight: number) {
  const durations = [
    { duration: 5, label: '5 seg' },
    { duration: 30, label: '30 seg' },
    { duration: 60, label: '1 min' },
    { duration: 300, label: '5 min' },
    { duration: 1200, label: '20 min' },
    { duration: 3600, label: '1 hora' },
  ];
  
  return durations.map(({ duration, label }) => ({
    duration,
    label,
    power: null,
    wkg: null,
    date: null,
  }));
}

// Calcular PRs por distancia desde actividades de BD
function calculateDistancePRs(activities: any[]) {
  const distances = [
    { distance: 1000, label: '1 km' },
    { distance: 5000, label: '5 km' },
    { distance: 10000, label: '10 km' },
    { distance: 15000, label: '15 km' },
    { distance: 21097.5, label: 'Media Maratón' },
    { distance: 42195, label: 'Maratón' },
  ];

  return distances.map(({ distance, label }) => {
    // Buscar actividades cercanas a esta distancia (±2%)
    const matchingActivities = activities.filter(a => {
      if (!a.distance) return false;
      const tolerance = distance * 0.02;
      return a.distance >= distance - tolerance && a.distance <= distance + tolerance;
    });

    if (matchingActivities.length === 0) {
      return {
        distance,
        label,
        bestTime: null,
        bestPace: null,
        date: null,
        activityId: null,
      };
    }

    // Encontrar el mejor tiempo
    const bestActivity = matchingActivities.reduce((best, current) => {
      if (!current.movingTime) return best;
      if (!best.movingTime) return current;
      return current.movingTime < best.movingTime ? current : best;
    });

    const bestTime = bestActivity.movingTime || null;
    const bestPace = bestTime ? (bestTime / (bestActivity.distance / 1000)) : null;

    return {
      distance,
      label,
      bestTime,
      bestPace,
      date: bestActivity.startDate.toISOString(),
      activityId: bestActivity.id,
    };
  });
}

// Calcular PRs de potencia desde actividades
function calculatePowerPRs(activities: any[], weight: number) {
  const durations = [
    { duration: 5, label: '5 seg' },
    { duration: 30, label: '30 seg' },
    { duration: 60, label: '1 min' },
    { duration: 300, label: '5 min' },
    { duration: 1200, label: '20 min' },
    { duration: 3600, label: '1 hora' },
  ];

  return durations.map(({ duration, label }) => {
    // Buscar actividades con duración similar y potencia
    const relevantActivities = activities.filter(a => {
      if (!a.movingTime || !a.averagePower) return false;
      // Permitir ±10% de diferencia en duración
      const tolerance = duration * 0.1;
      return a.movingTime >= duration - tolerance && a.movingTime <= duration + tolerance;
    });

    if (relevantActivities.length === 0) {
      return { duration, label, power: null, wkg: null, date: null };
    }

    const bestActivity = relevantActivities.reduce((best, current) => {
      if (!current.averagePower) return best;
      if (!best.averagePower) return current;
      return current.averagePower > best.averagePower ? current : best;
    });

    const power = bestActivity.averagePower;
    
    return {
      duration,
      label,
      power: Math.round(power),
      wkg: parseFloat((power / weight).toFixed(2)),
      date: bestActivity.startDate.toISOString(),
    };
  });
}

// Calcular curva de potencia
function calculatePowerCurve(activities: any[], weight: number) {
  const durations = [1, 5, 10, 30, 60, 300, 600, 1200, 1800, 3600];
  
  const powers = durations.map(duration => {
    const relevant = activities.filter(a => {
      if (!a.movingTime || !a.averagePower) return false;
      const tolerance = duration * 0.15; // ±15% tolerancia
      return a.movingTime >= duration - tolerance && a.movingTime <= duration + tolerance;
    });
    
    if (relevant.length === 0) return null;
    
    const best = relevant.reduce((max, a) => 
      (a.averagePower || 0) > (max.averagePower || 0) ? a : max
    );
    
    return best.averagePower || null;
  });

  return {
    durations,
    powers,
    wkgs: powers.map(p => p ? parseFloat((p / weight).toFixed(2)) : null),
  };
}

// Estimar FTP
function estimateFTP(powerPRs: any[], weight: number) {
  // Método 1: 95% de la mejor potencia de 20 minutos
  const best20min = powerPRs.find(p => p.duration === 1200);
  if (best20min?.power) {
    return {
      estimatedFTP: Math.round(best20min.power * 0.95),
      wkg: parseFloat(((best20min.power * 0.95) / weight).toFixed(2)),
      method: '95% de 20 min',
      date: best20min.date,
    };
  }

  // Método 2: 100% de la mejor potencia de 1 hora
  const best1hour = powerPRs.find(p => p.duration === 3600);
  if (best1hour?.power) {
    return {
      estimatedFTP: best1hour.power,
      wkg: best1hour.wkg,
      method: '1 hora',
      date: best1hour.date,
    };
  }

  return {
    estimatedFTP: null,
    wkg: null,
    method: 'No hay datos suficientes',
    date: null,
  };
}

// Calcular métricas de períodos recientes
async function calculateRecentBests(athleteId: string, weight: number) {
  const periods = [30, 90, 180, 365];

  const results = await Promise.all(
    periods.map(async (days) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const activities = await prisma.activity.findMany({
        where: {
          athleteId,
          startDate: { gte: since },
        },
      });

      const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
      const totalTime = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
      const totalElevation = activities.reduce((sum, a) => sum + (a.elevationGain || 0), 0);
      
      const activitiesWithPower = activities.filter(a => a.averagePower && a.averagePower > 0);
      const avgPower = activitiesWithPower.length > 0
        ? Math.round(activitiesWithPower.reduce((sum, a) => sum + (a.averagePower || 0), 0) / activitiesWithPower.length)
        : null;

      const maxPower = activities.length > 0
        ? Math.max(...activities.map(a => a.maxPower || 0).filter(p => p > 0)) || null
        : null;

      return {
        period: `${days} días`,
        days,
        totalDistance,
        totalTime,
        totalElevation,
        avgPower,
        maxPower,
        activities: activities.length,
      };
    })
  );

  return results;
}
