import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const count = await prisma.athleteRecord.count();
    const uniqueAthletes = await prisma.athleteRecord.groupBy({
      by: ['athleteId'],
      _count: { athleteId: true }
    });
    
    const records = await prisma.athleteRecord.findMany({
      select: { athleteId: true, estimatedFTP: true, ftpMethod: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    });
    
    return NextResponse.json({
      totalRecords: count,
      uniqueAthletes: uniqueAthletes.length,
      athleteIds: uniqueAthletes.map(a => a.athleteId),
      records: records
    });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}