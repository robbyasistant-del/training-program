const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.athleteRecord.count();
    console.log('Total AthleteRecords:', count);
    
    const uniqueAthletes = await prisma.athleteRecord.groupBy({
      by: ['athleteId'],
      _count: { athleteId: true }
    });
    console.log('Unique athleteIds:', uniqueAthletes.length);
    console.log('Athlete IDs:', uniqueAthletes.map(a => a.athleteId));
    
    const records = await prisma.athleteRecord.findMany({
      select: { athleteId: true, estimatedFTP: true, ftpMethod: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    });
    console.log('\nRecords:');
    records.forEach(r => console.log('  -', r.athleteId, '| FTP:', r.estimatedFTP, '| Method:', r.ftpMethod, '| Updated:', r.updatedAt));
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
