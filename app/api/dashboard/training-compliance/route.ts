import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/dashboard/training-compliance
 * Obtiene datos de cumplimiento de entrenamiento (TSS planificado vs real)
 * para los últimos N días
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (!athleteId) {
      return NextResponse.json(
        { error: 'Se requiere athleteId' },
        { status: 400 }
      );
    }

    // Calcular rango de fechas CORRECTAMENTE
    // Hoy es el último día, hace 30 días es el primero
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days + 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    console.log(`[Training Compliance] Today: ${today.toISOString()}`);
    console.log(`[Training Compliance] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`[Training Compliance] Local start: ${startDate.toLocaleDateString('es-ES')} - Local end: ${endDate.toLocaleDateString('es-ES')}`);

    // Obtener TODAS las actividades del atleta con datos completos para calcular TSS
    const allActivities = await prisma.activity.findMany({
      where: {
        athleteId,
      },
      select: {
        id: true,
        startDate: true,
        tss: true,
        type: true,
        name: true,
        movingTime: true,
        averagePower: true,
        normalizedPower: true,
        ifValue: true,
      },
      orderBy: {
        startDate: 'desc',
      },
      take: 100, // Aumentar para cubrir más días
    });

    // Obtener FTP del atleta para calcular TSS
    const athleteRecord = await prisma.athleteRecord.findUnique({
      where: { athleteId },
      select: { estimatedFTP: true }
    });
    const ftp = athleteRecord?.estimatedFTP || 200; // Default 200W si no hay FTP

    console.log(`[Training Compliance] Athlete FTP: ${ftp}W`);
    console.log(`[Training Compliance] Total activities in DB: ${allActivities.length}`);
    
    // Función para calcular TSS estimado
    function calculateTSS(activity: typeof allActivities[0]): number {
      // Si ya tiene TSS calculado, usarlo
      if (activity.tss && activity.tss > 0) return activity.tss;
      
      // Necesitamos tiempo y alguna métrica de intensidad
      const duration = activity.movingTime || 0;
      if (duration === 0) return 0;
      
      // Si tenemos IF (Intensity Factor) calculado
      if (activity.ifValue && activity.ifValue > 0) {
        // TSS = (tiempo_en_segundos × IF²) / 36
        return Math.round((duration * Math.pow(activity.ifValue, 2)) / 36);
      }
      
      // Si tenemos potencia normalizada
      if (activity.normalizedPower && activity.normalizedPower > 0 && ftp > 0) {
        const if_ = activity.normalizedPower / ftp;
        return Math.round((duration * Math.pow(if_, 2)) / 36);
      }
      
      // Si solo tenemos potencia media (estimación menos precisa)
      if (activity.averagePower && activity.averagePower > 0 && ftp > 0) {
        // Para potencia media, usamos un factor de corrección estimado
        // NP suele ser ~5-10% mayor que AP en ciclimo
        const estimatedNP = activity.averagePower * 1.05;
        const if_ = estimatedNP / ftp;
        return Math.round((duration * Math.pow(if_, 2)) / 36);
      }
      
      return 0;
    }

    // Calcular TSS para todas las actividades
    const activitiesWithTSS = allActivities.map(a => ({
      ...a,
      calculatedTSS: calculateTSS(a)
    }));

    console.log(`[Training Compliance] Recent activities with TSS:`, activitiesWithTSS.slice(0, 5).map(a => ({
      date: a.startDate.toISOString(),
      localDate: a.startDate.toLocaleDateString('es-ES'),
      tss: a.tss,
      calculatedTSS: a.calculatedTSS,
      movingTime: a.movingTime,
      avgPower: a.averagePower,
      np: a.normalizedPower,
      if: a.ifValue,
      name: a.name?.substring(0, 30)
    })));

    // Filtrar actividades del período manualmente (más fiable que la query con timezone)
    const activities = activitiesWithTSS.filter(a => {
      const actDate = new Date(a.startDate);
      return actDate >= startDate && actDate <= endDate;
    });

    console.log(`[Training Compliance] Activities in date range: ${activities.length}`);
    
    // Sumar TSS por día
    const dailyTSS: Record<string, number> = {};
    activities.forEach(a => {
      const actDate = new Date(a.startDate);
      const dateStr = actDate.toISOString().split('T')[0];
      const tssValue = a.calculatedTSS || a.tss || 0;
      dailyTSS[dateStr] = (dailyTSS[dateStr] || 0) + Math.round(tssValue);
    });
    
    console.log(`[Training Compliance] Daily TSS:`, dailyTSS);

    // Obtener datos de FitnessMetric (TSS diario calculado) - más preciso
    const fitnessMetrics = await prisma.fitnessMetric.findMany({
      where: {
        athleteId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        tss: true,
      },
    });

    console.log(`[Training Compliance] Found ${fitnessMetrics.length} fitness metrics`);

    // Obtener planes de entrenamiento del período (incluyendo una semana antes para cubrir inicios de semana)
    const weekBefore = new Date(startDate);
    weekBefore.setDate(weekBefore.getDate() - 7);
    
    const weeklyPlans = await prisma.weeklyTrainingPlan.findMany({
      where: {
        athleteId,
        weekStart: {
          gte: weekBefore,
          lte: endDate,
        },
      },
      include: {
        days: {
          select: {
            dayDate: true,
            targetTSS: true,
            completed: true,
          },
        },
      },
    });

    console.log(`[Training Compliance] Found ${weeklyPlans.length} weekly plans with ${weeklyPlans.reduce((sum, p) => sum + p.days.length, 0)} days`);
    if (weeklyPlans.length > 0) {
      const allDays = weeklyPlans.flatMap(p => p.days);
      console.log(`[Training Compliance] Sample plan days:`, allDays.slice(0, 5).map(d => ({
        date: d.dayDate.toISOString(),
        targetTSS: d.targetTSS
      })));
    }

    // Generar array con todos los días del período (ordenados cronológicamente)
    const result = [];
    
    for (let i = 0; i < days; i++) {
      const current = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + i,
        0, 0, 0, 0
      ));
      
      // Formatear fecha como YYYY-MM-DD
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const day = String(current.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Formatear día de la semana (Lun, Mar, Mié, etc.)
      const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayLabel = weekdays[current.getUTCDay()];
      
      // Formatear fecha para mostrar (DD-MM)
      const displayDate = `${day}-${month}`;
      
      // Buscar TSS planificado para este día en los planes de entrenamiento
      let plannedTSS = 0;
      for (const plan of weeklyPlans) {
        const planDay = plan.days.find(d => {
          const dYear = d.dayDate.getUTCFullYear();
          const dMonth = String(d.dayDate.getUTCMonth() + 1).padStart(2, '0');
          const dDay = String(d.dayDate.getUTCDate()).padStart(2, '0');
          const dDateStr = `${dYear}-${dMonth}-${dDay}`;
          return dDateStr === dateStr;
        });
        if (planDay?.targetTSS && planDay.targetTSS > 0) {
          plannedTSS = planDay.targetTSS;
          break;
        }
      }

      // Calcular TSS real del día
      let actualTSS = 0;
      
      // Usar el TSS pre-calculado por día
      actualTSS = dailyTSS[dateStr] || 0;
      
      // También verificar FitnessMetric si existe
      const fitnessMetric = fitnessMetrics.find(m => {
        const mDateStr = m.date.toISOString().split('T')[0];
        return mDateStr === dateStr;
      });
      
      if (fitnessMetric?.tss && fitnessMetric.tss > actualTSS) {
        actualTSS = Math.round(fitnessMetric.tss);
      }
      
      if (actualTSS > 0) {
        console.log(`[Training Compliance] ${dateStr}: TSS = ${actualTSS}`);
      }

      // Calcular cumplimiento
      let compliance = 0;
      if (plannedTSS > 0) {
        compliance = Math.min((actualTSS / plannedTSS) * 100, 200);
      } else if (actualTSS > 0) {
        compliance = 100;
      }

      result.push({
        date: dateStr,
        displayDate,
        dayLabel,
        plannedTSS,
        actualTSS,
        compliance: Math.round(compliance),
      });
    }

    const summary = {
      totalDays: result.length,
      daysWithPlan: result.filter(d => d.plannedTSS > 0).length,
      daysWithActivity: result.filter(d => d.actualTSS > 0).length,
      avgCompliance: result.length > 0 
        ? result.filter(d => d.plannedTSS > 0).reduce((sum, d) => sum + d.compliance, 0) / 
          Math.max(result.filter(d => d.plannedTSS > 0).length, 1)
        : 0,
      totalPlannedTSS: result.reduce((sum, d) => sum + d.plannedTSS, 0),
      totalActualTSS: result.reduce((sum, d) => sum + d.actualTSS, 0),
    };

    console.log(`[Training Compliance] Generated ${result.length} days`);
    console.log(`[Training Compliance] First day:`, result[0]);
    console.log(`[Training Compliance] Last day:`, result[result.length - 1]);
    console.log(`[Training Compliance] Summary:`, summary);

    return NextResponse.json({
      data: result,
      summary,
    });

  } catch (error) {
    console.error('[Training Compliance API] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de cumplimiento' },
      { status: 500 }
    );
  }
}
