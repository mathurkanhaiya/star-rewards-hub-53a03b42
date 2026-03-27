import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

function getConnectionString(): string {
  // Prefer explicit pooler URL (Transaction mode, port 6543, IPv4)
  if (process.env.SUPABASE_POOLER_URL) {
    console.log('[DB] Using SUPABASE_POOLER_URL (transaction pooler)');
    return process.env.SUPABASE_POOLER_URL;
  }
  // Fallback to direct DB URL
  if (process.env.SUPABASE_DB_URL) {
    console.log('[DB] Using SUPABASE_DB_URL (direct connection)');
    return process.env.SUPABASE_DB_URL;
  }
  // Fallback to Replit PostgreSQL
  if (process.env.DATABASE_URL) {
    console.log('[DB] Using DATABASE_URL (Replit PostgreSQL)');
    return process.env.DATABASE_URL;
  }
  throw new Error('No database connection configured.');
}

const connectionString = getConnectionString();

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle(pool, { schema });
