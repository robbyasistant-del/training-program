import { NextRequest, NextResponse } from 'next/server';
import { 
  startFullSync, 
  getSyncState, 
  needsSync 
} from '@/lib/sync/central-sync-service';

/**
 * POST /api/sync/start
 * Inicia una sincronización completa del atleta
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    if (!athleteId) {
      return NextResponse.json(
        { error: 'Se requiere athleteId' },
        { status: 400 }
      );
    }

    // Iniciar sincronización en background
    startFullSync(athleteId).catch((error) => {
      console.error('[Sync API] Error during sync:', error);
    });

    // Devolver estado inicial inmediatamente
    const state = getSyncState(athleteId);
    
    return NextResponse.json({
      success: true,
      message: 'Sincronización iniciada',
      state,
    });

  } catch (error) {
    console.error('[Sync API] Error starting sync:', error);
    return NextResponse.json(
      { error: 'Error al iniciar sincronización' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/start
 * Obtiene el estado actual de sincronización y si se necesita
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    if (!athleteId) {
      return NextResponse.json(
        { error: 'Se requiere athleteId' },
        { status: 400 }
      );
    }

    // Verificar si necesita sincronización
    const syncCheck = await needsSync(athleteId);
    
    // Obtener estado actual
    const state = getSyncState(athleteId);

    return NextResponse.json({
      needsSync: syncCheck.needsSync,
      reason: syncCheck.reason,
      state,
    });

  } catch (error) {
    console.error('[Sync API] Error checking sync status:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
