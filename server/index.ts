import express from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'fallback-dev-secret-change-me';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_TELEGRAM_ID = 2139807311;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '10kb' }));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, slow down.' },
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Try again in 10 minutes.' },
});

app.use(globalLimiter);

// ── In-memory OTP store ───────────────────────────────────────────────────────
interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}
const otpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanExpiredOtps() {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(key);
  }
}

async function sendTelegramOtp(chatId: number, otp: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('[OTP] TELEGRAM_BOT_TOKEN not set');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔐 <b>Admin OTP Code</b>\n\nYour one-time verification code:\n\n<code>${otp}</code>\n\n⏳ Valid for <b>5 minutes</b>.\n\n⚠️ Never share this code with anyone.`,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[OTP] Telegram send error:', err);
    return false;
  }
}

// ── POST /api/admin/request-otp ───────────────────────────────────────────────
app.post('/api/admin/request-otp', otpLimiter, async (req, res) => {
  cleanExpiredOtps();

  const { telegramId } = req.body;

  if (!telegramId || Number(telegramId) !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const otp = generateOtp();
  const key = String(ADMIN_TELEGRAM_ID);

  otpStore.set(key, {
    code: otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
  });

  const sent = await sendTelegramOtp(ADMIN_TELEGRAM_ID, otp);

  if (!sent) {
    otpStore.delete(key);
    return res.status(500).json({ success: false, message: 'Failed to send OTP via Telegram. Check bot token.' });
  }

  console.log(`[OTP] Sent to admin ${ADMIN_TELEGRAM_ID}`);
  return res.json({ success: true, message: 'OTP sent to your Telegram chat.' });
});

// ── POST /api/admin/verify-otp ────────────────────────────────────────────────
app.post('/api/admin/verify-otp', otpLimiter, (req, res) => {
  const { telegramId, otp } = req.body;

  if (!telegramId || !otp) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  if (Number(telegramId) !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const key = String(ADMIN_TELEGRAM_ID);
  const entry = otpStore.get(key);

  if (!entry) {
    return res.status(400).json({ success: false, message: 'No OTP requested. Request a new one.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(key);
    return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
  }

  if (String(otp).trim() !== entry.code) {
    return res.status(401).json({
      success: false,
      message: `Invalid OTP. ${5 - entry.attempts} attempts remaining.`,
    });
  }

  otpStore.delete(key);

  const token = jwt.sign(
    { telegramId: ADMIN_TELEGRAM_ID, role: 'admin' },
    SESSION_SECRET,
    { expiresIn: '4h' }
  );

  console.log(`[OTP] Admin ${ADMIN_TELEGRAM_ID} verified successfully`);
  return res.json({ success: true, token });
});

// ── GET /api/admin/check-session ──────────────────────────────────────────────
app.get('/api/admin/check-session', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  try {
    const payload = jwt.verify(auth.slice(7), SESSION_SECRET) as { role: string };
    if (payload.role !== 'admin') return res.status(403).json({ valid: false });
    return res.json({ valid: true });
  } catch {
    return res.status(401).json({ valid: false });
  }
});

// ── Production: serve Vite build as SPA ──────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
  console.log(`[Server] Admin OTP system active — admin ID: ${ADMIN_TELEGRAM_ID}`);
});
