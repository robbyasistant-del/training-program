import { NextRequest, NextResponse } from 'next/server';

import { disconnectStrava } from '@/lib/strava/tokenManager';

/**
 * POST /api/strava/disconnect
 * Disconnects the user's Strava account by deleting stored tokens
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get athlete ID from cookie/session
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No active session found' },
        { status: 401 }
      );
    }

    // Disconnect Strava
    await disconnectStrava(athleteId);

    // Clear session cookies
    const response = NextResponse.json({
      success: true,
      message: 'Strava account disconnected successfully',
    });

    // Clear cookies
    response.cookies.delete('session_token');
    response.cookies.delete('athlete_id');
    response.cookies.delete('oauth_state');

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error disconnecting Strava:', errorMessage);

    // Handle specific error cases
    if (errorMessage.includes('No Strava connection found')) {
      return NextResponse.json(
        { error: 'Not connected', message: 'No Strava connection exists for this user' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Disconnect failed', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/strava/disconnect
 * Alternative method for disconnecting (RESTful)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
