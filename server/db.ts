import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

function getConnectionString(): string {
  // Use explicit pooler URL if set correctly
  const poolerUrl = process.env.SUPABASE_POOLER_URL;
  if (poolerUrl && !poolerUrl.includes(' ') && poolerUrl.startsWith('postgresql://')) {
    console.log('[DB] Using SUPABASE_POOLER_URL');
    return poolerUrl;
  }

  // Build pooler URL from direct DB URL + known project ref/region
  const directUrl = process.env.SUPABASE_DB_URL;
  if (directUrl) {
    try {
      const parsed = new URL(directUrl);
      const host = parsed.hostname; // db.tjplebfkkberydbyrunn.supabase.co
      if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
        const projectRef = host.replace('db.', '').replace('.supabase.co', '');
        const rawPass = parsed.password; // may contain special chars
        // Build pooler URL with proper URL encoding
        const url = new URL(`postgresql://aws-0-us-east-1.pooler.supabase.com:6543/postgres`);
        url.username = `postgres.${projectRef}`;
        url.password = rawPass;
        const built = url.toString();
        console.log('[DB] Built Supabase pooler URL from SUPABASE_DB_URL');
        return built;
      }
    } catch (e) {
      console.error('[DB] Failed to parse SUPABASE_DB_URL:', e);
    }
    // Fall back to direct URL with SSL
    console.log('[DB] Using SUPABASE_DB_URL directly');
    return directUrl;
  }

  // Final fallback — Replit PostgreSQL
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log('[DB] Using Replit DATABASE_URL');
    return dbUrl;
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
