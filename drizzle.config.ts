import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL!,
  },
});
