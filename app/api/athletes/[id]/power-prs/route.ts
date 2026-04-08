import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActivityStreams, getAthleteActivities } from '@/lib/strava/api-service';

/**
 * GET /api/athletes/[id]/power-prs
 * Obtiene los récords de potencia (Power PRs) directamente de Strava
 * Analizando las actividades con streams de watts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const athleteId = params.id;

    if (!athleteId) {
      return NextResponse.json({ error: 'Athlete ID required' }, { status: 400 });
    }

    // Obtener atleta para tener el stravaId y peso
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, weight: true, stravaId: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const weight = athlete.weight || 70;

    // Obtener actividades recientes de Strava (últimas 50)
    const activities = await getAthleteActivities(athleteId, 1, 50);
    
    if (!activities || activities.length === 0) {
      return NextResponse.json({
        weight,
        powerPRs: getEmptyPowerPRs(weight),
        ftp: null,
        message: 'No hay actividades con datos de potencia',
      });
    }

    // Filtrar actividades que tienen datos de potencia
    const activitiesWithPower = activities.filter(a => 
      (a as any).average_watts && (a as any).average_watts > 0
    );

    if (activitiesWithPower.length === 0) {
      return NextResponse.json({
        weight,
        powerPRs: getEmptyPowerPRs(weight),
        ftp: null,
        message: 'No hay actividades con datos de potencia. Necesitas un medidor de potencia.',
      });
    }

    // Duraciones para calcular PRs
    const targetDurations = [5, 15, 30, 60, 120, 180, 300, 480, 600, 900, 1200, 1800, 2700, 3600, 7200];
    
    // Calcular mejores potencias para cada duración
    const powerPRs = await calculatePowerPRsFromActivities(
      athleteId, 
      activitiesWithPower, 
      targetDurations,
      weight
    );

    // Calcular FTP desde los PRs
    const ftp = calculateFTPFromPRs(powerPRs, weight);

    return NextResponse.json({
      weight,
      powerPRs,
      ftp,
      activitiesAnalyzed: activitiesWithPower.length,
    });

  } catch (error) {
    console.error('Error fetching power PRs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch power PRs' },
      { status: 500 }
    );
  }
}

// PRs vacíos
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

// Calcular PRs de potencia analizando actividades
async function calculatePowerPRsFromActivities(
  athleteId: string,
  activities: any[],
  targetDurations: number[],
  weight: number
) {
  // Inicializar PRs vacíos
  const prs = targetDurations.map(duration => ({
    duration,
    label: formatDurationLabel(duration),
    power: null as number | null,
    wkg: null as number | null,
    date: null as string | null,
    activityId: null as number | null,
  }));

  // Para cada actividad, obtener sus streams y calcular máximos
  for (const activity of activities.slice(0, 10)) { // Limitar a 10 actividades para no saturar
    try {
      const streams = await getActivityStreams(athleteId, BigInt(activity.id), ['watts']);
      
      if (!streams || !streams.watts || !streams.watts.data) {
        continue;
      }

      const wattsData = streams.watts.data;
      const resolution = streams.watts.resolution; // 'low', 'medium', 'high'
      
      // Calcular intervalo de tiempo entre muestras (segundos)
      let timeInterval = 1; // Por defecto 1 segundo
      if (resolution === 'low') timeInterval = 5;
      else if (resolution === 'medium') timeInterval = 2;

      // Para cada duración objetivo, calcular la mejor potencia media
      for (let i = 0; i < targetDurations.length; i++) {
        const duration = targetDurations[i];
        const samplesNeeded = Math.ceil(duration / timeInterval);
        
        if (wattsData.length < samplesNeeded) continue;

        // Calcular medias móviles
        let bestAvg = 0;
        for (let j = 0; j <= wattsData.length - samplesNeeded; j++) {
          const slice = wattsData.slice(j, j + samplesNeeded);
          const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
          if (avg > bestAvg) {
            bestAvg = avg;
          }
        }

        // Actualizar PR si es mejor
        if (bestAvg > 0 && (!prs[i].power || bestAvg > prs[i].power!)) {
          prs[i].power = Math.round(bestAvg);
          prs[i].wkg = parseFloat((bestAvg / weight).toFixed(2));
          prs[i].date = activity.start_date;
          prs[i].activityId = activity.id;
        }
      }

    } catch (error) {
      console.error(`Error analyzing activity ${activity.id}:`, error);
    }
  }

  // Si no hay streams detallados, usar average_watts de las actividades como aproximación
  for (let i = 0; i < targetDurations.length; i++) {
    if (!prs[i].power) {
      const duration = targetDurations[i];
      const matchingActivities = activities.filter(a => {
        const tolerance = duration * 0.2; // ±20%
        return a.moving_time >= duration - tolerance && a.moving_time <= duration + tolerance;
      });

      if (matchingActivities.length > 0) {
        const bestActivity = matchingActivities.reduce((best, current) => {
          const currentPower = (current as any).average_watts || 0;
          const bestPower = (best as any).average_watts || 0;
          return currentPower > bestPower ? current : best;
        });

        const avgPower = (bestActivity as any).average_watts;
        if (avgPower > 0) {
          prs[i].power = Math.round(avgPower);
          prs[i].wkg = parseFloat((avgPower / weight).toFixed(2));
          prs[i].date = bestActivity.start_date;
          prs[i].activityId = bestActivity.id;
        }
      }
    }
  }

  return prs;
}

// Formatear etiqueta de duración
function formatDurationLabel(duration: number): string {
  if (duration < 60) return `${duration} seg`;
  if (duration < 3600) return `${Math.floor(duration / 60)} min`;
  return `${Math.floor(duration / 3600)} h`;
}

// Calcular FTP desde PRs
function calculateFTPFromPRs(prs: any[], weight: number) {
  // Método 1: 95% de 20 minutos
  const pr20min = prs.find(p => p.duration === 1200 && p.power);
  if (pr20min) {
    const ftp = Math.round(pr20min.power * 0.95);
    return {
      estimatedFTP: ftp,
      wkg: parseFloat((ftp / weight).toFixed(2)),
      method: '95% de 20 min',
    };
  }

  // Método 2: Potencia de 1 hora
  const pr1hour = prs.find(p => p.duration === 3600 && p.power);
  if (pr1hour) {
    return {
      estimatedFTP: pr1hour.power,
      wkg: pr1hour.wkg,
      method: '1 hora',
    };
  }

  // Método 3: Estimación desde 5 min
  const pr5min = prs.find(p => p.duration === 300 && p.power);
  if (pr5min) {
    const ftp = Math.round(pr5min.power * 0.85);
    return {
      estimatedFTP: ftp,
      wkg: parseFloat((ftp / weight).toFixed(2)),
      method: 'Est. desde 5 min',
    };
  }

  return null;
}
