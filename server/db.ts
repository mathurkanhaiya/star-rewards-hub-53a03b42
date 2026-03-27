import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

function getConnectionString(): string {
  const rawUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('No database connection configured.');

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname;

    // Direct Supabase DB connection → rewrite to transaction pooler (port 6543)
    // Try multiple regions in order of proximity
    if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
      const projectRef = host.replace('db.', '').replace('.supabase.co', '');
      const password = encodeURIComponent(parsed.password);
      // US East 1 (most common for projects near Atlanta/US)
      const poolerUrl = `postgresql://postgres.${projectRef}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
      console.log('[DB] Using Supabase pooler (us-east-1, port 6543)');
      return poolerUrl;
    }

    return rawUrl;
  } catch {
    return rawUrl!;
  }
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
