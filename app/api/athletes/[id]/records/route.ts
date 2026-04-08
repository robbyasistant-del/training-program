import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/athletes/[id]/records
 * Obtiene todos los récords y métricas de rendimiento de un atleta desde la BD local
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

    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, weight: true, lastSyncAt: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const weight = athlete.weight || 70;
    
    const needsSync = athlete.lastSyncAt 
      ? (Date.now() - new Date(athlete.lastSyncAt).getTime()) > (24 * 60 * 60 * 1000)
      : true;

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

    const recentBests = await calculateRecentBests(athleteId, weight);
    const distancePRs = calculateDistancePRs(allActivities);
    const powerPRs = calculatePowerPRs(allActivities, weight);
    const powerCurve = calculatePowerCurve(allActivities, weight);
    
    // Calcular FTP usando la curva de potencia completa
    const ftp = calculateFTPFromCurve(powerCurve, weight);

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

// Nuevas distancias: 5K, 10K, 20K, 30K, 40K, 50K, 75K, 100K
function getEmptyDistancePRs() {
  const distances = [
    { distance: 5000, label: '5 km' },
    { distance: 10000, label: '10 km' },
    { distance: 20000, label: '20 km' },
    { distance: 30000, label: '30 km' },
    { distance: 40000, label: '40 km' },
    { distance: 50000, label: '50 km' },
    { distance: 75000, label: '75 km' },
    { distance: 100000, label: '100 km' },
  ];
  
  return distances.map(({ distance, label }) => ({
    distance,
    label,
    bestTime: null,
    bestPace: null,
    bestSpeed: null,
    date: null,
    activityId: null,
  }));
}

// Nuevas duraciones para power PRs
function getEmptyPowerPRs(weight: number) {
  const durations = [
    { duration: 5, label: '5 seg' },
    { duration: 15, label: '15 seg' },
    { duration: 30, label: '30 seg' },
    { duration: 60, label: '1 min' },
    { duration: 120, label: '2 min' },
    { duration: 180, label: '3 min' },
    { duration: 300, label: '5 min' },
    { duration: 480, label: '8 min' },
    { duration: 600, label: '10 min' },
    { duration: 900, label: '15 min' },
    { duration: 1200, label: '20 min' },
    { duration: 1800, label: '30 min' },
    { duration: 2700, label: '45 min' },
    { duration: 3600, label: '1 h' },
    { duration: 7200, label: '2 h' },
  ];
  
  return durations.map(({ duration, label }) => ({
    duration,
    label,
    power: null,
    wkg: null,
    date: null,
  }));
}

// Calcular PRs por distancia con velocidad
function calculateDistancePRs(activities: any[]) {
  const distances = [
    { distance: 5000, label: '5 km' },
    { distance: 10000, label: '10 km' },
    { distance: 20000, label: '20 km' },
    { distance: 30000, label: '30 km' },
    { distance: 40000, label: '40 km' },
    { distance: 50000, label: '50 km' },
    { distance: 75000, label: '75 km' },
    { distance: 100000, label: '100 km' },
  ];

  return distances.map(({ distance, label }) => {
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
        bestSpeed: null,
        date: null,
        activityId: null,
      };
    }

    const bestActivity = matchingActivities.reduce((best, current) => {
      if (!current.movingTime) return best;
      if (!best.movingTime) return current;
      return current.movingTime < best.movingTime ? current : best;
    });

    const bestTime = bestActivity.movingTime || null;
    const bestPace = bestTime ? (bestTime / (bestActivity.distance / 1000)) : null;
    // Velocidad en km/h = (distancia en km) / (tiempo en horas)
    const bestSpeed = bestTime ? ((bestActivity.distance / 1000) / (bestTime / 3600)) : null;

    return {
      distance,
      label,
      bestTime,
      bestPace,
      bestSpeed,
      date: bestActivity.startDate.toISOString(),
      activityId: bestActivity.id,
    };
  });
}

// Calcular PRs de potencia con nuevas duraciones
function calculatePowerPRs(activities: any[], weight: number) {
  const durations = [
    { duration: 5, label: '5 seg' },
    { duration: 15, label: '15 seg' },
    { duration: 30, label: '30 seg' },
    { duration: 60, label: '1 min' },
    { duration: 120, label: '2 min' },
    { duration: 180, label: '3 min' },
    { duration: 300, label: '5 min' },
    { duration: 480, label: '8 min' },
    { duration: 600, label: '10 min' },
    { duration: 900, label: '15 min' },
    { duration: 1200, label: '20 min' },
    { duration: 1800, label: '30 min' },
    { duration: 2700, label: '45 min' },
    { duration: 3600, label: '1 h' },
    { duration: 7200, label: '2 h' },
  ];

  return durations.map(({ duration, label }) => {
    // Buscar la mejor potencia para actividades con duración similar
    const relevantActivities = activities.filter(a => {
      if (!a.movingTime || !a.averagePower) return false;
      const tolerance = duration * 0.15; // ±15% tolerancia
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

// Calcular curva de potencia con todas las duraciones
function calculatePowerCurve(activities: any[], weight: number) {
  const durations = [5, 15, 30, 60, 120, 180, 300, 480, 600, 900, 1200, 1800, 2700, 3600, 7200];
  
  const powers = durations.map(duration => {
    const relevant = activities.filter(a => {
      if (!a.movingTime || !a.averagePower) return false;
      const tolerance = duration * 0.15;
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

// Calcular FTP usando la curva de potencia completa
function calculateFTPFromCurve(powerCurve: any, weight: number) {
  const { durations, powers } = powerCurve;
  
  // Método 1: Usar potencia de 20 minutos (más confiable)
  const idx20min = durations.indexOf(1200); // 20 min = 1200 seg
  if (idx20min >= 0 && powers[idx20min]) {
    const power20min = powers[idx20min];
    // FTP = 95% de la potencia de 20 minutos
    const ftp = Math.round(power20min * 0.95);
    return {
      estimatedFTP: ftp,
      wkg: parseFloat((ftp / weight).toFixed(2)),
      method: '95% de 20 min',
      date: new Date().toISOString(),
    };
  }
  
  // Método 2: Usar potencia de 1 hora si existe
  const idx1hour = durations.indexOf(3600);
  if (idx1hour >= 0 && powers[idx1hour]) {
    const ftp = powers[idx1hour];
    return {
      estimatedFTP: Math.round(ftp),
      wkg: parseFloat((ftp / weight).toFixed(2)),
      method: '1 hora',
      date: new Date().toISOString(),
    };
  }
  
  // Método 3: Estimación basada en potencia máxima de 5 minutos
  const idx5min = durations.indexOf(300);
  if (idx5min >= 0 && powers[idx5min]) {
    const power5min = powers[idx5min];
    // Estimación aproximada: FTP ~ 85% de 5 min power
    const ftp = Math.round(power5min * 0.85);
    return {
      estimatedFTP: ftp,
      wkg: parseFloat((ftp / weight).toFixed(2)),
      method: 'Est. desde 5 min',
      date: new Date().toISOString(),
    };
  }
  
  // Método 4: Intentar extrapolar desde cualquier duración disponible
  const validData = durations.map((d, i) => ({ duration: d, power: powers[i] }))
    .filter(item => item.power !== null)
    .sort((a, b) => b.duration - a.duration); // Mayor duración primero
    
  if (validData.length > 0) {
    const best = validData[0];
    // Fórmula simplificada de estimación
    // FTP se aproxima mejor con duraciones largas
    let factor = 0.85;
    if (best.duration >= 1800) factor = 0.95; // 30+ min
    else if (best.duration >= 600) factor = 0.90; // 10+ min
    else if (best.duration >= 300) factor = 0.85; // 5+ min
    else factor = 0.75; // < 5 min (menos preciso)
    
    const ftp = Math.round(best.power! * factor);
    return {
      estimatedFTP: ftp,
      wkg: parseFloat((ftp / weight).toFixed(2)),
      method: `Est. desde ${Math.round(best.duration / 60)} min`,
      date: new Date().toISOString(),
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
