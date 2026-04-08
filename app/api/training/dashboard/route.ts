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
    return NextResponse.json({ error: 'Failed to load training dashboard' }, { status: 500 });
  }
}
