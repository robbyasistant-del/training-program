require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function safe(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v));
}

(async () => {
  try {
    const athletes = await prisma.athlete.findMany({
      select: { id: true, firstname: true, lastname: true, stravaId: true, lastSyncAt: true, syncStatus: true },
    });
    const connections = await prisma.stravaConnection.findMany({
      select: { athleteId: true, expiresAt: true, updatedAt: true },
    });
    const records = await prisma.athleteRecord.findMany({
      select: { athleteId: true, totalActivities: true, totalDistance: true, power20m: true, pr20km: true },
    });
    console.log(JSON.stringify(safe({ athletes, connections, records }), null, 2));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();
