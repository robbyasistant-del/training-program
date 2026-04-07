import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { refreshAccessToken } from '@/lib/strava/tokenManager';

/**
 * Cron Job: Refrescar tokens de Strava que expiran pronto
 * Ejecutar cada hora para prevenir expiración masiva de usuarios
 *
 * Configuración en vercel.json o similar:
 * {
 *   "crons": [{
 *     "path": "/api/cron/refresh-tokens",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

// Header de autorización para proteger el endpoint
const CRON_SECRET = process.env.CRON_SECRET;

// Margen de tiempo: refrescar tokens que expiran en menos de 24 horas
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

interface RefreshResult {
  athleteId: string;
  success: boolean;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verificar autorización (opcional pero recomendado)
    const authHeader = request.headers.get('authorization');
    const cronSecret = authHeader?.replace('Bearer ', '');

    if (CRON_SECRET && cronSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid cron secret' },
        { status: 401 }
      );
    }

    // Calcular el umbral de tiempo (24 horas desde ahora)
    const now = new Date();
    const refreshThreshold = new Date(now.getTime() + REFRESH_WINDOW_MS);

    // Buscar tokens que expiran en menos de 24 horas
    const expiringConnections = await prisma.stravaConnection.findMany({
      where: {
        expiresAt: {
          lte: refreshThreshold,
          gt: now, // Solo los que aún no han expirado
        },
      },
      select: {
        athleteId: true,
        expiresAt: true,
      },
    });

    console.log(`[Cron Refresh] Found ${expiringConnections.length} tokens expiring within 24h`);

    // Refrescar cada token
    const results: RefreshResult[] = [];
    const refreshed: string[] = [];
    const failed: string[] = [];

    for (const connection of expiringConnections) {
      try {
        await refreshAccessToken(connection.athleteId);
        results.push({ athleteId: connection.athleteId, success: true });
        refreshed.push(connection.athleteId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[Cron Refresh] Failed to refresh token for athlete ${connection.athleteId}:`,
          errorMessage
        );
        results.push({
          athleteId: connection.athleteId,
          success: false,
          error: errorMessage,
        });
        failed.push(connection.athleteId);
      }
    }

    // Retornar resumen
    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        checked: expiringConnections.length,
        refreshed: refreshed.length,
        failed: failed.length,
      },
      details: results,
    });
  } catch (error) {
    console.error('[Cron Refresh] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Cron job failed', message: errorMessage }, { status: 500 });
  }
}

/**
 * POST handler (alternativa para triggers manuales o webhooks)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
