import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Helper: format date as YYYY-MM-DD
function formatDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

    // Parse the input date string (YYYY-MM-DD) to UTC midnight
    const [year, month, day] = dayDate.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const targetDateStr = formatDateStr(targetDate);
    
    console.log('[POST /api/training/days] Target date:', targetDateStr);

    // Find ALL days for this athlete and filter by date string match
    const allAthleteDays = await prisma.weeklyTrainingDay.findMany({
      where: {
        plan: { athleteId },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }, // Most recent first
    });
    
    // Find days that match the target date (by string comparison)
    const matchingDays = allAthleteDays.filter(d => {
      const dStr = formatDateStr(d.dayDate);
      return dStr === targetDateStr;
    });
    
    console.log('[POST /api/training/days] Found', matchingDays.length, 'matching days for', targetDateStr);

    // Calculate week start for the target date
    const dayOfWeek = targetDate.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(Date.UTC(year, month - 1, day + diffToMonday));

    let savedDay;
    
    if (matchingDays.length > 0) {
      // Use the most recent matching day
      const existingDay = matchingDays[0];
      console.log('[POST /api/training/days] Updating existing day:', existingDay.id);
      
      savedDay = await prisma.weeklyTrainingDay.update({
        where: { id: existingDay.id },
        data: {
          title: title !== undefined && title !== '' ? title : existingDay.title,
          description: description !== undefined ? description : existingDay.description,
          targetIF: targetIF !== undefined ? targetIF : existingDay.targetIF,
          targetTSS: targetTSS !== undefined ? targetTSS : existingDay.targetTSS,
          plannedDurationMin: plannedDurationMin !== undefined ? plannedDurationMin : existingDay.plannedDurationMin,
          workoutType: workoutType !== undefined ? workoutType : existingDay.workoutType,
        },
      });
      console.log('[POST /api/training/days] Updated:', savedDay.id, savedDay.title);
      
      // Clean up duplicates if any
      if (matchingDays.length > 1) {
        const duplicateIds = matchingDays.slice(1).map(d => d.id);
        console.log('[POST /api/training/days] Cleaning up duplicates:', duplicateIds);
        await prisma.weeklyTrainingDay.deleteMany({
          where: { id: { in: duplicateIds } },
        });
      }
    } else {
      // Create new - first find or create the plan
      let plan = await prisma.weeklyTrainingPlan.findFirst({
        where: {
          athleteId,
          weekStart: {
            gte: new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() - 1)),
            lt: new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 1)),
          },
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
        console.log('[POST /api/training/days] Created new plan:', plan.id);
      }

      const weekday = targetDate.getUTCDay() === 0 ? 7 : targetDate.getUTCDay();
      savedDay = await prisma.weeklyTrainingDay.create({
        data: {
          planId: plan.id,
          dayDate: targetDate,
          weekday,
          title: title || 'Descanso',
          description,
          targetIF,
          targetTSS,
          plannedDurationMin,
          workoutType,
        },
      });
      console.log('[POST /api/training/days] Created new day:', savedDay.id, savedDay.title);
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
