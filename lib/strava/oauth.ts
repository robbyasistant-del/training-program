/**
 * Strava OAuth2 Module
 * Maneja el flujo completo de autenticación OAuth2 con Strava
 * - authorize: Genera URL de autorización
 * - callback: Intercambia código por tokens
 * - token exchange: Obtiene access_token y refresh_token
 */

import { encryptToken } from '@/lib/crypto/tokenCrypto';
import { prisma } from '@/lib/db';

interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
}

interface TokenExchangeResponse extends StravaTokens {
  token_type: string;
  athlete?: {
    id: number;
    username?: string;
    firstname?: string;
    lastname?: string;
    profile?: string;
    email?: string;
    [key: string]: unknown;
  };
}

// Strava API configuration
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI;

/**
 * Valida la configuración de OAuth
 */
export function validateOAuthConfig(): void {
  if (!STRAVA_CLIENT_ID) {
    throw new Error('STRAVA_CLIENT_ID environment variable is not set');
  }
  if (!STRAVA_CLIENT_SECRET) {
    throw new Error('STRAVA_CLIENT_SECRET environment variable is not set');
  }
  if (!STRAVA_REDIRECT_URI) {
    throw new Error('STRAVA_REDIRECT_URI environment variable is not set');
  }
}

/**
 * Genera la URL de autorización de Strava OAuth2
 * @param state - Parámetro CSRF para protección
 * @param scope - Permisos solicitados (default: 'read,activity:read')
 * @returns URL de autorización de Strava
 */
export function generateAuthUrl(
  state: string,
  scope: string = 'read,activity:read',
  approvalPrompt: 'auto' | 'force' = 'auto'
): string {
  validateOAuthConfig();

  const authUrl = new URL('https://www.strava.com/oauth/authorize');
  authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', STRAVA_REDIRECT_URI!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('approval_prompt', approvalPrompt);

  return authUrl.toString();
}

/**
 * Intercambia el código de autorización por tokens de acceso
 * @param code - Código de autorización recibido en el callback
 * @returns Tokens de acceso y datos del atleta
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenExchangeResponse> {
  validateOAuthConfig();

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Token exchange failed: ${response.status} - ${errorData.message || 'Unknown error'}`
    );
  }

  return await response.json();
}

/**
 * Genera un estado CSRF aleatorio para protección OAuth
 * @returns Estado codificado en base64url
 */
export function generateState(): string {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID();
  return Buffer.from(`${timestamp}-${randomId}`).toString('base64url');
}

/**
 * Valida el estado CSRF recibido contra el almacenado
 * @param receivedState - Estado recibido en el callback
 * @param storedState - Estado almacenado (cookie/sesión)
 * @returns true si el estado es válido
 */
export function validateState(receivedState: string, storedState: string): boolean {
  // Validación básica: comparación exacta
  // En producción, podría incluir verificación de timestamp (expiración)
  return receivedState === storedState;
}

/**
 * Completa el flujo OAuth completo: desde el código hasta almacenar tokens
 * @param code - Código de autorización
 * @param state - Estado CSRF recibido
 * @param storedState - Estado CSRF almacenado
 * @returns Datos del atleta y tokens almacenados
 */
export async function completeOAuthFlow(
  code: string,
  state: string,
  storedState: string
): Promise<{
  athlete: {
    id: string;
    stravaId: bigint;
    email: string;
    firstname: string;
    lastname: string;
    profileImage: string | null;
  };
  tokens: StravaTokens;
}> {
  // Validar CSRF
  if (!validateState(state, storedState)) {
    throw new Error('Invalid OAuth state: possible CSRF attack');
  }

  // Intercambiar código por tokens
  const tokenData = await exchangeCodeForTokens(code);

  if (!tokenData.access_token || !tokenData.refresh_token || !tokenData.expires_at) {
    throw new Error('Invalid token response from Strava');
  }

  if (!tokenData.athlete?.id) {
    throw new Error('No athlete data in token response');
  }

  const stravaAthleteId = BigInt(tokenData.athlete.id);
  const athleteData = tokenData.athlete;

  // Buscar o crear atleta
  let athlete = await prisma.athlete.findUnique({
    where: { stravaId: stravaAthleteId },
  });

  if (!athlete) {
    athlete = await prisma.athlete.create({
      data: {
        stravaId: stravaAthleteId,
        email: athleteData.email || `${stravaAthleteId}@strava.placeholder`,
        firstname: athleteData.firstname || 'Strava',
        lastname: athleteData.lastname || 'User',
        profileImage: athleteData.profile || null,
      },
    });
  }

  // Almacenar tokens de forma segura
  const encryptedAccessToken = encryptToken(tokenData.access_token);
  const encryptedRefreshToken = encryptToken(tokenData.refresh_token);

  await prisma.stravaConnection.upsert({
    where: { athleteId: athlete.id },
    create: {
      athleteId: athlete.id,
      encryptedAccessToken: new Uint8Array(encryptedAccessToken),
      encryptedRefreshToken: new Uint8Array(encryptedRefreshToken),
      expiresAt: new Date(tokenData.expires_at * 1000),
    },
    update: {
      encryptedAccessToken: new Uint8Array(encryptedAccessToken),
      encryptedRefreshToken: new Uint8Array(encryptedRefreshToken),
      expiresAt: new Date(tokenData.expires_at * 1000),
      updatedAt: new Date(),
    },
  });

  return {
    athlete: {
      id: athlete.id,
      stravaId: athlete.stravaId,
      email: athlete.email,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      profileImage: athlete.profileImage,
    },
    tokens: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      expires_in: tokenData.expires_in,
    },
  };
}

export type { StravaTokens, TokenExchangeResponse };
