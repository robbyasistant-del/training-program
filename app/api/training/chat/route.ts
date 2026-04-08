import { NextRequest, NextResponse } from 'next/server';
import { appendTrainerMessage, ensureTrainingMvpData } from '@/lib/training/service';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation } = await ensureTrainingMvpData(athleteId);
    const messages = await prisma.trainingMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ conversationId: conversation.id, messages });
  } catch (error) {
    console.error('Training chat GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const athleteId = request.cookies.get('athlete_id')?.value;
    if (!athleteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    await appendTrainerMessage(athleteId, body.message.trim());
    const { conversation } = await ensureTrainingMvpData(athleteId);
    const messages = await prisma.trainingMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ conversationId: conversation.id, messages });
  } catch (error) {
    console.error('Training chat POST error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
