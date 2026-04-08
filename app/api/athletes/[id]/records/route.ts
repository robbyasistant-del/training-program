import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/athletes/[id]/records
 * Obtiene todos los récords y métricas de rendimiento de un atleta
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
      select: { id: true, weight: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const weight = athlete.weight || 70;

    // Obtener actividades recientes
    const since = new Date();
    since.setDate(since.getDate() - period);

    const activities = await prisma.activity.findMany({
      where: {
        athleteId,
        startDate: { gte: since },
      },
      orderBy: { startDate: 'desc' },
    });

    // Calcular métricas del período
    const recentBests = await calculateRecentBests(athleteId, weight);

    // Obtener PRs por distancia
    const distancePRs = await calculateDistancePRs(athleteId);

    // Obtener PRs de potencia (si hay datos de potencia)
    const powerPRs = calculatePowerPRs(activities, weight);

    // Calcular curva de potencia
    const powerCurve = calculatePowerCurve(activities, weight);

    // Estimar FTP
    const ftp = estimateFTP(powerPRs, weight);

    return NextResponse.json({
      weight,
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

// Calcular PRs por distancia
async function calculateDistancePRs(athleteId: string) {
  const distances = [
    { distance: 1000, label: '1 km' },
    { distance: 5000, label: '5 km' },
    { distance: 10000, label: '10 km' },
    { distance: 15000, label: '15 km' },
    { distance: 21097.5, label: 'Media Maratón' },
    { distance: 42195, label: 'Maratón' },
  ];

  const activities = await prisma.activity.findMany({
    where: { athleteId },
    orderBy: { startDate: 'desc' },
  });

  return distances.map(({ distance, label }) => {
    // Buscar actividades cercanas a esta distancia (±2%)
    const matchingActivities = activities.filter(a => {
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

// Calcular PRs de potencia
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
    // Buscar la mejor potencia para esta duración
    // Nota: Esto es una simplificación. En realidad necesitaríamos datos de potencia detallados
    const relevantActivities = activities.filter(a => 
      a.movingTime && a.movingTime >= duration && a.averagePower
    );

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
    const relevant = activities.filter(a => 
      a.movingTime && a.movingTime >= duration && a.averagePower
    );
    
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

// Estimar FTP usando diferentes métodos
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
      
      const avgPower = activities.length > 0
        ? Math.round(activities.reduce((sum, a) => sum + (a.averagePower || 0), 0) / activities.filter(a => a.averagePower).length)
        : null;

      const maxPower = activities.length > 0
        ? Math.max(...activities.map(a => a.maxPower || 0).filter(p => p > 0))
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
