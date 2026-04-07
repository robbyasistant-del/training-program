/**
 * Standalone Cron Scheduler
 *
 * Script independiente para ejecutar el recálculo de métricas diario
 * cuando no se usa Vercel Cron Jobs u otro servicio de scheduling.
 *
 * Uso:
 *   tsx scripts/cron-scheduler.ts
 *
 * O con PM2:
 *   pm2 start scripts/cron-scheduler.ts --name "fitness-metrics-cron"
 *
 * Variables de entorno requeridas:
 *   - DATABASE_URL: URL de conexión a PostgreSQL
 *   - CRON_SECRET: (opcional) para proteger endpoints internos
 *   - CRON_SCHEDULE: Expresión cron (default: "0 2 * * *" = 2:00 AM diario)
 */

import { schedule } from 'node-cron';
import { prisma } from '../lib/db';
import { recalculateAthleteMetrics } from '../lib/fitness/recalculator';

// Configuración
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 2 * * *';
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 1000;

async function runDailyMetricsRecalculation(): Promise<void> {
  const startTime = Date.now();

  console.log('[Cron Scheduler] Starting daily metrics recalculation...');
  console.log(`[Cron Scheduler] Schedule: ${CRON_SCHEDULE}`);
  console.log(`[Cron Scheduler] Timestamp: ${new Date().toISOString()}`);

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeAthletes = await prisma.athlete.findMany({
      where: {
        activities: {
          some: {
            startDate: { gte: thirtyDaysAgo },
          },
        },
      },
      select: { id: true, firstname: true, lastname: true },
    });

    console.log(`[Cron Scheduler] Found ${activeAthletes.length} active athletes`);

    if (activeAthletes.length === 0) {
      console.log('[Cron Scheduler] No active athletes to process');
      return;
    }

    let totalMetricsUpserted = 0;

    for (let i = 0; i < activeAthletes.length; i += BATCH_SIZE) {
      const batch = activeAthletes.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(activeAthletes.length / BATCH_SIZE);

      console.log(`[Cron Scheduler] Processing batch ${batchNumber}/${totalBatches}`);

      for (const athlete of batch) {
        const athleteStartTime = Date.now();

        try {
          const result = await recalculateAthleteMetrics(athlete.id, {
            toDate: new Date(),
            fromDate: undefined,
            useBatchProcessing: true,
            batchSize: 500,
            verbose: false,
          });

          const executionTime = Date.now() - athleteStartTime;
          totalMetricsUpserted += result.metricsUpserted;

          console.log(
            `[Cron Scheduler] ✓ ${athlete.firstname} ${athlete.lastname}: ` +
              `${result.metricsUpserted} metrics in ${executionTime}ms`
          );
        } catch (error) {
          console.error(
            `[Cron Scheduler] ✗ ${athlete.firstname} ${athlete.lastname} failed:`,
            error
          );
        }
      }

      if (i + BATCH_SIZE < activeAthletes.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[Cron Scheduler] Completed in ${totalTime}ms, ${totalMetricsUpserted} metrics upserted`
    );
  } catch (error) {
    console.error('[Cron Scheduler] Fatal error:', error);
    throw error;
  }
}

function getNextRunTime(cronExpression: string): string {
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return 'Unknown';

  const parsed = parts.map((p) => parseInt(p));
  const minute = parsed[0];
  const hour = parsed[1];
  if (minute === undefined || hour === undefined || isNaN(minute) || isNaN(hour)) return 'Unknown';

  const now = new Date();
  let nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun.toLocaleString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function startScheduler(): void {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           FITNESS METRICS CRON SCHEDULER                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`Schedule:    ${CRON_SCHEDULE}`);
  console.log(`Timezone:    ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Next run:    ${getNextRunTime(CRON_SCHEDULE)}`);
  console.log('Press Ctrl+C to stop\n');

  const job = schedule(
    CRON_SCHEDULE,
    async () => {
      console.log(`\n[Cron Scheduler] Job triggered at ${new Date().toISOString()}`);
      try {
        await runDailyMetricsRecalculation();
      } catch (error) {
        console.error('[Cron Scheduler] Job failed:', error);
      }
    },
    { scheduled: true }
  );

  process.on('SIGINT', async () => {
    console.log('\n[Cron Scheduler] Shutting down...');
    job.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

if (require.main === module) {
  startScheduler();
}

export { startScheduler, runDailyMetricsRecalculation };
