import { defineConfig } from 'drizzle-kit';

function getDbUrl(): string {
  const rawUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname;
    if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
      const projectRef = host.replace('db.', '').replace('.supabase.co', '');
      const password = encodeURIComponent(parsed.password);
      return `postgresql://postgres.${projectRef}:${password}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

export default defineConfig({
  schema: './server/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDbUrl(),
  },
});
