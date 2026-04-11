import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/training/days?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'Date required' }, { status: 400 });
    }

    const day = await prisma.weeklyTrainingDay.findFirst({
      where: {
        dayDate: new Date(date),
        plan: {
          athleteId,
        },
      },
      include: {
        plan: true,
      },
    });

    return NextResponse.json(day);
  } catch (error) {
    console.error('Training days GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch day' }, { status: 500 });
  }
}

// POST /api/training/days - Create or update a day
export async function POST(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { dayDate, title, description, targetIF, targetTSS, plannedDurationMin, workoutType } = body;

    if (!dayDate) {
      return NextResponse.json({ error: 'Date required' }, { status: 400 });
    }

    // Find or create the weekly plan for this date
    const date = new Date(dayDate);
    const dayOfWeek = date.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    let plan = await prisma.weeklyTrainingPlan.findFirst({
      where: {
        athleteId,
        weekStart,
      },
    });

    if (!plan) {
      plan = await prisma.weeklyTrainingPlan.create({
        data: {
          athleteId,
          weekStart,
          title: `Semana del ${weekStart.toLocaleDateString('es-ES')}`,
          focus: '',
        },
      });
    }

    // Check if day already exists
    const existingDay = await prisma.weeklyTrainingDay.findFirst({
      where: {
        planId: plan.id,
        dayDate: date,
      },
    });

    let day;
    if (existingDay) {
      day = await prisma.weeklyTrainingDay.update({
        where: { id: existingDay.id },
        data: {
          title: title || existingDay.title,
          description: description !== undefined ? description : existingDay.description,
          targetIF: targetIF !== undefined ? targetIF : existingDay.targetIF,
          targetTSS: targetTSS !== undefined ? targetTSS : existingDay.targetTSS,
          plannedDurationMin: plannedDurationMin !== undefined ? plannedDurationMin : existingDay.plannedDurationMin,
          workoutType: workoutType !== undefined ? workoutType : existingDay.workoutType,
        },
      });
    } else {
      const weekday = date.getDay() === 0 ? 7 : date.getDay();
      day = await prisma.weeklyTrainingDay.create({
        data: {
          planId: plan.id,
          dayDate: date,
          weekday,
          title: title || 'Descanso',
          description,
          targetIF,
          targetTSS,
          plannedDurationMin,
          workoutType,
        },
      });
    }

    return NextResponse.json(day);
  } catch (error) {
    console.error('Training days POST error:', error);
    return NextResponse.json({ error: 'Failed to save day' }, { status: 500 });
  }
}

// DELETE /api/training/days?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Day id required' }, { status: 400 });
    }

    // Verify the day belongs to the athlete
    const day = await prisma.weeklyTrainingDay.findFirst({
      where: {
        id,
        plan: {
          athleteId,
        },
      },
    });

    if (!day) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    await prisma.weeklyTrainingDay.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Training days DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete day' }, { status: 500 });
  }
}
