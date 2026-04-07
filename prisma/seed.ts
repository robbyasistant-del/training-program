import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ActivityType } from '@prisma/client';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log('🌱 Starting database seed...');

  // Create athletes
  const athlete1 = await prisma.athlete.create({
    data: {
      stravaId: 12345678n,
      email: 'john.doe@example.com',
      firstname: 'John',
      lastname: 'Doe',
      profileImage: 'https://example.com/avatar1.jpg',
    },
  });

  const athlete2 = await prisma.athlete.create({
    data: {
      stravaId: 87654321n,
      email: 'jane.smith@example.com',
      firstname: 'Jane',
      lastname: 'Smith',
      profileImage: 'https://example.com/avatar2.jpg',
    },
  });

  const athlete3 = await prisma.athlete.create({
    data: {
      stravaId: 11223344n,
      email: 'mike.johnson@example.com',
      firstname: 'Mike',
      lastname: 'Johnson',
    },
  });

  console.log(`✅ Created ${3} athletes`);

  // Create activities for athlete 1
  const activities1 = [
    {
      stravaActivityId: 10000000001n,
      athleteId: athlete1.id,
      type: ActivityType.RUN,
      name: 'Morning Run',
      distance: 5200.5,
      movingTime: 1800,
      elapsedTime: 1900,
      totalElevationGain: 45.2,
      startDate: new Date('2026-04-01T07:00:00Z'),
      averageSpeed: 2.89,
      maxSpeed: 3.5,
      averageHeartrate: 145.5,
      maxHeartrate: 165.0,
    },
    {
      stravaActivityId: 10000000002n,
      athleteId: athlete1.id,
      type: ActivityType.RUN,
      name: 'Evening Jog',
      distance: 3200.0,
      movingTime: 1200,
      elapsedTime: 1250,
      totalElevationGain: 25.0,
      startDate: new Date('2026-04-02T18:30:00Z'),
      averageSpeed: 2.67,
      maxSpeed: 3.2,
      averageHeartrate: 138.0,
      maxHeartrate: 155.0,
    },
    {
      stravaActivityId: 10000000003n,
      athleteId: athlete1.id,
      type: ActivityType.RIDE,
      name: 'Weekend Ride',
      distance: 25000.0,
      movingTime: 3600,
      elapsedTime: 3800,
      totalElevationGain: 320.5,
      startDate: new Date('2026-04-03T09:00:00Z'),
      averageSpeed: 6.94,
      maxSpeed: 12.5,
      averageHeartrate: 132.0,
      maxHeartrate: 158.0,
    },
  ];

  for (const activity of activities1) {
    await prisma.activity.create({ data: activity });
  }

  // Create activities for athlete 2
  const activities2 = [
    {
      stravaActivityId: 20000000001n,
      athleteId: athlete2.id,
      type: ActivityType.SWIM,
      name: 'Pool Session',
      distance: 1500.0,
      movingTime: 2400,
      elapsedTime: 2700,
      startDate: new Date('2026-04-01T06:00:00Z'),
      averageSpeed: 0.625,
    },
    {
      stravaActivityId: 20000000002n,
      athleteId: athlete2.id,
      type: ActivityType.YOGA,
      name: 'Morning Yoga',
      movingTime: 3600,
      elapsedTime: 3600,
      startDate: new Date('2026-04-02T07:00:00Z'),
    },
  ];

  for (const activity of activities2) {
    await prisma.activity.create({ data: activity });
  }

  // Create activities for athlete 3
  const activities3 = [
    {
      stravaActivityId: 30000000001n,
      athleteId: athlete3.id,
      type: ActivityType.WEIGHT_TRAINING,
      name: 'Gym Workout',
      movingTime: 2700,
      elapsedTime: 3000,
      startDate: new Date('2026-04-01T17:00:00Z'),
      averageHeartrate: 125.0,
      maxHeartrate: 145.0,
    },
    {
      stravaActivityId: 30000000002n,
      athleteId: athlete3.id,
      type: ActivityType.HIKE,
      name: 'Mountain Trail',
      distance: 8500.0,
      movingTime: 7200,
      elapsedTime: 9000,
      totalElevationGain: 650.0,
      startDate: new Date('2026-04-03T08:00:00Z'),
      averageSpeed: 1.18,
      maxSpeed: 2.1,
      averageHeartrate: 142.0,
      maxHeartrate: 168.0,
    },
    {
      stravaActivityId: 30000000003n,
      athleteId: athlete3.id,
      type: ActivityType.RUN,
      name: '5K Tempo Run',
      distance: 5000.0,
      movingTime: 1500,
      elapsedTime: 1600,
      totalElevationGain: 30.0,
      startDate: new Date('2026-04-04T07:30:00Z'),
      averageSpeed: 3.33,
      maxSpeed: 4.2,
      averageHeartrate: 155.0,
      maxHeartrate: 175.0,
    },
    {
      stravaActivityId: 30000000004n,
      athleteId: athlete3.id,
      type: ActivityType.CROSSFIT,
      name: 'WOD Session',
      movingTime: 2400,
      elapsedTime: 2700,
      startDate: new Date('2026-04-05T18:00:00Z'),
      averageHeartrate: 160.0,
      maxHeartrate: 185.0,
    },
  ];

  for (const activity of activities3) {
    await prisma.activity.create({ data: activity });
  }

  const totalActivities = activities1.length + activities2.length + activities3.length;
  console.log(`✅ Created ${totalActivities} activities`);

  console.log('\n📊 Seed data summary:');
  console.log(`  - Athletes: 3`);
  console.log(`  - Activities: ${totalActivities}`);
  console.log(
    `  - Activity types: ${[...new Set([...activities1, ...activities2, ...activities3].map((a) => a.type))].join(', ')}`
  );

  console.log('\n🌱 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
