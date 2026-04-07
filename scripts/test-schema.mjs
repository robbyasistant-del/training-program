import dotenv from 'dotenv';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function testSchema() {
  try {
    console.log('🔍 Testing database schema...\n');

    // Count athletes
    const athleteCount = await db.athlete.count();
    console.log(`✅ Athletes in database: ${athleteCount}`);

    // Count activities
    const activityCount = await db.activity.count();
    console.log(`✅ Activities in database: ${activityCount}`);

    // Get athletes with their activities
    const athletes = await db.athlete.findMany({
      include: {
        activities: true,
      },
    });

    console.log('\n📊 Athletes and their activities:');
    athletes.forEach((athlete) => {
      console.log(`\n  ${athlete.firstname} ${athlete.lastname} (${athlete.email})`);
      console.log(`  Strava ID: ${athlete.stravaId}`);
      console.log(`  Activities: ${athlete.activities.length}`);
      athlete.activities.forEach((act) => {
        console.log(
          `    - ${act.name} (${act.type}): ${act.distance ? (act.distance / 1000).toFixed(2) + 'km' : 'N/A'}`
        );
      });
    });

    // Test enum values
    const activityTypes = await db.$queryRaw`
      SELECT unnest(enum_range(NULL::"ActivityType")) as type
    `;
    console.log('\n📋 ActivityType enum values:');
    activityTypes.forEach((t) => console.log(`  - ${t.type}`));

    // Test indexes
    const indexes = await db.$queryRaw`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('Athlete', 'Activity') AND schemaname = 'public'
      ORDER BY tablename, indexname
    `;
    console.log('\n📇 Indexes on Athlete and Activity tables:');
    indexes.forEach((idx) => console.log(`  - ${idx.indexname}`));

    console.log('\n✅ Schema test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

testSchema();
