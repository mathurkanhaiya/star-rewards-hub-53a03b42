import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const ADMIN_TELEGRAM_ID = 2139807311;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// In-memory stores (reset on server restart — acceptable for admin auth)
const otpStore = new Map<number, { otp: string; expiresAt: number }>();
const sessionStore = new Map<string, { telegramId: number; expiresAt: number }>();

function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of otpStore) if (v.expiresAt < now) otpStore.delete(k);
  for (const [k, v] of sessionStore) if (v.expiresAt < now) sessionStore.delete(k);
}

async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

// POST /api/admin-auth/request-otp
app.post('/api/admin-auth/request-otp', async (req, res) => {
  cleanExpired();
  const { telegramId } = req.body as { telegramId?: number };

  if (!telegramId || telegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Unauthorized: not an admin' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(telegramId, { otp, expiresAt: Date.now() + 5 * 60_000 });

  const sent = await sendTelegramMessage(
    telegramId,
    `🔐 <b>ADS Rewards Admin Login</b>\n\nYour OTP code is: <b>${otp}</b>\n\nThis code expires in 5 minutes. Do not share it with anyone.`
  );

  if (!sent) {
    return res.status(500).json({ error: 'Failed to send OTP via Telegram. Make sure you have started the bot.' });
  }

  return res.json({ success: true, message: 'OTP sent to your Telegram' });
});

// POST /api/admin-auth/verify-otp
app.post('/api/admin-auth/verify-otp', (req, res) => {
  cleanExpired();
  const { telegramId, otp } = req.body as { telegramId?: number; otp?: string };

  if (!telegramId || telegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const record = otpStore.get(telegramId);
  if (!record || record.otp !== otp?.trim()) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  otpStore.delete(telegramId);

  const token = crypto.randomUUID();
  sessionStore.set(token, { telegramId, expiresAt: Date.now() + 24 * 60 * 60_000 });

  return res.json({ success: true, token });
});

// POST /api/admin-auth/verify-session
app.post('/api/admin-auth/verify-session', (req, res) => {
  cleanExpired();
  const { token } = req.body as { token?: string };
  if (!token) return res.json({ valid: false });

  const session = sessionStore.get(token);
  if (!session || session.telegramId !== ADMIN_TELEGRAM_ID) {
    return res.json({ valid: false });
  }

  return res.json({ valid: true });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[Admin Auth API] Running on port ${PORT}`);
});
