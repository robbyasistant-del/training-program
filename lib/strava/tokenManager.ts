import { encryptToken, decryptToken } from '@/lib/crypto/tokenCrypto';
import { prisma } from '@/lib/db';

/**
 * Strava Token Manager
 * Handles secure storage, retrieval, and refresh of Strava OAuth tokens
 */

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
    [key: string]: unknown;
  };
}

// Strava API configuration
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

// Token refresh margin: refresh if expires in less than 5 minutes
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Validates environment configuration
 */
function validateConfig(): void {
  if (!STRAVA_CLIENT_ID) {
    throw new Error('STRAVA_CLIENT_ID environment variable is not set');
  }
  if (!STRAVA_CLIENT_SECRET) {
    throw new Error('STRAVA_CLIENT_SECRET environment variable is not set');
  }
}

/**
 * Stores Strava tokens securely in the database
 */
export async function storeTokens(athleteId: string, tokens: StravaTokens): Promise<void> {
  try {
    // Encrypt tokens before storage
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);
    const expiresAt = new Date(tokens.expires_at * 1000);

    // Convert Buffer to Uint8Array for Prisma
    const accessTokenBytes = new Uint8Array(encryptedAccessToken);
    const refreshTokenBytes = new Uint8Array(encryptedRefreshToken);

    await prisma.stravaConnection.upsert({
      where: { athleteId },
      create: {
        athleteId,
        encryptedAccessToken: accessTokenBytes,
        encryptedRefreshToken: refreshTokenBytes,
        expiresAt,
      },
      update: {
        encryptedAccessToken: accessTokenBytes,
        encryptedRefreshToken: refreshTokenBytes,
        expiresAt,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to store tokens: ${errorMessage}`);
  }
}

/**
 * Retrieves and decrypts the access token for an athlete
 * Automatically refreshes if the token is expired or about to expire
 */
export async function getValidAccessToken(athleteId: string): Promise<string> {
  try {
    const connection = await prisma.stravaConnection.findUnique({
      where: { athleteId },
    });

    if (!connection) {
      throw new Error('No Strava connection found for athlete');
    }

    const now = Date.now();
    const expiresAt = connection.expiresAt.getTime();
    const shouldRefresh = expiresAt - now < TOKEN_REFRESH_MARGIN_MS;

    if (shouldRefresh) {
      // Token is expired or about to expire, refresh it
      return await refreshAccessToken(athleteId);
    }

    // Token is still valid, decrypt and return
    const accessToken = decryptToken(Buffer.from(connection.encryptedAccessToken));
    return accessToken;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get valid access token: ${errorMessage}`);
  }
}

/**
 * Refreshes the access token using the stored refresh token
 */
export async function refreshAccessToken(athleteId: string): Promise<string> {
  try {
    validateConfig();

    const connection = await prisma.stravaConnection.findUnique({
      where: { athleteId },
    });

    if (!connection) {
      throw new Error('No Strava connection found for athlete');
    }

    // Decrypt the refresh token
    const refreshToken = decryptToken(Buffer.from(connection.encryptedRefreshToken));

    // Call Strava API to refresh the token
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token refresh failed: ${response.status} - ${errorData.message || 'Unknown error'}`
      );
    }

    const data: TokenExchangeResponse = await response.json();

    // Store the new tokens
    await storeTokens(athleteId, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      expires_in: data.expires_in,
    });

    return data.access_token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to refresh access token: ${errorMessage}`);
  }
}

/**
 * Disconnects Strava by deleting the stored tokens
 */
export async function disconnectStrava(athleteId: string): Promise<void> {
  try {
    const connection = await prisma.stravaConnection.findUnique({
      where: { athleteId },
    });

    if (!connection) {
      throw new Error('No Strava connection found for athlete');
    }

    // Optionally deauthorize with Strava API first
    try {
      const accessToken = decryptToken(Buffer.from(connection.encryptedAccessToken));
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      // Continue with local deletion even if API deauthorization fails
    }

    // Delete the connection from database
    await prisma.stravaConnection.delete({
      where: { athleteId },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to disconnect Strava: ${errorMessage}`);
  }
}

/**
 * Checks if an athlete has a valid Strava connection
 */
export async function hasValidConnection(athleteId: string): Promise<boolean> {
  try {
    const connection = await prisma.stravaConnection.findUnique({
      where: { athleteId },
    });

    if (!connection) {
      return false;
    }

    // Check if token is expired
    const now = Date.now();
    const expiresAt = connection.expiresAt.getTime();

    // Consider connection valid if token expires in more than 1 minute
    return expiresAt - now > 60000;
  } catch {
    return false;
  }
}

/**
 * Exchanges authorization code for access/refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenExchangeResponse> {
  try {
    validateConfig();

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to exchange code for tokens: ${errorMessage}`);
  }
}

export type { StravaTokens, TokenExchangeResponse };
