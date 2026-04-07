import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { calculateAthleteFitnessMetrics } from '@/lib/fitness/performanceCurves';

/**
 * GET /api/athletes/me/fitness-metrics
 * Obtiene métricas de fitness para el atleta autenticado
 * Query params:
 *   - from: fecha inicio (ISO string, opcional, default: 90 días atrás)
 *   - to: fecha fin (ISO string, opcional, default: hoy)
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Obtener athlete_id de la cookie
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Default: últimos 90 días
    const toDate = toParam ? new Date(toParam) : new Date();
    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Intentar obtener métricas de la base de datos primero
    const dbMetrics = await prisma.fitnessMetric.findMany({
      where: {
        athleteId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Si tenemos datos suficientes en la BD, usarlos
    if (dbMetrics.length > 0) {
      const metrics = dbMetrics.map((m) => ({
        date: m.date.toISOString().split('T')[0],
        ctl: Math.round(m.ctl * 10) / 10,
        atl: Math.round(m.atl * 10) / 10,
        tsb: Math.round(m.tsb * 10) / 10,
        tss: Math.round(m.tss * 10) / 10,
      }));

      return NextResponse.json({
        athleteId,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        count: metrics.length,
        metrics,
      });
    }

    // Si no hay datos en BD, calcular al vuelo
    const calculationResult = await calculateAthleteFitnessMetrics(athleteId, fromDate, toDate);

    return NextResponse.json({
      athleteId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      count: calculationResult.metrics.length,
      currentCTL: calculationResult.currentCTL,
      currentATL: calculationResult.currentATL,
      currentTSB: calculationResult.currentTSB,
      metrics: calculationResult.metrics,
    });
  } catch (error) {
    console.error('Error fetching fitness metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch fitness metrics' }, { status: 500 });
  }
}
