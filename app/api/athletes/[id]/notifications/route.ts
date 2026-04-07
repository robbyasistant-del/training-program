/**
 * GET /api/athletes/[id]/notifications
 * POST /api/athletes/[id]/notifications (mark as seen)
 * PR Notifications API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUnreadPRNotifications, markNotificationsAsSeen } from '@/lib/personalRecords';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET - Get unread PR notifications for an athlete
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: athleteId } = await params;

    if (!athleteId) {
      return NextResponse.json({ error: 'Athlete ID is required' }, { status: 400 });
    }

    // Verify athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Get unread notifications
    const notifications = await getUnreadPRNotifications(athleteId);

    return NextResponse.json({
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('[GET /api/athletes/[id]/notifications] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Mark notifications as seen
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: athleteId } = await params;
    const body = await request.json();
    const { notificationIds } = body;

    if (!athleteId) {
      return NextResponse.json({ error: 'Athlete ID is required' }, { status: 400 });
    }

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: 'notificationIds array is required' }, { status: 400 });
    }

    // Verify athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Mark notifications as seen
    await markNotificationsAsSeen(notificationIds);

    return NextResponse.json({
      success: true,
      markedCount: notificationIds.length,
    });
  } catch (error) {
    console.error('[POST /api/athletes/[id]/notifications] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
