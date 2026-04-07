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
      VALUES ('rob_web', '72291107-9d52-49a8-b2ed-5b5188ba158e', 
              'completed', 
              'Prisma ORM configurado con PostgreSQL. Schema con 5 modelos (Athlete, Activity, TrainingProgram, Session, Goal). Cliente generado y conexion verificada.', 
              NOW())
    `;
    console.log('✅ Activity logged to agent_logs');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error logging activity:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

logActivity();
