import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/strava/connect
 * Initiates the Strava OAuth flow by redirecting to Strava authorization URL
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;

    if (!STRAVA_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Configuration error', message: 'Strava client ID not configured' },
        { status: 500 }
      );
    }

    // Get redirect URL from request body
    let redirectAfterAuth = '/dashboard';
    try {
      const body = await request.json();
      if (body.redirectUrl) {
        redirectAfterAuth = body.redirectUrl;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Get the base URL for callbacks
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:4004';
    const redirectUri = `${baseUrl}/api/auth/strava/callback`;

    // Define OAuth scopes
    // read: access to read public data
    // activity:read: access to read activity data
    // activity:read_all: access to read all activity data (including private)
    const scope = 'read,activity:read';

    // Generate state parameter with CSRF token and redirect URL
    const csrfToken = crypto.randomUUID();
    const stateData = { csrf: csrfToken, redirect: redirectAfterAuth };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Build authorization URL
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('approval_prompt', 'auto'); // 'auto' or 'force'

    // Store state in cookie for validation on callback (optional but recommended)
    const response = NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
    });

    // Set state cookie for CSRF protection
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error initiating Strava OAuth:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/strava/connect
 * Alternative method that redirects directly to Strava
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;

    if (!STRAVA_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Configuration error', message: 'Strava client ID not configured' },
        { status: 500 }
      );
    }

    // Get the base URL for callbacks
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:4004';
    const redirectUri = `${baseUrl}/api/auth/strava/callback`;

    // Define OAuth scopes
    const scope = 'read,activity:read';

    // Generate state parameter for CSRF protection
    const state = Buffer.from(`${Date.now()}-${crypto.randomUUID()}`).toString('base64url');

    // Build authorization URL
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('approval_prompt', 'auto');

    // Redirect directly to Strava
    const response = NextResponse.redirect(authUrl);

    // Set state cookie for CSRF protection
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error initiating Strava OAuth:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth', message: errorMessage },
      { status: 500 }
    );
  }
}
