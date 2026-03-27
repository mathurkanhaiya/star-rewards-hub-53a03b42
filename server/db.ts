import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

function getConnectionString(): string {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  if (process.env.SUPABASE_URL) {
    const url = new URL(process.env.SUPABASE_URL);
    const host = url.hostname;
    const projectRef = host.split('.')[0];
    const password = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
  }

  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  throw new Error('No database connection configured. Set SUPABASE_DB_URL or SUPABASE_URL.');
}

const connectionString = getConnectionString();

export const pool = new Pool({
  connectionString,
  ssl: process.env.SUPABASE_URL ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
