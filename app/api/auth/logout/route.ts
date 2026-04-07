import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * POST /api/auth/logout
 * Cierra la sesión del usuario eliminando cookies y invalidando tokens
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Obtener athlete ID de la cookie
    const athleteId = request.cookies.get('athlete_id')?.value;
    const sessionToken = request.cookies.get('session_token')?.value;

    // Verificar si hay sesión activa
    if (!athleteId || !sessionToken) {
      return NextResponse.json({ success: false, error: 'No active session' }, { status: 401 });
    }

    // Eliminar conexión de Strava de la base de datos (logout local)
    // Nota: No llamamos a Strava para revocar tokens, solo limpiamos localmente
    try {
      await prisma.stravaConnection.deleteMany({
        where: { athleteId },
      });
    } catch (dbError) {
      // Si no existe la conexión, continuamos igual (logout idempotente)
      console.error('Error deleting Strava connection:', dbError);
    }

    // Eliminar sesiones del usuario
    try {
      await prisma.session.deleteMany({
        where: { athleteId },
      });
    } catch (dbError) {
      console.error('Error deleting sessions:', dbError);
    }

    // Preparar respuesta exitosa
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Eliminar cookies de sesión
    response.cookies.delete('session_token');
    response.cookies.delete('athlete_id');
    response.cookies.delete('oauth_state');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/logout
 * Alias para POST (RESTful)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
