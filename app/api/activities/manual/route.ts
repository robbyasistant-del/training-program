import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityType, Prisma } from '@prisma/client';

// POST /api/activities/manual - Create a manual activity
export async function POST(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      name,
      type = 'RIDE',
      startDate,
      distance, // in km
      movingTime, // in minutes
      totalElevationGain, // in meters
      averagePower,
      maxPower,
      normalizedPower,
      tss,
      ifValue,
      description,
    } = body;

    if (!name || !startDate) {
      return NextResponse.json({ error: 'Name and date required' }, { status: 400 });
    }

    // Generate a unique negative ID for manual activities
    // Negative IDs indicate manual activities (Strava uses positive IDs)
    const manualActivityId = BigInt(-Date.now());

    const activity = await prisma.activity.create({
      data: {
        athlete: { connect: { id: athleteId } },
        stravaActivityId: manualActivityId,
        name,
        type: type as ActivityType,
        source: 'MANUAL',
        startDate: new Date(startDate),
        distance: distance ? distance * 1000 : null, // Convert km to meters
        movingTime: movingTime ? movingTime * 60 : null, // Convert minutes to seconds
        elapsedTime: movingTime ? movingTime * 60 : null,
        totalElevationGain: totalElevationGain || null,
        averagePower: averagePower || null,
        maxPower: maxPower || null,
        normalizedPower: normalizedPower || null,
        tss: tss || null,
        ifValue: ifValue || null,
        description: description || null,
        averageSpeed: null,
        maxSpeed: null,
        averageHeartrate: null,
        maxHeartrate: null,
        rawJson: Prisma.JsonNull,
      },
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Manual activity POST error:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

// GET /api/activities/manual - Get manual activities
export async function GET(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    const where: any = {
      athleteId,
      source: 'MANUAL',
    };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      where.startDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Manual activities GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}
