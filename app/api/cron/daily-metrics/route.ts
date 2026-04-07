/**
 * Cron Job: Recálculo Diario de Métricas de Fitness
 *
 * Este endpoint se ejecuta diariamente a las 2:00 AM para recalcular
 * las métricas de fitness (CTL, ATL, TSB) de todos los atletas activos.
 *
 * Configuración en vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-metrics",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 *
 * O configuración externa (Render/ Railway/ etc):
 * - curl -X POST https://your-app.com/api/cron/daily-metrics \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { recalculateAthleteMetrics } from '@/lib/fitness/recalculator';

// Header de autorización para proteger el endpoint
const CRON_SECRET = process.env.CRON_SECRET;

// Configuración del batch processing
const BATCH_SIZE = 50; // Atletas por batch
const DELAY_BETWEEN_BATCHES_MS = 1000; // 1 segundo entre batches

interface RecalculationResult {
  athleteId: string;
  success: boolean;
  metricsUpserted?: number;
  executionTimeMs?: number;
  error?: string;
}

/**
 * GET handler para cron job programado
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const cronSecret = authHeader?.replace('Bearer ', '');

    if (CRON_SECRET && cronSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid cron secret' },
        { status: 401 }
      );
    }

    console.log('[Cron Daily Metrics] Starting daily metrics recalculation...');

    // Obtener atletas activos (con actividades en los últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeAthletes = await prisma.athlete.findMany({
      where: {
        activities: {
          some: {
            startDate: {
              gte: thirtyDaysAgo,
            },
          },
        },
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
      },
    });

    console.log(`[Cron Daily Metrics] Found ${activeAthletes.length} active athletes`);

    if (activeAthletes.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: 'No active athletes found',
        summary: {
          totalAthletes: 0,
          successful: 0,
          failed: 0,
        },
      });
    }

    // Procesar en batches para no sobrecargar la DB
    const results: RecalculationResult[] = [];
    const successful: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < activeAthletes.length; i += BATCH_SIZE) {
      const batch = activeAthletes.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(activeAthletes.length / BATCH_SIZE);

      console.log(
        `[Cron Daily Metrics] Processing batch ${batchNumber}/${totalBatches} (${batch.length} athletes)`
      );

      // Procesar atletas del batch en paralelo
      const batchResults = await Promise.all(
        batch.map(async (athlete) => {
          const athleteStartTime = Date.now();

          try {
            const result = await recalculateAthleteMetrics(athlete.id, {
              toDate: new Date(),
              useBatchProcessing: true,
              batchSize: 500,
              verbose: false,
              fromDate: undefined,
            });

            const executionTime = Date.now() - athleteStartTime;

            console.log(
              `[Cron Daily Metrics] ✓ Athlete ${athlete.id} (${athlete.firstname} ${athlete.lastname}): ` +
                `${result.metricsUpserted} metrics in ${executionTime}ms`
            );

            successful.push(athlete.id);

            return {
              athleteId: athlete.id,
              success: true,
              metricsUpserted: result.metricsUpserted,
              executionTimeMs: executionTime,
            };
          } catch (error) {
            const executionTime = Date.now() - athleteStartTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            console.error(
              `[Cron Daily Metrics] ✗ Athlete ${athlete.id} failed in ${executionTime}ms:`,
              errorMessage
            );

            failed.push(athlete.id);

            return {
              athleteId: athlete.id,
              success: false,
              error: errorMessage,
              executionTimeMs: executionTime,
            };
          }
        })
      );

      results.push(...batchResults);

      // Delay entre batches para no saturar la DB
      if (i + BATCH_SIZE < activeAthletes.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    const totalTime = Date.now() - startTime;

    // Calcular estadísticas
    const totalMetricsUpserted = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.metricsUpserted || 0), 0);

    const avgExecutionTime =
      results.length > 0
        ? results.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / results.length
        : 0;

    console.log(`[Cron Daily Metrics] Completed in ${totalTime}ms`);
    console.log(
      `[Cron Daily Metrics] Summary: ${successful.length} successful, ${failed.length} failed`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalAthletes: activeAthletes.length,
        successful: successful.length,
        failed: failed.length,
        totalMetricsUpserted,
        avgExecutionTimeMs: Math.round(avgExecutionTime),
        totalExecutionTimeMs: totalTime,
      },
      details: results,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[Cron Daily Metrics] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: errorMessage,
        executionTimeMs: totalTime,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler (alternativa para triggers manuales o webhooks)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
