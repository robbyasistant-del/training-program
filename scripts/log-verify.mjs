import dotenv from 'dotenv';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function logActivity() {
  try {
    await db.$executeRaw`
      INSERT INTO agent_logs (agent_id, task_id, status, message, created_at) 
      VALUES ('rob_verifier', '72291107-9d52-49a8-b2ed-5b5188ba158e', 
              'completed', 
              'Verification PASSED for Prisma ORM setup. All deliverables verified and quality criteria met.', 
              NOW())
    `;
    console.log('✅ Verification activity logged to agent_logs');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

logActivity();
