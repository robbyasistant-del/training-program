/**
 * Strava Rate Limiter con Backoff Exponencial
 * Maneja rate limits de Strava API (100 req/15min) con:
 * - Tracking de headers X-RateLimit-*
 * - Backoff exponencial al acercarse al límite (80% threshold)
 * - Retry con jitter para errores 429
 */

import { getValidAccessToken } from './tokenManager';

// Strava API limits
const STRAVA_RATE_LIMIT = 100; // requests per 15 min window
const STRAVA_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes in ms
const THRESHOLD_PERCENTAGE = 0.8; // Start backoff at 80% of limit (80 requests)
const THRESHOLD_REQUESTS = Math.floor(STRAVA_RATE_LIMIT * THRESHOLD_PERCENTAGE); // 80

// Backoff config
const BASE_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 5000;
const MAX_RETRIES = 3;

interface RateLimitState {
  limit: number;
  usage: number;
  remaining: number;
  resetTime: number; // Unix timestamp
  backoffMs: number;
  requestCount: number;
  windowStart: number;
}

interface StravaRateLimitHeaders {
  limit: string | null;
  usage: string | null;
}

// Singleton state
let rateLimitState: RateLimitState = {
  limit: STRAVA_RATE_LIMIT,
  usage: 0,
  remaining: STRAVA_RATE_LIMIT,
  resetTime: 0,
  backoffMs: BASE_BACKOFF_MS,
  requestCount: 0,
  windowStart: Date.now(),
};

const requestQueue: Array<() => void> = [];
let isProcessingQueue = false;

/**
 * Extrae headers de rate limit de la respuesta de Strava
 */
function extractRateLimitHeaders(response: Response): StravaRateLimitHeaders {
  return {
    limit: response.headers.get('X-RateLimit-Limit'),
    usage: response.headers.get('X-RateLimit-Usage'),
  };
}

/**
 * Actualiza el estado de rate limiting basado en headers de Strava
 */
function updateRateLimitState(headers: StravaRateLimitHeaders): void {
  if (headers.limit) {
    rateLimitState.limit = parseInt(headers.limit, 10);
  }
  if (headers.usage) {
    rateLimitState.usage = parseInt(headers.usage, 10);
  }
  rateLimitState.remaining = rateLimitState.limit - rateLimitState.usage;
  rateLimitState.requestCount++;

  // Reset window if needed
  const now = Date.now();
  if (now - rateLimitState.windowStart > STRAVA_RATE_WINDOW_MS) {
    rateLimitState.windowStart = now;
    rateLimitState.requestCount = 0;
    rateLimitState.backoffMs = BASE_BACKOFF_MS;
  }
}

/**
 * Calcula el delay necesario basado en el estado actual
 * Implementa backoff exponencial cuando se acerca al límite
 */
function calculateDelay(): number {
  // If we're approaching the threshold, add exponential backoff
  if (rateLimitState.usage >= THRESHOLD_REQUESTS) {
    const excess = rateLimitState.usage - THRESHOLD_REQUESTS;
    const backoffFactor = Math.min(excess + 1, 5); // Cap at 5 doublings
    const jitter = Math.random() * 100; // 0-100ms random jitter

    const delay = Math.min(BASE_BACKOFF_MS * Math.pow(2, backoffFactor) + jitter, MAX_BACKOFF_MS);

    console.warn(
      `[RateLimiter] Approaching limit: ${rateLimitState.usage}/${rateLimitState.limit} requests. ` +
        `Adding ${Math.round(delay)}ms delay.`
    );

    return Math.round(delay);
  }

  // Minimum delay between requests to stay under limit
  const minDelay = STRAVA_RATE_WINDOW_MS / STRAVA_RATE_LIMIT; // ~9 seconds
  return Math.max(
    0,
    minDelay - (Date.now() - rateLimitState.windowStart) / rateLimitState.requestCount
  );
}

/**
 * Espera el tiempo necesario respetando rate limits
 */
async function throttleRequest(): Promise<void> {
  const delay = calculateDelay();

  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Procesa la cola de requests de forma secuencial
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      await throttleRequest();
      request();
    }
  }

  isProcessingQueue = false;
}

/**
 * Añade un request a la cola
 */
function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    processQueue();
  });
}

/**
 * Realiza retry con backoff exponencial y jitter
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, attempt: number = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    // Calculate exponential backoff with jitter
    const baseDelay = BASE_BACKOFF_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 100;
    const delay = Math.min(baseDelay + jitter, MAX_BACKOFF_MS);

    console.warn(`[RateLimiter] Retry ${attempt + 1}/${MAX_RETRIES} after ${Math.round(delay)}ms`);

    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, attempt + 1);
  }
}

/**
 * Realiza una petición a la API de Strava con rate limiting y retry
 */
async function fetchFromStravaWithRateLimit(
  endpoint: string,
  athleteId: string,
  options: RequestInit = {}
): Promise<Response> {
  return enqueueRequest(async () => {
    const accessToken = await getValidAccessToken(athleteId);

    const makeRequest = async (): Promise<Response> => {
      const response = await fetch(`https://www.strava.com/api/v3${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Update rate limit state from headers
      const headers = extractRateLimitHeaders(response);
      updateRateLimitState(headers);

      if (response.status === 429) {
        // Rate limit exceeded - wait for reset
        const retryAfter = response.headers.get('Retry-After');
        const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;

        console.warn(`[RateLimiter] 429 received. Waiting ${waitSeconds}s until reset...`);
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));

        // Reset backoff after rate limit reset
        rateLimitState.backoffMs = BASE_BACKOFF_MS;

        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Strava API error: ${response.status} - ${errorData.message || response.statusText}`
        );
      }

      return response;
    };

    return retryWithBackoff(makeRequest);
  });
}

/**
 * Obtiene el estado actual del rate limiter
 */
export function getRateLimitState(): Readonly<RateLimitState> {
  return { ...rateLimitState };
}

/**
 * Resetea el estado del rate limiter (útil para testing)
 */
export function resetRateLimitState(): void {
  rateLimitState = {
    limit: STRAVA_RATE_LIMIT,
    usage: 0,
    remaining: STRAVA_RATE_LIMIT,
    resetTime: 0,
    backoffMs: BASE_BACKOFF_MS,
    requestCount: 0,
    windowStart: Date.now(),
  };
}

/**
 * Verifica si estamos cerca del límite de rate
 */
export function isNearRateLimit(): boolean {
  return rateLimitState.usage >= THRESHOLD_REQUESTS;
}

/**
 * Obtiene el tiempo estimado hasta el reset del rate limit
 */
export function getTimeUntilReset(): number {
  if (rateLimitState.resetTime === 0) return 0;
  return Math.max(0, rateLimitState.resetTime * 1000 - Date.now());
}

// Re-export types and functions from api-service for compatibility
export { fetchFromStravaWithRateLimit as fetchFromStrava };
export type { RateLimitState };
