import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json());

const ADMIN_TELEGRAM_ID = 2139807311;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = Number(process.env.PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// In-memory stores (reset on server restart — acceptable for admin auth)
const otpStore = new Map<number, { otp: string; expiresAt: number }>();
const sessionStore = new Map<string, { telegramId: number; expiresAt: number }>();

function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of otpStore) if (v.expiresAt < now) otpStore.delete(k);
  for (const [k, v] of sessionStore) if (v.expiresAt < now) sessionStore.delete(k);
}

async function sendTelegramMessage(chatId: number, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) {
      console.error('[OTP] Telegram sendMessage failed:', data.description);
      return { ok: false, error: data.description };
    }
    return { ok: true };
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Telegram API request timed out' : String(err?.message || err);
    console.error('[OTP] sendTelegramMessage error:', msg);
    return { ok: false, error: msg };
  }
}

// ── POST /api/admin-auth/request-otp ─────────────────────────────────────────
app.post('/api/admin-auth/request-otp', async (req, res) => {
  cleanExpired();

  // Coerce to number — Telegram IDs are integers but could arrive as strings
  const telegramId = Number(req.body?.telegramId);
  console.log(`[OTP] request-otp — received telegramId=${telegramId}, expected=${ADMIN_TELEGRAM_ID}`);

  if (!telegramId || telegramId !== ADMIN_TELEGRAM_ID) {
    console.warn(`[OTP] Unauthorized attempt — telegramId=${telegramId}`);
    return res.status(403).json({ error: 'Unauthorized: your account is not an admin' });
  }

  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'Bot token not configured on server' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(telegramId, { otp, expiresAt: Date.now() + 5 * 60_000 });
  console.log(`[OTP] Generated OTP for admin ${telegramId}`);

  const result = await sendTelegramMessage(
    telegramId,
    `🔐 <b>ADS Rewards Admin Login</b>\n\nYour OTP code is: <b>${otp}</b>\n\nValid for 5 minutes. Do not share it.`
  );

  if (!result.ok) {
    otpStore.delete(telegramId); // clean up if send failed
    const reason = result.error || 'Unknown error';
    let hint = 'Make sure you have sent at least one message to the bot first.';
    if (reason.toLowerCase().includes('forbidden')) hint = 'Open @ADS_rewardsbot in Telegram and press Start, then try again.';
    if (reason.toLowerCase().includes('timeout')) hint = 'Telegram API timed out. Please retry.';
    return res.status(500).json({ error: `Could not send OTP: ${reason}. ${hint}` });
  }

  console.log(`[OTP] OTP sent successfully to ${telegramId}`);
  return res.json({ success: true, message: 'OTP sent to your Telegram chat' });
});

// ── POST /api/admin-auth/verify-otp ──────────────────────────────────────────
app.post('/api/admin-auth/verify-otp', (req, res) => {
  cleanExpired();
  const telegramId = Number(req.body?.telegramId);
  const otp = String(req.body?.otp || '').trim();

  if (!telegramId || telegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const record = otpStore.get(telegramId);
  if (!record) {
    return res.status(400).json({ error: 'OTP expired or not requested. Please request a new one.' });
  }
  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Incorrect OTP. Please check and try again.' });
  }

  otpStore.delete(telegramId);

  const token = crypto.randomUUID();
  sessionStore.set(token, { telegramId, expiresAt: Date.now() + 24 * 60 * 60_000 });
  console.log(`[OTP] Admin ${telegramId} authenticated successfully`);

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
  // SPA fallback — all non-API routes serve index.html
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Admin Auth API] Running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
});
