// Test script for Prisma connection
import dotenv from 'dotenv';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function testConnection() {
  try {
    // Test raw query
    const result = await db.$queryRaw`SELECT version()`;
    console.log('✅ Conexión exitosa a PostgreSQL');
    console.log('Versión:', result[0].version);

    // Count tables
    const tables = await db.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('\n📊 Tablas en la base de datos:');
    tables.forEach((t) => console.log(`  - ${t.table_name}`));

    // Test models
    const athleteCount = await db.athlete.count();
    const activityCount = await db.activity.count();
    const programCount = await db.trainingProgram.count();
    const sessionCount = await db.session.count();
    const goalCount = await db.goal.count();

    console.log('\n📈 Conteo de registros:');
    console.log(`  - Athletes: ${athleteCount}`);
    console.log(`  - Activities: ${activityCount}`);
    console.log(`  - Training Programs: ${programCount}`);
    console.log(`  - Sessions: ${sessionCount}`);
    console.log(`  - Goals: ${goalCount}`);

    console.log('\n✅ Prisma ORM configurado correctamente con PostgreSQL');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

testConnection();
