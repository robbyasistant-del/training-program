import { NextRequest, NextResponse } from 'next/server';
import { getTrainingDashboardData } from '@/lib/training/service';

export async function GET(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await getTrainingDashboardData(athleteId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Training dashboard error:', error);
    
    // Handle athlete not found - clear invalid cookies and redirect to login
    if ((error as any)?.code === 'ATHLETE_NOT_FOUND') {
      const response = NextResponse.json({ error: 'Athlete not found. Please login again.' }, { status: 401 });
      // Clear invalid cookies
      response.cookies.set({ name: 'athlete_id', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'session_token', value: '', maxAge: 0, path: '/' });
      return response;
    }
    
    return NextResponse.json({ error: 'Failed to load training dashboard' }, { status: 500 });
  }
}
