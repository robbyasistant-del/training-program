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

export async function PATCH(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'Goal id required' }, { status: 400 });

    const existing = await prisma.trainingGoal.findFirst({ where: { id: body.id, athleteId } });
    if (!existing) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    const updated = await prisma.trainingGoal.update({
      where: { id: body.id },
      data: {
        title: body.title,
        eventDate: new Date(body.eventDate),
        distanceKm: Number(body.distanceKm),
        elevationM: body.elevationM ? Number(body.elevationM) : null,
        objective: body.objective,
        status: body.status || 'planned',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Training goals PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Goal id required' }, { status: 400 });

    const deleted = await prisma.trainingGoal.deleteMany({ where: { id, athleteId } });
    if (deleted.count === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Training goals DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
