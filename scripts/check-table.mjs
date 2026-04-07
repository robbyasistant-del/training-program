import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function checkTable() {
  const cols = await db.$queryRaw`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'agent_logs'
  `;
  console.log('Columns in agent_logs:', cols);
  await db.$disconnect();
}

checkTable();
