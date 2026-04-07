import { db } from '../lib/db.js';

async function testConnection() {
  try {
    // Test query
    const result = await db.$queryRaw`SELECT version()`;
    console.log('✅ Conexión exitosa a PostgreSQL');
    console.log('Versión:', result);

    // Count tables
    const tables = await db.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('\n📊 Tablas en la base de datos:');
    console.log(tables);

    // Test models
    const athleteCount = await db.athlete.count();
    const activityCount = await db.activity.count();
    const programCount = await db.trainingProgram.count();

    console.log('\n📈 Conteo de registros:');
    console.log(`- Athletes: ${athleteCount}`);
    console.log(`- Activities: ${activityCount}`);
    console.log(`- Training Programs: ${programCount}`);

    console.log('\n✅ Prisma ORM configurado correctamente');
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

testConnection();
