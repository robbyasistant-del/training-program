import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityType } from '@prisma/client';

// PATCH /api/activities/manual/[id] - Update a manual activity
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const body = await request.json();
    const {
      name,
      type,
      startDate,
      distance,
      movingTime,
      totalElevationGain,
      averagePower,
      maxPower,
      normalizedPower,
      tss,
      ifValue,
      description,
    } = body;

    // Verify activity exists and belongs to athlete and is MANUAL
    const existing = await prisma.activity.findFirst({
      where: {
        id,
        athleteId,
        source: 'MANUAL',
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type as ActivityType;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (distance !== undefined) updateData.distance = distance ? distance * 1000 : null;
    if (movingTime !== undefined) {
      updateData.movingTime = movingTime ? movingTime * 60 : null;
      updateData.elapsedTime = movingTime ? movingTime * 60 : null;
    }
    if (totalElevationGain !== undefined) updateData.totalElevationGain = totalElevationGain || null;
    if (averagePower !== undefined) updateData.averagePower = averagePower || null;
    if (maxPower !== undefined) updateData.maxPower = maxPower || null;
    if (normalizedPower !== undefined) updateData.normalizedPower = normalizedPower || null;
    if (tss !== undefined) updateData.tss = tss || null;
    if (ifValue !== undefined) updateData.ifValue = ifValue || null;
    if (description !== undefined) updateData.description = description || null;

    const activity = await prisma.activity.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Manual activity PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

// DELETE /api/activities/manual/[id] - Delete a manual activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;

    // Verify activity exists and belongs to athlete and is MANUAL
    const existing = await prisma.activity.findFirst({
      where: {
        id,
        athleteId,
        source: 'MANUAL',
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    await prisma.activity.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual activity DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}

// GET /api/activities/manual/[id] - Get a single manual activity
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        athleteId,
        source: 'MANUAL',
      },
    });

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Manual activity GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
