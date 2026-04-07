import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * GET /api/auth/strava/status
 * Devuelve el estado de conexión con Strava para el usuario actual
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Obtener athlete ID de la cookie
    const athleteId = request.cookies.get('athlete_id')?.value;

    if (!athleteId) {
      return NextResponse.json({
        isConnected: false,
        athleteName: null,
        lastSync: null,
      });
    }

    // Buscar conexión de Strava
    const connection = await prisma.stravaConnection.findUnique({
      where: { athleteId },
      include: {
        athlete: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    if (!connection) {
      return NextResponse.json({
        isConnected: false,
        athleteName: null,
        lastSync: null,
      });
    }

    // Verificar si el token está vigente
    const now = new Date();
    const expiresAt = connection.expiresAt;
    const isTokenValid = expiresAt > now;

    // Construir nombre completo del atleta
    const athleteName = connection.athlete
      ? `${connection.athlete.firstname} ${connection.athlete.lastname}`.trim()
      : null;

    return NextResponse.json({
      isConnected: isTokenValid,
      athleteName,
      lastSync: connection.updatedAt.toISOString(),
      expiresAt: connection.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error checking Strava connection status:', error);
    return NextResponse.json({ error: 'Error al verificar estado de conexión' }, { status: 500 });
  }
}
