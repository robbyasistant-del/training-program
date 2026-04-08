import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/athletes/[id]/records
 * Obtiene todos los récords y métricas de rendimiento de un atleta desde la BD local
 * Los datos se sincronizan desde Strava y se almacenan en AthleteRecord
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

    // Obtener los récords del atleta desde la BD
    const athleteRecord = await prisma.athleteRecord.findUnique({
      where: { athleteId },
    });

    // Si no hay récords guardados, devolver estructura vacía
    if (!athleteRecord) {
      return NextResponse.json({
        weight,
        needsSync: true,
        lastSyncAt: athlete.lastSyncAt,
        distancePRs: getEmptyDistancePRs(),
        powerPRs: getEmptyPowerPRs(weight),
        powerCurve: { durations: [], powers: [], wkgs: [] },
        ftp: { estimatedFTP: null, wkg: null, method: 'No hay datos', date: null },
        recentBests: [],
        message: 'No hay datos sincronizados. Por favor, sincroniza con Strava para obtener tus datos de ciclismo.',
      });
    }

    // Calcular métricas del período desde actividades locales
    const recentBests = await calculateRecentBests(athleteId, weight, period);

    // Formatear PRs de distancia
    const distancePRs = formatDistancePRs(athleteRecord, weight);

    // Formatear PRs de potencia
    const powerPRs = formatPowerPRs(athleteRecord, weight);

    // Construir curva de potencia
    const powerCurve = buildPowerCurve(athleteRecord, weight);

    // FTP
    const ftp = athleteRecord.estimatedFTP ? {
      estimatedFTP: athleteRecord.estimatedFTP,
      wkg: parseFloat((athleteRecord.estimatedFTP / weight).toFixed(2)),
      method: athleteRecord.ftpMethod || 'Desconocido',
      date: athleteRecord.updatedAt.toISOString(),
    } : {
      estimatedFTP: null,
      wkg: null,
      method: 'No hay datos suficientes',
      date: null,
    };

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

// PRs de distancia vacíos - CICLISMO
function getEmptyDistancePRs() {
  const distances = [
    { distance: 5000, label: '5 km CRI' },
    { distance: 10000, label: '10 km CRI' },
    { distance: 20000, label: '20 km' },
    { distance: 30000, label: '30 km' },
    { distance: 50000, label: '50 km' },
    { distance: 75000, label: '75 km' },
    { distance: 90000, label: '90 km' },
    { distance: 100000, label: '100 km Century' },
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

// Power PRs vacíos
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

// Formatear PRs de distancia desde AthleteRecord - CICLISMO
function formatDistancePRs(record: any, weight: number) {
  const distances = [
    { field: 'pr5km', distance: 5000, label: '5 km CRI' },
    { field: 'pr10km', distance: 10000, label: '10 km CRI' },
    { field: 'pr20km', distance: 20000, label: '20 km' },
    { field: 'pr30km', distance: 30000, label: '30 km' },
    { field: 'pr50km', distance: 50000, label: '50 km' },
    { field: 'pr75km', distance: 75000, label: '75 km' },
    { field: 'pr90km', distance: 90000, label: '90 km' },
    { field: 'pr100km', distance: 100000, label: '100 km Century' },
  ];

  // Para distancias intermedias, calcular desde actividades si no hay PR guardado
  return distances.map(({ field, distance, label }) => {
    const timeSeconds = record[field];
    
    if (!timeSeconds) {
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

    const bestPace = timeSeconds / (distance / 1000); // seg/km
    const bestSpeed = (distance / 1000) / (timeSeconds / 3600); // km/h

    return {
      distance,
      label,
      bestTime: timeSeconds,
      bestPace,
      bestSpeed,
      date: record.updatedAt.toISOString(),
      activityId: null,
    };
  });
}

// Formatear PRs de potencia desde AthleteRecord
function formatPowerPRs(record: any, weight: number) {
  const powerFields = [
    { field: 'power5s', duration: 5, label: '5 seg' },
    { field: 'power15s', duration: 15, label: '15 seg' },
    { field: 'power30s', duration: 30, label: '30 seg' },
    { field: 'power1m', duration: 60, label: '1 min' },
    { field: 'power2m', duration: 120, label: '2 min' },
    { field: 'power3m', duration: 180, label: '3 min' },
    { field: 'power5m', duration: 300, label: '5 min' },
    { field: 'power8m', duration: 480, label: '8 min' },
    { field: 'power10m', duration: 600, label: '10 min' },
    { field: 'power15m', duration: 900, label: '15 min' },
    { field: 'power20m', duration: 1200, label: '20 min' },
    { field: 'power30m', duration: 1800, label: '30 min' },
    { field: 'power45m', duration: 2700, label: '45 min' },
    { field: 'power1h', duration: 3600, label: '1 h' },
    { field: 'power2h', duration: 7200, label: '2 h' },
  ];

  return powerFields.map(({ field, duration, label }) => {
    const power = record[field];
    return {
      duration,
      label,
      power: power || null,
      wkg: power ? parseFloat((power / weight).toFixed(2)) : null,
      date: record.updatedAt.toISOString(),
    };
  });
}

// Construir curva de potencia desde AthleteRecord
function buildPowerCurve(record: any, weight: number) {
  const durations = [5, 15, 30, 60, 120, 180, 300, 480, 600, 900, 1200, 1800, 2700, 3600, 7200];
  const fields = ['power5s', 'power15s', 'power30s', 'power1m', 'power2m', 'power3m', 'power5m', 'power8m', 'power10m', 'power15m', 'power20m', 'power30m', 'power45m', 'power1h', 'power2h'];
  
  const powers = fields.map(field => record[field] || null);
  
  return {
    durations,
    powers,
    wkgs: powers.map(p => p ? parseFloat((p / weight).toFixed(2)) : null),
  };
}

// Calcular métricas de períodos recientes desde actividades locales
async function calculateRecentBests(athleteId: string, weight: number, periodDays: number) {
  const periods = [30, 90, 180, 365];

  const results = await Promise.all(
    periods.map(async (days) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Solo actividades de CICLISMO (Ride y VirtualRide)
      const activities = await prisma.activity.findMany({
        where: {
          athleteId,
          startDate: { gte: since },
          type: { in: ['RIDE', 'VIRTUAL_RIDE'] },
        },
      });

      const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
      const totalTime = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
      const totalElevation = activities.reduce((sum, a) => sum + (a.totalElevationGain || 0), 0);
      
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
