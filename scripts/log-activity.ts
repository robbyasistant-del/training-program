import { db } from '../lib/db.js';

async function log() {
  try {
    // Create table if not exists
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS agent_logs (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        task_id TEXT,
        status TEXT NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await db.$executeRaw`
      INSERT INTO agent_logs (agent_id, task_id, status, message) 
      VALUES ('rob_web', '72291107-9d52-49a8-b2ed-5b5188ba158e', 'completed', 'Prisma ORM setup completed with PostgreSQL connection')
    `;
    console.log('✅ Activity logged to PostgreSQL');
  } catch (e) {
    console.log('Error logging to DB:', e);
  } finally {
    await db.$disconnect();
  }
}

log();
