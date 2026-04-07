const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/training_program?schema=public',
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    // Verificar conexiones Strava
    const connections = await prisma.stravaConnection.findMany();
    console.log('Conexiones Strava:', connections.map(c => ({
      athleteId: c.athleteId,
      expiresAt: c.expiresAt,
      hasAccessToken: !!c.encryptedAccessToken,
      hasRefreshToken: !!c.encryptedRefreshToken,
    })));

    // Verificar atleta Nacki Paquete
    const nacki = await prisma.athlete.findFirst({
      where: { email: '151237454@strava.placeholder' },
      include: { activities: true }
    });
    console.log('\nAtleta Nacki:', nacki ? {
      id: nacki.id,
      email: nacki.email,
      activitiesCount: nacki.activities.length,
      activities: nacki.activities.map(a => ({ name: a.name, distance: a.distance, date: a.startDate }))
    } : 'No encontrado');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
