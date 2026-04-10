require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  const athleteId = '7338980d-5cba-4cd1-a739-41f2b2fd69dd';
  try {
    const counts = {
      all: await prisma.activity.count({ where: { athleteId } }),
      cycling: await prisma.activity.count({ where: { athleteId, type: { in: ['RIDE','VIRTUAL_RIDE'] } } }),
      withPower: await prisma.activity.count({ where: { athleteId, type: { in: ['RIDE','VIRTUAL_RIDE'] }, averagePower: { not: null } } }),
    };
    const samples = await prisma.activity.findMany({
      where: { athleteId, type: { in: ['RIDE','VIRTUAL_RIDE'] } },
      select: { name: true, type: true, distance: true, movingTime: true, averagePower: true, maxPower: true, startDate: true },
      orderBy: { startDate: 'desc' },
      take: 10,
    });
    console.log(JSON.stringify({ counts, samples }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})().catch(async e => { console.error(e); await prisma.$disconnect(); await pool.end(); process.exit(1); });
