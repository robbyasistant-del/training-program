import { NextRequest, NextResponse } from 'next/server';

import { recalculateAthleteMetrics } from '@/lib/fitness/recalculator';

/**
 * POST /api/athletes/[id]/fitness-metrics/recalculate
 *
 * Recalcula todas las métricas de fitness (CTL, ATL, TSB) para un atleta
 * desde la primera actividad hasta hoy.
 *
 * Body opcional:
 * - fromDate: Fecha desde la cual recalcular (ISO string)
 * - batchSize: Tamaño del batch para procesamiento (default: 1000)
 *
 * Response: Resultado del recálculo con estadísticas
 */

// Rate limiting simple (en producción usar Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // 5 recálculos por hora
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function checkRateLimit(athleteId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(athleteId);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(athleteId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const athleteId = params.id;

    // Rate limiting
    if (!checkRateLimit(athleteId)) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Máximo 5 recálculos por hora. Inténtalo más tarde.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        },
        { status: 429 }
      );
    }

    // Parsear body opcional
    let body: { fromDate?: string; batchSize?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Body vacío es válido
    }

    const fromDate = body.fromDate ? new Date(body.fromDate) : undefined;
    const batchSize = body.batchSize || 1000;

    // Validar batchSize
    if (batchSize < 1 || batchSize > 5000) {
      return NextResponse.json(
        { error: 'Invalid batchSize. Must be between 1 and 5000' },
        { status: 400 }
      );
    }

    // Ejecutar recálculo
    const recalcOptions = {
      toDate: new Date(),
      useBatchProcessing: true,
      batchSize,
      verbose: true,
      fromDate: fromDate ?? undefined,
    };

    const result = await recalculateAthleteMetrics(athleteId, recalcOptions);

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      athleteId,
      result: {
        ...result,
        totalTimeMs: totalTime,
      },
      message: `Recálculo completado: ${result.metricsUpserted} métricas procesadas en ${totalTime}ms`,
    });
  } catch (error) {
    console.error('[Recalculate API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Recalculation failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
