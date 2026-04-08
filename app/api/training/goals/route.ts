import { NextRequest, NextResponse } from 'next/server';
import { createTrainingGoal, ensureTrainingMvpData } from '@/lib/training/service';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await ensureTrainingMvpData(athleteId);
    const goals = await prisma.trainingGoal.findMany({ where: { athleteId }, orderBy: { eventDate: 'asc' } });
    return NextResponse.json(goals);
  } catch (error) {
    console.error('Training goals GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const goal = await createTrainingGoal(athleteId, body);
    return NextResponse.json(goal);
  } catch (error) {
    console.error('Training goals POST error:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
