/**
 * Webhook Handler: Strava Events
 *
 * Recibe eventos de actividad de Strava y dispara el recálculo
 * incremental de métricas de fitness para el atleta afectado.
 *
 * Configuración en Strava API:
 * - Callback URL: https://your-app.com/api/webhooks/strava
 * - Verify Token: (el valor de STRAVA_WEBHOOK_VERIFY_TOKEN)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { incrementalRecalculation } from '@/lib/fitness/recalculator';
import { detectPersonalRecord } from '@/lib/personalRecords';
import { mapStravaActivity } from '@/lib/strava/mappers';

// Tokens de configuración
const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
const WEBHOOK_SECRET = process.env.STRAVA_WEBHOOK_SECRET;

// Tipos de eventos de Strava
interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
}

interface StravaWebhookChallenge {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

/**
 * GET handler - Verificación del webhook (challenge-response)
 *
 * Strava envía una petición GET para verificar la URL del webhook
 * antes de activarlo. Debemos responder con el hub.challenge.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[Strava Webhook] Challenge received:', { mode, token, challenge });

  // Validar modo
  if (mode !== 'subscribe') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  // Validar verify token
  if (VERIFY_TOKEN && token !== VERIFY_TOKEN) {
    console.error('[Strava Webhook] Invalid verify token');
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
  }

  // Responder con el challenge
  if (challenge) {
    console.log('[Strava Webhook] Challenge accepted');
    return NextResponse.json({ 'hub.challenge': challenge });
  }

  return NextResponse.json({ error: 'Missing challenge' }, { status: 400 });
}

/**
 * POST handler - Recibir eventos de actividad
 *
 * Strava envía eventos cuando:
 * - Se crea una nueva actividad
 * - Se actualiza una actividad existente
 * - Se elimina una actividad
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Verificar firma del webhook (si está configurada)
    const webhookSecret = request.headers.get('x-strava-webhook-secret');

    if (WEBHOOK_SECRET && webhookSecret !== WEBHOOK_SECRET) {
      console.warn('[Strava Webhook] Missing or invalid webhook secret');
    }

    // Parsear el evento
    const event: StravaWebhookEvent = await request.json();

    console.log('[Strava Webhook] Event received:', {
      object_type: event.object_type,
      aspect_type: event.aspect_type,
      object_id: event.object_id,
      owner_id: event.owner_id,
      event_time: new Date(event.event_time * 1000).toISOString(),
    });

    // Solo procesar eventos de actividad (no athlete)
    if (event.object_type !== 'activity') {
      console.log('[Strava Webhook] Ignoring non-activity event');
      return NextResponse.json({ success: true, ignored: true });
    }

    // Buscar el atleta por stravaId
    const athlete = await prisma.athlete.findUnique({
      where: { stravaId: BigInt(event.owner_id) },
      select: { id: true, firstname: true, lastname: true },
    });

    if (!athlete) {
      console.warn(`[Strava Webhook] Athlete not found for Strava ID: ${event.owner_id}`);
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    console.log(`[Strava Webhook] Processing ${event.aspect_type} for athlete ${athlete.id}`);

    // Manejar según el tipo de evento
    switch (event.aspect_type) {
      case 'create': {
        const activityDate = new Date();
        activityDate.setDate(activityDate.getDate() - 1);

        // Recalcular métricas de fitness
        const result = await incrementalRecalculation(athlete.id, activityDate);

        // Buscar la actividad recién creada para detectar PRs
        let prDetected = null;
        try {
          const activity = await prisma.activity.findUnique({
            where: { stravaActivityId: BigInt(event.object_id) },
            select: {
              id: true,
              distance: true,
              movingTime: true,
              startDate: true,
              athleteId: true,
            },
          });

          if (activity?.movingTime && activity.movingTime > 0) {
            const prResult = await detectPersonalRecord(
              {
                id: activity.id,
                distance: activity.distance ?? 0,
                movingTime: activity.movingTime,
                startDate: activity.startDate,
              },
              athlete.id
            );

            if (prResult.isPR) {
              prDetected = {
                distanceLabel: prResult.record?.distanceLabel,
                timeSeconds: prResult.record?.timeSeconds,
                improvementSeconds: prResult.record?.improvementSeconds,
              };
            }
          }
        } catch (prError) {
          console.error('[Strava Webhook] Error detecting PR:', prError);
          // Don't fail the webhook if PR detection fails
        }

        const executionTime = Date.now() - startTime;

        console.log(
          `[Strava Webhook] ✓ Created: ${result.metricsUpserted} metrics recalculated ` +
            `for athlete ${athlete.id} in ${executionTime}ms` +
            (prDetected ? ` | PR detected: ${prDetected.distanceLabel}` : '')
        );

        return NextResponse.json({
          success: true,
          event: 'activity_create',
          athleteId: athlete.id,
          result: {
            metricsUpserted: result.metricsUpserted,
            executionTimeMs: executionTime,
            finalCtl: result.finalCtl,
            finalAtl: result.finalAtl,
            finalTsb: result.finalTsb,
            prDetected,
          },
        });
      }

      case 'update': {
        const updateDate = new Date();
        updateDate.setDate(updateDate.getDate() - 7);

        const result = await incrementalRecalculation(athlete.id, updateDate);

        const executionTime = Date.now() - startTime;

        console.log(
          `[Strava Webhook] ✓ Updated: ${result.metricsUpserted} metrics recalculated ` +
            `for athlete ${athlete.id} in ${executionTime}ms`
        );

        return NextResponse.json({
          success: true,
          event: 'activity_update',
          athleteId: athlete.id,
          result: {
            metricsUpserted: result.metricsUpserted,
            executionTimeMs: executionTime,
          },
        });
      }

      case 'delete': {
        const result = await incrementalRecalculation(athlete.id, new Date('2000-01-01'));

        const executionTime = Date.now() - startTime;

        console.log(
          `[Strava Webhook] ✓ Deleted: ${result.metricsUpserted} metrics recalculated ` +
            `for athlete ${athlete.id} in ${executionTime}ms`
        );

        return NextResponse.json({
          success: true,
          event: 'activity_delete',
          athleteId: athlete.id,
          result: {
            metricsUpserted: result.metricsUpserted,
            executionTimeMs: executionTime,
          },
        });
      }

      default:
        console.warn(`[Strava Webhook] Unknown aspect_type: ${event.aspect_type}`);
        return NextResponse.json({ error: 'Unknown aspect type' }, { status: 400 });
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[Strava Webhook] Error processing event:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: errorMessage,
        executionTimeMs: executionTime,
      },
      { status: 500 }
    );
  }
}
