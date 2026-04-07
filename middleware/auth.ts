import { NextRequest, NextResponse } from 'next/server';

/**
 * Authentication Middleware (Edge Runtime compatible)
 * Protects routes that require authentication
 * NOTE: Does NOT use Prisma or database calls - only checks cookies
 * Database validation happens in API routes/pages
 */

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/api/protected', '/api/strava/data'];

// Routes that are part of the OAuth flow
const AUTH_ROUTES = ['/api/auth/strava/callback', '/api/strava/connect', '/login'];

/**
 * Checks if a URL path matches any of the protected route patterns
 */
function isProtectedRoute(path: string): boolean {
  return PROTECTED_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

/**
 * Checks if a URL path is part of the authentication flow
 */
function isAuthRoute(path: string): boolean {
  return AUTH_ROUTES.some((route) => path === route || path.startsWith(route));
}

/**
 * Validates session from cookies (basic check only)
 * Full validation happens in API routes/pages
 */
function validateSession(request: NextRequest): string | null {
  const sessionToken = request.cookies.get('session_token')?.value;
  const athleteId = request.cookies.get('athlete_id')?.value;

  if (!sessionToken || !athleteId) {
    return null;
  }

  // Basic validation - full DB validation happens in API routes/pages
  return athleteId;
}

/**
 * Middleware function to handle authentication
 */
export async function authMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Skip auth routes (OAuth flow)
  if (isAuthRoute(pathname)) {
    return null;
  }

  // Check if route requires authentication
  if (!isProtectedRoute(pathname)) {
    return null;
  }

  // Validate session (basic cookie check only)
  const athleteId = validateSession(request);

  if (!athleteId) {
    // No valid session, redirect to login/connect page
    if (pathname.startsWith('/api/')) {
      // API routes return 401
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid session required' },
        { status: 401 }
      );
    }

    // Page routes redirect to login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Add athlete ID to headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-athlete-id', athleteId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Simplified middleware for use in middleware.ts
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const result = await authMiddleware(request);
  return result || NextResponse.next();
}

/**
 * Configuration for Next.js middleware
 */
export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*', '/api/strava/data/:path*'],
};
