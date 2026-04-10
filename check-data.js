require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkData() {
  try {
    // Obtener el atleta
    const athlete = await prisma.athlete.findFirst();
    
    if (!athlete) {
      console.log('No hay atletas en la BD');
      return;
    }
    
    console.log('=== ATLETA ===');
    console.log(`ID: ${athlete.id}`);
    console.log(`Nombre: ${athlete.firstname} ${athlete.lastname}`);
    console.log(`Strava ID: ${athlete.stravaId}`);
    console.log(`Peso: ${athlete.weight} kg`);
    console.log(`Última sincronización: ${athlete.lastSyncAt}`);
    
    // Verificar AthleteRecord
    const record = await prisma.athleteRecord.findUnique({
      where: { athleteId: athlete.id },
    });
    
    console.log('\n=== ATHLETE RECORD ===');
    if (record) {
      console.log('Registro encontrado:');
      console.log(`  FTP: ${record.estimatedFTP} W (${record.ftpMethod})`);
      console.log(`  Distancias:`, {
        '5km': record.pr5km,
        '10km': record.pr10km,
        '20km': record.pr20km,
        '30km': record.pr30km,
        '50km': record.pr50km,
        '75km': record.pr75km,
        '90km': record.pr90km,
        '100km': record.pr100km,
      });
      console.log(`  Potencias:`, {
        '5s': record.power5s,
        '15s': record.power15s,
        '1m': record.power1m,
        '5m': record.power5m,
        '20m': record.power20m,
        '1h': record.power1h,
      });
      console.log(`  Totales: ${record.totalActivities} act, ${(record.totalDistance / 1000).toFixed(1)} km`);
    } else {
      console.log('NO HAY AthleteRecord - Necesita sincronizar');
    }
    
    // Verificar actividades
    const activities = await prisma.activity.findMany({
      where: { athleteId: athlete.id },
      take: 5,
      orderBy: { startDate: 'desc' },
    });
    
    console.log('\n=== ACTIVIDADES (últimas 5) ===');
    console.log(`Total de actividades: ${await prisma.activity.count({ where: { athleteId: athlete.id } })}`);
    
    activities.forEach((a, i) => {
      console.log(`\n${i + 1}. ${a.name}`);
      console.log(`   Tipo: ${a.type}`);
      console.log(`   Distancia: ${(a.distance / 1000).toFixed(2)} km`);
      console.log(`   Tiempo: ${Math.floor(a.movingTime / 60)} min`);
      console.log(`   Potencia avg: ${a.averagePower || 'N/A'} W`);
      console.log(`   Potencia max: ${a.maxPower || 'N/A'} W`);
    });
    
    // Actividades con potencia
    const activitiesWithPower = await prisma.activity.count({
      where: { 
        athleteId: athlete.id,
        averagePower: { not: null },
      },
    });
    
    console.log(`\n=== ACTIVIDADES CON POTENCIA ===`);
    console.log(`${activitiesWithPower} actividades tienen datos de potencia`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkData();
