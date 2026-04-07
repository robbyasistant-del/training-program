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
      VALUES ('rob_web', '78a79966-9570-4647-a2c7-2ca4a9eccf44', 
              'completed', 
              'Schema inicial de base de datos creado. Modelos Athlete y Activity con ActivityType enum (37 valores). Seed con 3 atletas y 9 actividades. Build exitoso.', 
              NOW())
    `;
    console.log('✅ Activity logged to agent_logs');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

logActivity();
