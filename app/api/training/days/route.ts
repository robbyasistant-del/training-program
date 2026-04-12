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

    // DEBUG LOGGING
    console.log('[POST /api/training/days] Received dayDate:', dayDate);

    // Find or create the weekly plan for this date
    // Parse date string correctly as UTC midnight to avoid timezone shifts
    const [year, month, day] = dayDate.split('-').map(Number);
    // Create UTC date: YYYY-MM-DD 00:00:00 UTC
    const date = new Date(Date.UTC(year, month - 1, day));
    
    console.log('[POST /api/training/days] Parsed date (UTC):', date.toISOString());
    
    const dayOfWeek = date.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(Date.UTC(year, month - 1, day + diffToMonday));
    
    console.log('[POST /api/training/days] Calculated weekStart (UTC):', weekStart.toISOString());

    let plan = await prisma.weeklyTrainingPlan.findFirst({
      where: {
        athleteId,
        weekStart: {
          gte: new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() - 2)),
          lt: new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 2)),
        },
      },
    });
    
    console.log('[POST /api/training/days] Searching for plan with weekStart around:', weekStart.toISOString());
    console.log('[POST /api/training/days] Found plan:', plan ? `${plan.id} (weekStart: ${plan.weekStart})` : 'none');

    if (!plan) {
      plan = await prisma.weeklyTrainingPlan.create({
        data: {
          athleteId,
          weekStart,
          title: `Semana del ${weekStart.toLocaleDateString('es-ES')}`,
          focus: '',
        },
      });
      console.log('[POST /api/training/days] Created new plan:', plan.id, 'weekStart:', plan.weekStart);
    } else {
      console.log('[POST /api/training/days] Found existing plan:', plan.id, 'weekStart:', plan.weekStart);
    }

    // Check if day already exists anywhere for this athlete (search in ±1 day range)
    const existingDay = await prisma.weeklyTrainingDay.findFirst({
      where: {
        dayDate: {
          gte: new Date(Date.UTC(year, month - 1, day - 1)),
          lt: new Date(Date.UTC(year, month - 1, day + 1)),
        },
        plan: { athleteId },
      },
    });
    
    console.log('[POST /api/training/days] Searching for day with date around:', date.toISOString());
    console.log('[POST /api/training/days] Existing day:', existingDay ? `${existingDay.id} (dayDate: ${existingDay.dayDate}, plan: ${existingDay.planId})` : 'none');
    
    console.log('[POST /api/training/days] Existing day:', existingDay ? existingDay.id : 'none');

    let savedDay;
    if (existingDay) {
      // Use the existing day and update it
      savedDay = await prisma.weeklyTrainingDay.update({
        where: { id: existingDay.id },
        data: {
          title: title !== undefined ? title : existingDay.title,
          description: description !== undefined ? description : existingDay.description,
          targetIF: targetIF !== undefined ? targetIF : existingDay.targetIF,
          targetTSS: targetTSS !== undefined ? targetTSS : existingDay.targetTSS,
          plannedDurationMin: plannedDurationMin !== undefined ? plannedDurationMin : existingDay.plannedDurationMin,
          workoutType: workoutType !== undefined ? workoutType : existingDay.workoutType,
        },
      });
      console.log('[POST /api/training/days] Updated day:', savedDay.id, 'title:', savedDay.title, 'dayDate:', savedDay.dayDate, 'plan:', savedDay.planId);
    } else {
    } else {
      const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
      savedDay = await prisma.weeklyTrainingDay.create({
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
      console.log('[POST /api/training/days] Created day:', savedDay.id, 'title:', savedDay.title, 'dayDate:', savedDay.dayDate);
    }

    return NextResponse.json(savedDay);
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
