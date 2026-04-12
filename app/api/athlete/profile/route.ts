import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/athlete/profile
 * Actualiza los datos del perfil del atleta (peso, fecha de nacimiento)
 */
export async function PATCH(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    
    if (!athleteId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { weight, birthdate } = body;

    const updatedAthlete = await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        weight: weight !== undefined ? weight : undefined,
        birthdate: birthdate !== undefined ? (birthdate ? new Date(birthdate) : null) : undefined,
      },
    });

    return NextResponse.json(updatedAthlete);
  } catch (error) {
    console.error('Error updating athlete profile:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el perfil' },
      { status: 500 }
    );
  }
}
