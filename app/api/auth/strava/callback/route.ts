import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { exchangeCodeForTokens, storeTokens } from '@/lib/strava/tokenManager';
import { syncActivitiesWithProgress } from '@/lib/strava/sync-service';

/**
 * Strava OAuth Callback Handler
 * Exchanges authorization code for tokens and stores them securely
 */

interface StravaAthleteData {
  id: number;
  email?: string;
  firstname?: string;
  lastname?: string;
  profile?: string;
  [key: string]: unknown;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Default redirect URL (must be defined outside try block for catch block access)
  let redirectAfterAuth = '/dashboard';

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateParam = searchParams.get('state');

    // Decode state to get redirect URL
    if (stateParam) {
      try {
        const stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
        if (stateData.redirect) {
          redirectAfterAuth = stateData.redirect;
        }
      } catch {
        // Invalid state format, use default
      }
    }

    // Handle OAuth errors from Strava
    if (error) {
      console.error('Strava OAuth error:', error);
      return NextResponse.redirect(
        new URL(
          `${redirectAfterAuth}?error=strava_auth_denied&message=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    // Validate authorization code
    if (!code) {
      console.error('No authorization code received from Strava');
      return NextResponse.redirect(
        new URL(`${redirectAfterAuth}?error=missing_code`, request.url)
      );
    }

    // Exchange code for tokens
    let tokenData;
    try {
      tokenData = await exchangeCodeForTokens(code);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Token exchange failed:', errorMessage);
      return NextResponse.redirect(
        new URL(
          `${redirectAfterAuth}?error=token_exchange_failed&message=${encodeURIComponent(errorMessage)}`,
          request.url
        )
      );
    }

    // Validate token response
    if (!tokenData.access_token || !tokenData.refresh_token || !tokenData.expires_at) {
      console.error('Invalid token response from Strava');
      return NextResponse.redirect(
        new URL(`${redirectAfterAuth}?error=invalid_token_response`, request.url)
      );
    }

    // Get or create athlete from Strava data
    const stravaAthleteId = tokenData.athlete?.id;
    if (!stravaAthleteId) {
      console.error('No athlete data in token response');
      return NextResponse.redirect(
        new URL(`${redirectAfterAuth}?error=no_athlete_data`, request.url)
      );
    }

    // Find existing athlete by Strava ID
    let athlete = await prisma.athlete.findUnique({
      where: { stravaId: BigInt(stravaAthleteId) },
    });

    // If athlete doesn't exist, create one from Strava data
    if (!athlete) {
      const athleteData = tokenData.athlete as StravaAthleteData | undefined;
      if (!athleteData) {
        console.error('No athlete data in token response');
        return NextResponse.redirect(
          new URL(`${redirectAfterAuth}?error=no_athlete_data`, request.url)
        );
      }
      athlete = await prisma.athlete.create({
        data: {
          stravaId: BigInt(stravaAthleteId),
          email: athleteData.email || `${stravaAthleteId}@strava.placeholder`,
          firstname: athleteData.firstname || 'Strava',
          lastname: athleteData.lastname || 'User',
          profileImage: athleteData.profile || null,
        },
      });
    }

    // Store tokens securely
    await storeTokens(athlete.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      expires_in: tokenData.expires_in,
    });

    // Sync activities from Strava (await with timeout to ensure data is available)
    try {
      console.log('[Strava Callback] Starting activity sync...');
      const syncResult = await Promise.race([
        syncActivitiesWithProgress(athlete.id, 30), // Sync last 30 activities
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sync timeout')), 10000) // 10 second timeout
        ),
      ]);
      console.log(`[Strava Callback] Sync completed: ${syncResult.imported} activities imported`);
    } catch (syncErr) {
      console.error('[Strava Callback] Sync error (continuing anyway):', syncErr);
      // Continue with redirect even if sync fails - activities will be loaded on demand
    }

    // Create session or set auth cookie (implementation depends on auth strategy)
    // For now, we'll create a simple session record
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
      data: {
        athleteId: athlete.id,
        name: 'Strava OAuth Session',
        scheduledDate: new Date(),
        completedDate: new Date(),
        status: 'completed',
        notes: sessionToken,
      },
    });

    // Build redirect URL
    const redirectUrl = new URL(redirectAfterAuth, request.url);
    redirectUrl.searchParams.set('success', 'strava_connected');

    console.log('[Strava Callback] Redirecting to:', redirectUrl.toString());
    console.log('[Strava Callback] Setting cookies - session_token:', sessionToken.substring(0, 8) + '...', 'athlete_id:', athlete.id);

    // Redirect to the original requested page or dashboard
    const response = NextResponse.redirect(redirectUrl);

    // Set session cookie
    response.cookies.set({
      name: 'session_token',
      value: sessionToken,
      httpOnly: true,
      secure: false, // Always false for localhost development
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    // Set athlete ID cookie (non-httpOnly for client-side use)
    response.cookies.set({
      name: 'athlete_id',
      value: athlete.id,
      httpOnly: false,
      secure: false, // Always false for localhost development
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    console.log('[Strava Callback] Cookies set, returning response');

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error in Strava callback:', errorMessage);
    return NextResponse.redirect(
      new URL(
        `${redirectAfterAuth}?error=unexpected&message=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }
}
