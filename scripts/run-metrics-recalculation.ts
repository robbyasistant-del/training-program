/**
 * One-time Metrics Recalculation Script
 */

import { prisma } from '../lib/db';
import { recalculateAthleteMetrics, recalculateAllAthletes } from '../lib/fitness/recalculator';

interface ScriptOptions {
  athleteId?: string;
  fromDate?: Date;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--athlete-id=')) {
      const id = arg.split('=')[1];
      if (id) options.athleteId = id;
    } else if (arg.startsWith('--from-date=')) {
      const dateStr = arg.split('=')[1];
      if (dateStr) options.fromDate = new Date(dateStr);
    }
  }

  return options;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const options = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           FITNESS METRICS RECALCULATION SCRIPT                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    if (options.athleteId) {
      console.log(`Recalculating metrics for athlete: ${options.athleteId}`);

      const result = await recalculateAthleteMetrics(options.athleteId, {
        fromDate: options.fromDate,
        toDate: undefined,
        useBatchProcessing: true,
        batchSize: 1000,
        verbose: true,
      });

      console.log('\nResult:');
      console.log(`  Days processed:     ${result.daysProcessed}`);
      console.log(`  Activities:         ${result.activitiesConsidered}`);
      console.log(`  Metrics upserted:   ${result.metricsUpserted}`);
      console.log(`  Execution time:     ${result.executionTimeMs}ms`);
    } else {
      console.log('Recalculating metrics for ALL athletes\n');

      const results = await recalculateAllAthletes({
        fromDate: options.fromDate,
        toDate: undefined,
        useBatchProcessing: true,
        verbose: true,
      });

      const athletes = Object.keys(results);
      const totalMetrics = Object.values(results).reduce((sum, r) => sum + r.metricsUpserted, 0);
      const totalTime = Object.values(results).reduce((sum, r) => sum + r.executionTimeMs, 0);

      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('SUMMARY');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`Total athletes:     ${athletes.length}`);
      console.log(`Total metrics:      ${totalMetrics}`);
      console.log(`Total time:         ${totalTime}ms`);
      console.log('═══════════════════════════════════════════════════════════════');
    }

    const totalExecutionTime = Date.now() - startTime;
    console.log(`\n✓ Script completed in ${totalExecutionTime}ms`);
  } catch (error) {
    console.error('\n✗ Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
