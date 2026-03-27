import express from 'express';
import crypto from 'crypto';
import path from 'path';

const app = express();
app.use(express.json());

const ADMIN_TELEGRAM_ID = 2139807311;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ads@admin2024';
const PORT = Number(process.env.PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// In-memory session store (resets on server restart — fine for admin auth)
const sessionStore = new Map<string, { telegramId: number; expiresAt: number }>();

function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of sessionStore) if (v.expiresAt < now) sessionStore.delete(k);
}

// ── POST /api/admin-auth/login ────────────────────────────────────────────────
app.post('/api/admin-auth/login', (req, res) => {
  cleanExpired();
  const telegramId = Number(req.body?.telegramId);
  const password = String(req.body?.password || '').trim();

  console.log(`[Admin Auth] login attempt — telegramId=${telegramId}`);

  if (!telegramId || telegramId !== ADMIN_TELEGRAM_ID) {
    console.warn(`[Admin Auth] Unauthorized — telegramId=${telegramId}`);
    return res.status(403).json({ error: 'Unauthorized: not an admin account' });
  }

  if (!password || password !== ADMIN_PASSWORD) {
    console.warn(`[Admin Auth] Wrong password for telegramId=${telegramId}`);
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  const token = crypto.randomUUID();
  sessionStore.set(token, { telegramId, expiresAt: Date.now() + 24 * 60 * 60_000 });
  console.log(`[Admin Auth] Admin ${telegramId} logged in successfully`);

  return res.json({ success: true, token });
});

// ── POST /api/admin-auth/verify-session ──────────────────────────────────────
app.post('/api/admin-auth/verify-session', (req, res) => {
  cleanExpired();
  const token = String(req.body?.token || '');
  if (!token) return res.json({ valid: false });

  const session = sessionStore.get(token);
  const valid = !!(session && session.telegramId === ADMIN_TELEGRAM_ID);
  return res.json({ valid });
});

// ── Production: serve Vite build as SPA ──────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Admin Auth] Running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
});
