import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import * as schema from './schema.js';
import { eq, and, gte, lte, desc, asc, sql, inArray, ne } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_TELEGRAM_ID = 2139807311;

app.use(cors());
app.use(express.json());

// ─── Telegram bot notification (best-effort) ──────────────────────────────────
async function sendTelegram(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch { /* non-critical */ }
}

// ─── Admin guard ──────────────────────────────────────────────────────────────
async function requireAdmin(req: express.Request, res: express.Response): Promise<boolean> {
  const adminId = req.headers['x-admin-telegram-id'] || req.body?.adminTelegramId || req.query?.adminTelegramId;
  if (Number(adminId) !== ADMIN_TELEGRAM_ID) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return false;
  }
  return true;
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(schema.settings);
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

async function getSettingVal(key: string, fallback: string): Promise<string> {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return rows[0]?.value ?? fallback;
}

// ─── Increment balance + total_points helper ──────────────────────────────────
async function incrementPoints(userId: string, points: number) {
  await db
    .update(schema.balances)
    .set({
      points: sql`${schema.balances.points} + ${points}`,
      totalEarned: sql`${schema.balances.totalEarned} + ${points}`,
      updatedAt: new Date(),
    })
    .where(eq(schema.balances.userId, userId));

  await db
    .update(schema.users)
    .set({
      totalPoints: sql`${schema.users.totalPoints} + ${points}`,
      level: sql`GREATEST(1, FLOOR((${schema.users.totalPoints} + ${points}) / 10000)::int + 1)`,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));
}

// ─── Response mappers (Drizzle camelCase → frontend snake_case) ───────────────
function mapUser(u: any) {
  if (!u) return null;
  return {
    id:            u.id,
    telegram_id:   u.telegramId,
    username:      u.username,
    first_name:    u.firstName,
    last_name:     u.lastName,
    photo_url:     u.photoUrl,
    level:         u.level,
    total_points:  u.totalPoints,
    referral_code: u.referralCode,
    referred_by:   u.referredBy,
    is_banned:     u.isBanned,
    ban_reason:    u.banReason ?? null,
    last_active_at: u.lastActiveAt,
    created_at:    u.createdAt,
  };
}

function mapTask(t: any) {
  if (!t) return null;
  return {
    id:            t.id,
    title:         t.title,
    description:   t.description,
    task_type:     t.taskType,
    reward_points: t.rewardPoints,
    reward_stars:  t.rewardStars,
    link:          t.link,
    icon:          t.icon,
    is_active:     t.isActive,
    is_repeatable: t.isRepeatable,
    display_order: t.displayOrder,
    repeat_hours:  t.repeatHours,
    adsgram_block_id: t.adsgramBlockId,
  };
}

function mapNotification(n: any) {
  if (!n) return null;
  return {
    id:         n.id,
    user_id:    n.userId,
    title:      n.title,
    message:    n.message,
    type:       n.type,
    is_read:    n.isRead,
    created_at: n.createdAt,
  };
}

function mapTransaction(t: any) {
  if (!t) return null;
  return {
    id:          t.id,
    user_id:     t.userId,
    type:        t.type,
    points:      t.points,
    description: t.description,
    created_at:  t.createdAt,
  };
}

function mapWithdrawal(w: any) {
  if (!w) return null;
  return {
    id:              w.id,
    user_id:         w.userId,
    method:          w.method,
    points_spent:    w.pointsSpent,
    amount:          w.amount,
    wallet_address:  w.walletAddress,
    status:          w.status,
    admin_note:      w.adminNote,
    requested_at:    w.requestedAt,
    processed_at:    w.processedAt,
    created_at:      w.createdAt,
  };
}

function mapBalance(b: any) {
  if (!b) return null;
  return {
    id:              b.id,
    user_id:         b.userId,
    points:          b.points,
    stars_balance:   parseFloat(b.starsBalance ?? b.stars_balance ?? 0),
    usdt_balance:    parseFloat(b.usdtBalance  ?? b.usdt_balance  ?? 0),
    ton_balance:     parseFloat(b.tonBalance   ?? b.ton_balance   ?? 0),
    total_earned:    b.totalEarned  ?? b.total_earned  ?? 0,
    total_withdrawn: b.totalWithdrawn ?? b.total_withdrawn ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/auth', async (req, res) => {
  try {
    const { telegramUser, referralCode } = req.body;
    if (!telegramUser?.id) return res.status(400).json({ error: 'No telegram user' });

    // Update existing user
    const existing = await db.select().from(schema.users)
      .where(eq(schema.users.telegramId, telegramUser.id)).limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(schema.users).set({
        lastActiveAt: new Date(),
        firstName: telegramUser.first_name || existing[0].firstName,
        lastName: telegramUser.last_name || existing[0].lastName,
        username: telegramUser.username || existing[0].username,
        photoUrl: telegramUser.photo_url || existing[0].photoUrl,
        updatedAt: new Date(),
      }).where(eq(schema.users.id, existing[0].id)).returning();
      return res.json({ user: mapUser(updated) });
    }

    // New user
    const referralCodeGen = String(telegramUser.id);
    let referrerId: string | null = null;

    if (referralCode && referralCode !== referralCodeGen) {
      const referrer = await db.select().from(schema.users)
        .where(eq(schema.users.telegramId, parseInt(referralCode))).limit(1);
      if (referrer.length > 0) referrerId = referrer[0].id;
    }

    const [newUser] = await db.insert(schema.users).values({
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name || null,
      username: telegramUser.username || null,
      photoUrl: telegramUser.photo_url || null,
      referralCode: referralCodeGen,
      referredBy: referralCode ? parseInt(referralCode) : null,
    }).returning();

    const welcomeBonus = 200;
    await db.insert(schema.balances).values({ userId: newUser.id, points: welcomeBonus, totalEarned: welcomeBonus });

    await db.insert(schema.transactions).values({
      userId: newUser.id, type: 'bonus', points: welcomeBonus,
      description: '🎉 Welcome bonus',
    });

    sendTelegram(telegramUser.id,
      `🎉 <b>Welcome!</b>\n\nYou received <b>${welcomeBonus} points</b> as a welcome bonus!\n\nComplete tasks, spin the wheel, and invite friends to earn more! 🚀`
    );

    // Handle referral
    if (referrerId) {
      const referralBonus = parseInt(await getSettingVal('points_per_referral', '500'));
      const referredBonus = parseInt(await getSettingVal('referral_bonus_referred', '200'));

      await db.insert(schema.referrals).values({
        referrerId, referredId: newUser.id, pointsEarned: referralBonus, isVerified: true,
      });

      await incrementPoints(referrerId, referralBonus);
      await db.insert(schema.transactions).values({
        userId: referrerId, type: 'referral', points: referralBonus,
        description: `👥 Referral bonus from @${telegramUser.username || telegramUser.first_name}`,
      });

      await db.insert(schema.notifications).values({
        userId: referrerId,
        title: '👥 New Referral!',
        message: `@${telegramUser.username || telegramUser.first_name} joined using your link! +${referralBonus} points!`,
        type: 'referral',
      });

      // Referrer TG alert
      const referrerUser = await db.select().from(schema.users).where(eq(schema.users.id, referrerId)).limit(1);
      if (referrerUser[0]) {
        sendTelegram(referrerUser[0].telegramId,
          `👥 <b>New Referral!</b>\n\n@${telegramUser.username || telegramUser.first_name} joined!\n+${referralBonus} points added! 🎉`
        );
      }

      await incrementPoints(newUser.id, referredBonus);
      await db.insert(schema.transactions).values({
        userId: newUser.id, type: 'referral', points: referredBonus,
        description: '🔗 Joined via referral bonus',
      });
    }

    res.json({ user: mapUser(newUser) });
  } catch (err) {
    console.error('auth error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER / BALANCE
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const rows = await db.select().from(schema.users)
      .where(eq(schema.users.telegramId, parseInt(req.params.telegramId))).limit(1);
    res.json(mapUser(rows[0]) || null);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/balance/:userId', async (req, res) => {
  try {
    const rows = await db.select().from(schema.balances)
      .where(eq(schema.balances.userId, req.params.userId)).limit(1);
    res.json(mapBalance(rows[0]) || null);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/settings', async (_req, res) => {
  try { res.json(await getSettings()); }
  catch (err) { res.status(500).json({ error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/tasks', async (_req, res) => {
  try {
    const rows = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.isActive, true))
      .orderBy(asc(schema.tasks.displayOrder));
    res.json(rows.map(mapTask));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/tasks/completed/:userId', async (req, res) => {
  try {
    const rows = await db.select({
      taskId: schema.userTasks.taskId,
      completedAt: schema.userTasks.completedAt,
      nextAvailableAt: schema.userTasks.nextAvailableAt,
    }).from(schema.userTasks).where(eq(schema.userTasks.userId, req.params.userId));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/tasks/complete', async (req, res) => {
  try {
    const { userId, taskId } = req.body;
    if (!userId || !taskId) return res.status(400).json({ success: false, message: 'Missing fields' });

    const taskRows = await db.select().from(schema.tasks)
      .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.isActive, true))).limit(1);
    if (!taskRows.length) return res.json({ success: false, message: 'Task not found or inactive' });

    const task = taskRows[0];

    if (!task.isRepeatable) {
      const existing = await db.select().from(schema.userTasks)
        .where(and(eq(schema.userTasks.userId, userId), eq(schema.userTasks.taskId, taskId))).limit(1);
      if (existing.length) return res.json({ success: false, message: 'Task already completed!' });
    } else {
      const last = await db.select().from(schema.userTasks)
        .where(and(eq(schema.userTasks.userId, userId), eq(schema.userTasks.taskId, taskId)))
        .orderBy(desc(schema.userTasks.completedAt)).limit(1);
      if (last[0]?.nextAvailableAt && new Date(last[0].nextAvailableAt) > new Date()) {
        return res.json({ success: false, message: 'Task cooldown not finished yet' });
      }
    }

    const points = task.rewardPoints;
    const nextAvailable = task.isRepeatable
      ? new Date(Date.now() + (task.repeatHours || 24) * 3600000)
      : null;

    await db.insert(schema.userTasks).values({ userId, taskId, pointsEarned: points, nextAvailableAt: nextAvailable });
    await incrementPoints(userId, points);
    await db.insert(schema.transactions).values({
      userId, type: 'earn', points, description: `✅ Task: ${task.title}`,
    });

    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (user[0]) sendTelegram(user[0].telegramId, `✅ <b>Task Completed!</b>\n\n${task.title}\n+${points} points earned! 🎉`);

    res.json({ success: true, points });
  } catch (err) {
    console.error('complete-task error:', err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY REWARD
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/daily-claim/:userId', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.select().from(schema.dailyClaims)
      .where(and(eq(schema.dailyClaims.userId, req.params.userId), eq(schema.dailyClaims.claimDate, today))).limit(1);
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/daily-reward', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'No userId' });

    const today = new Date().toISOString().split('T')[0];
    const existing = await db.select().from(schema.dailyClaims)
      .where(and(eq(schema.dailyClaims.userId, userId), eq(schema.dailyClaims.claimDate, today))).limit(1);
    if (existing.length) return res.json({ success: false, message: 'Already claimed today! Come back tomorrow 🌙' });

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastClaim = await db.select().from(schema.dailyClaims)
      .where(and(eq(schema.dailyClaims.userId, userId), eq(schema.dailyClaims.claimDate, yesterday))).limit(1);

    const streak = lastClaim.length ? lastClaim[0].dayStreak + 1 : 1;
    const basePoints = parseInt(await getSettingVal('daily_bonus_base', '100'));
    const streakBonus = Math.min(streak * 10, 500);
    const totalPoints = basePoints + streakBonus;

    await db.insert(schema.dailyClaims).values({ userId, claimDate: today, dayStreak: streak, pointsEarned: totalPoints });
    await incrementPoints(userId, totalPoints);
    await db.insert(schema.transactions).values({
      userId, type: 'daily', points: totalPoints,
      description: `🎁 Daily reward (Day ${streak} streak)`,
    });

    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (user[0]) sendTelegram(user[0].telegramId,
      `🎁 <b>Daily Reward Claimed!</b>\n\n+${totalPoints} points\n🔥 Streak: Day ${streak}\n\nCome back tomorrow!`);

    res.json({ success: true, points: totalPoints, streak });
  } catch (err) {
    console.error('daily-reward error:', err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPIN WHEEL
// ═══════════════════════════════════════════════════════════════════════════════

const SPIN_PRIZES = [
  { type: 'points', points: 10,  probability: 0.30 },
  { type: 'points', points: 15,  probability: 0.25 },
  { type: 'points', points: 20,  probability: 0.15 },
  { type: 'points', points: 30,  probability: 0.08 },
  { type: 'points', points: 25,  probability: 0.05 },
  { type: 'stars',  points: 17,  probability: 0.07 },
  { type: 'stars',  points: 35,  probability: 0.03 },
  { type: 'empty',  points: 0,   probability: 0.07 },
];

function selectPrize() {
  const rand = Math.random();
  let cumulative = 0;
  for (const prize of SPIN_PRIZES) {
    cumulative += prize.probability;
    if (rand <= cumulative) return prize;
  }
  return SPIN_PRIZES[0];
}

app.get('/api/spins/:userId', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.select().from(schema.spinResults)
      .where(and(
        eq(schema.spinResults.userId, req.params.userId),
        gte(schema.spinResults.spunAt, new Date(`${today}T00:00:00Z`))
      ));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/spin', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'No userId' });

    const today = new Date().toISOString().split('T')[0];
    const maxSpins = parseInt(await getSettingVal('max_daily_spins', '3'));

    const todaySpins = await db.select().from(schema.spinResults)
      .where(and(
        eq(schema.spinResults.userId, userId),
        gte(schema.spinResults.spunAt, new Date(`${today}T00:00:00Z`))
      ));

    if (todaySpins.length >= maxSpins) {
      return res.json({ success: false, message: 'Daily spin limit reached! Come back tomorrow.' });
    }

    const prize = selectPrize();
    const stars = prize.type === 'stars' ? prize.points : 0;
    const points = prize.type === 'points' ? prize.points : 0;

    await db.insert(schema.spinResults).values({
      userId, resultType: prize.type, pointsEarned: points, starsEarned: String(stars),
    });

    if (prize.type !== 'empty') {
      if (points > 0) {
        await incrementPoints(userId, points);
        await db.insert(schema.transactions).values({
          userId, type: 'spin', points, description: `🎡 Spin: ${points} points won!`,
        });
      }
      if (stars > 0) {
        await db.update(schema.balances).set({
          starsBalance: sql`${schema.balances.starsBalance} + ${stars}`,
          updatedAt: new Date(),
        }).where(eq(schema.balances.userId, userId));
        await db.insert(schema.transactions).values({
          userId, type: 'spin', points: 0, description: `🎡 Spin: ${stars} ⭐ Stars won!`,
        });
      }
    }

    res.json({ success: true, result: prize.type, points, stars });
  } catch (err) {
    console.error('spin error:', err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WITHDRAWALS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/withdrawals/:userId', async (req, res) => {
  try {
    const rows = await db.select().from(schema.withdrawals)
      .where(eq(schema.withdrawals.userId, req.params.userId))
      .orderBy(desc(schema.withdrawals.createdAt));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/withdraw', async (req, res) => {
  try {
    const { userId, method, points, walletAddress } = req.body;
    if (!userId || !method || !points) return res.status(400).json({ success: false, message: 'Missing fields' });

    const settings = await getSettings();
    const minPoints = parseInt(settings.min_withdrawal_points || '10000');
    if (points < minPoints) {
      return res.json({ success: false, message: `Minimum withdrawal is ${minPoints.toLocaleString()} points` });
    }

    const rateKey = `${method}_conversion_rate`;
    const rate = parseInt(settings[rateKey] || '1000');
    const amount = points / rate;

    const balRows = await db.select().from(schema.balances).where(eq(schema.balances.userId, userId)).limit(1);
    if (!balRows.length || balRows[0].points < points) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }

    const maxPending = parseInt(settings.max_pending_withdrawals || '2');
    const pending = await db.select().from(schema.withdrawals)
      .where(and(eq(schema.withdrawals.userId, userId), eq(schema.withdrawals.status, 'pending')));
    if (pending.length >= maxPending) {
      return res.json({ success: false, message: 'You have too many pending withdrawals' });
    }

    await db.insert(schema.withdrawals).values({
      userId, method, pointsSpent: points, amount: String(amount),
      walletAddress: walletAddress || null, status: 'pending',
    });

    await db.update(schema.balances).set({
      points: sql`${schema.balances.points} - ${points}`,
      totalWithdrawn: sql`${schema.balances.totalWithdrawn} + ${points}`,
      updatedAt: new Date(),
    }).where(eq(schema.balances.userId, userId));

    await db.insert(schema.transactions).values({
      userId, type: 'spend', points: -points,
      description: `💸 Withdrawal request: ${amount.toFixed(2)} ${method.toUpperCase()}`,
    });

    await db.insert(schema.notifications).values({
      userId, title: '💸 Withdrawal Submitted',
      message: `Your withdrawal of ${points.toLocaleString()} pts (${amount.toFixed(2)} ${method.toUpperCase()}) is pending review.`,
      type: 'withdrawal',
    });

    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (user[0]) {
      sendTelegram(user[0].telegramId,
        `💸 <b>Withdrawal Submitted</b>\n\nAmount: <b>${amount.toFixed(2)} ${method.toUpperCase()}</b>\nPoints spent: ${points.toLocaleString()}\n\nPending admin review.`
      );
      sendTelegram(ADMIN_TELEGRAM_ID,
        `🔔 <b>New Withdrawal Request</b>\n\nUser: ${user[0].firstName} (@${user[0].username || 'N/A'})\nAmount: <b>${amount.toFixed(2)} ${method.toUpperCase()}</b>\nPoints: ${points.toLocaleString()}\nWallet: ${walletAddress || 'N/A'}`
      );
    }

    res.json({ success: true, message: 'Withdrawal request submitted!' });
  } catch (err) {
    console.error('withdraw error:', err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: schema.users.id,
        telegramId: schema.users.telegramId,
        username: schema.users.username,
        firstName: schema.users.firstName,
        photoUrl: schema.users.photoUrl,
        level: schema.users.level,
        totalPoints: schema.users.totalPoints,
        currentPoints: schema.balances.points,
      })
      .from(schema.users)
      .leftJoin(schema.balances, eq(schema.balances.userId, schema.users.id))
      .where(eq(schema.users.isBanned, false))
      .orderBy(desc(schema.users.totalPoints))
      .limit(50);

    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    res.json(ranked);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFERRALS / TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/referrals/:userId', async (req, res) => {
  try {
    const rows = await db.select().from(schema.referrals)
      .where(eq(schema.referrals.referrerId, req.params.userId))
      .orderBy(desc(schema.referrals.createdAt));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const rows = await db.select().from(schema.transactions)
      .where(eq(schema.transactions.userId, req.params.userId))
      .orderBy(desc(schema.transactions.createdAt))
      .limit(50);
    res.json(rows.map(mapTransaction));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const rows = await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, req.params.userId))
      .orderBy(desc(schema.notifications.createdAt)).limit(30);
    res.json(rows.map(mapNotification));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/notifications/:userId/unread', async (req, res) => {
  try {
    const rows = await db.select({ id: schema.notifications.id }).from(schema.notifications)
      .where(and(eq(schema.notifications.userId, req.params.userId), eq(schema.notifications.isRead, false)));
    res.json({ count: rows.length });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.id, req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADS
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/ads/log', async (req, res) => {
  try {
    const { userId, adType, rewardGiven } = req.body;
    if (!userId || !adType) return res.status(400).json({ success: false, message: 'Missing fields' });

    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentAds = await db.select({ id: schema.adLogs.id }).from(schema.adLogs)
      .where(and(eq(schema.adLogs.userId, userId), gte(schema.adLogs.createdAt, oneHourAgo)));
    if (recentAds.length >= 10) {
      return res.json({ success: false, message: 'Ad rate limit reached' });
    }

    await db.insert(schema.adLogs).values({ userId, adType, rewardGiven: rewardGiven || 0 });

    if (rewardGiven > 0) {
      await incrementPoints(userId, rewardGiven);
      await db.insert(schema.transactions).values({
        userId, type: 'ad_reward', points: rewardGiven, description: `📺 Ad reward: ${adType}`,
      });
    }

    // Track ads_watch contests
    const now = new Date();
    const activeContests = await db.select().from(schema.contests)
      .where(and(eq(schema.contests.contestType, 'ads_watch'), eq(schema.contests.isActive, true),
        lte(schema.contests.startsAt, now), gte(schema.contests.endsAt, now)));

    for (const contest of activeContests) {
      const existing = await db.select().from(schema.contestEntries)
        .where(and(eq(schema.contestEntries.contestId, contest.id), eq(schema.contestEntries.userId, userId))).limit(1);
      if (existing.length) {
        await db.update(schema.contestEntries).set({
          score: sql`${schema.contestEntries.score} + 1`, updatedAt: new Date(),
        }).where(eq(schema.contestEntries.id, existing[0].id));
      } else {
        await db.insert(schema.contestEntries).values({ contestId: contest.id, userId, score: 1 });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('ad-log error:', err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

app.get('/api/ads/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const rows = await db.select({ id: schema.adLogs.id }).from(schema.adLogs)
      .where(and(eq(schema.adLogs.userId, userId), gte(schema.adLogs.createdAt, startOfDay)));
    res.json({ count: rows.length });
  } catch (e) { res.status(500).json({ count: 0 }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTESTS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/contests/active', async (_req, res) => {
  try {
    const now = new Date();
    const rows = await db.select().from(schema.contests)
      .where(and(eq(schema.contests.isActive, true), gte(schema.contests.endsAt, now)))
      .orderBy(asc(schema.contests.endsAt));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/contests/:contestId/leaderboard', async (req, res) => {
  try {
    const entries = await db.select().from(schema.contestEntries)
      .where(eq(schema.contestEntries.contestId, req.params.contestId))
      .orderBy(desc(schema.contestEntries.score)).limit(20);
    if (!entries.length) return res.json([]);

    const userIds = entries.map(e => e.userId);
    const usersData = await db.select({
      id: schema.users.id, firstName: schema.users.firstName,
      username: schema.users.username, photoUrl: schema.users.photoUrl, telegramId: schema.users.telegramId,
    }).from(schema.users).where(inArray(schema.users.id, userIds));

    const userMap: Record<string, typeof usersData[0]> = {};
    usersData.forEach(u => { userMap[u.id] = u; });

    res.json(entries.map(e => ({ user_id: e.userId, score: e.score, users: userMap[e.userId] || null })));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROMOS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/promos', async (_req, res) => {
  try {
    const rows = await db.select().from(schema.promos)
      .where(eq(schema.promos.isActive, true)).orderBy(desc(schema.promos.createdAt));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/promos/claim', async (req, res) => {
  try {
    const { promoId, userId } = req.body;
    if (!promoId || !userId) return res.status(400).json({ success: false, message: 'Missing fields' });

    const promoRows = await db.select().from(schema.promos)
      .where(and(eq(schema.promos.id, promoId), eq(schema.promos.isActive, true))).limit(1);
    if (!promoRows.length) return res.json({ success: false, message: 'Promo not found' });
    const promo = promoRows[0];

    if (promo.totalClaimed >= promo.maxClaims) {
      return res.json({ success: false, message: 'Promo fully claimed' });
    }

    const alreadyClaimed = await db.select().from(schema.promoClaims)
      .where(and(eq(schema.promoClaims.promoId, promoId), eq(schema.promoClaims.userId, userId))).limit(1);
    if (alreadyClaimed.length) return res.json({ success: false, message: 'Already claimed this promo' });

    await db.insert(schema.promoClaims).values({ promoId, userId });
    await db.update(schema.promos).set({ totalClaimed: sql`${schema.promos.totalClaimed} + 1` }).where(eq(schema.promos.id, promoId));

    await incrementPoints(userId, promo.rewardPoints);
    await db.insert(schema.transactions).values({
      userId, type: 'promo', points: promo.rewardPoints,
      description: `🎟️ Promo: ${promo.title}`,
    });

    res.json({ success: true, points: promo.rewardPoints });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GAME REWARDS — server-enforced limits + caps
// ═══════════════════════════════════════════════════════════════════════════════

const GAME_LIMITS: Record<string, { maxPlaysPerDay: number; maxPointsPerPlay: number }> = {
  cardflip:    { maxPlaysPerDay: 10, maxPointsPerPlay: 200 },
  dice:        { maxPlaysPerDay: 10, maxPointsPerPlay: 200 },
  luckybox:    { maxPlaysPerDay: 10, maxPointsPerPlay: 300 },
  numberguess: { maxPlaysPerDay: 10, maxPointsPerPlay: 200 },
  tower:       { maxPlaysPerDay: 5,  maxPointsPerPlay: 150 },
};

app.get('/api/game/check/:userId/:gameType', async (req, res) => {
  try {
    const { userId, gameType } = req.params;
    const limits = GAME_LIMITS[gameType];
    if (!limits) return res.status(400).json({ error: 'Unknown game' });

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const plays = await db.select({ id: schema.gamePlays.id }).from(schema.gamePlays)
      .where(and(
        eq(schema.gamePlays.userId, userId),
        eq(schema.gamePlays.gameType, gameType),
        gte(schema.gamePlays.playedAt, startOfDay)
      ));

    res.json({ playsToday: plays.length, maxPlaysPerDay: limits.maxPlaysPerDay, canPlay: plays.length < limits.maxPlaysPerDay });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/game/reward', async (req, res) => {
  try {
    const { userId, gameType, pointsWon } = req.body;
    if (!userId || !gameType) return res.status(400).json({ success: false, message: 'Missing fields' });

    const limits = GAME_LIMITS[gameType];
    if (!limits) return res.status(400).json({ success: false, message: 'Unknown game type' });

    // Enforce daily play limit
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const plays = await db.select({ id: schema.gamePlays.id }).from(schema.gamePlays)
      .where(and(
        eq(schema.gamePlays.userId, userId),
        eq(schema.gamePlays.gameType, gameType),
        gte(schema.gamePlays.playedAt, startOfDay)
      ));

    if (plays.length >= limits.maxPlaysPerDay) {
      return res.json({ success: false, message: `Daily limit of ${limits.maxPlaysPerDay} plays reached for this game` });
    }

    // Cap the reward server-side — client cannot inflate this
    const safePoints = Math.min(Math.max(0, Math.floor(pointsWon || 0)), limits.maxPointsPerPlay);

    await db.insert(schema.gamePlays).values({ userId, gameType, pointsEarned: safePoints });

    if (safePoints > 0) {
      await incrementPoints(userId, safePoints);
      await db.insert(schema.transactions).values({
        userId, type: 'game', points: safePoints,
        description: `🎮 ${gameType}: +${safePoints} points`,
      });
    }

    res.json({ success: true, points: safePoints, playsToday: plays.length + 1, maxPlaysPerDay: limits.maxPlaysPerDay });
  } catch (err) {
    console.error('game-reward error:', err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/stats', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const [totalUsers, withdrawalRows, adRows, txRows] = await Promise.all([
      db.select({ id: schema.users.id }).from(schema.users),
      db.select({ id: schema.withdrawals.id, status: schema.withdrawals.status }).from(schema.withdrawals),
      db.select({ id: schema.adLogs.id }).from(schema.adLogs),
      db.select({ id: schema.transactions.id }).from(schema.transactions),
    ]);
    res.json({
      totalUsers: totalUsers.length,
      totalWithdrawals: withdrawalRows.length,
      pendingWithdrawals: withdrawalRows.filter(w => w.status === 'pending').length,
      totalTransactions: txRows.length,
      totalAdViews: adRows.length,
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/admin/users', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const rows = await db
      .select({ user: schema.users, balance: schema.balances })
      .from(schema.users)
      .leftJoin(schema.balances, eq(schema.balances.userId, schema.users.id))
      .orderBy(desc(schema.users.createdAt));
    res.json(rows.map(r => ({
      ...mapUser(r.user),
      balances: r.balance ? [mapBalance(r.balance)] : [],
    })));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const rows = await db
      .select({ withdrawal: schema.withdrawals, user: { firstName: schema.users.firstName, username: schema.users.username, telegramId: schema.users.telegramId, photoUrl: schema.users.photoUrl } })
      .from(schema.withdrawals)
      .leftJoin(schema.users, eq(schema.users.id, schema.withdrawals.userId))
      .orderBy(desc(schema.withdrawals.createdAt));
    res.json(rows.map(r => ({
      ...mapWithdrawal(r.withdrawal),
      users: r.user ? {
        first_name: r.user.firstName,
        username:   r.user.username,
        telegram_id: r.user.telegramId,
        photo_url:  r.user.photoUrl,
      } : null,
    })));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/admin/withdrawal', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { withdrawalId, status, adminNote } = req.body;
    if (!withdrawalId || !status) return res.status(400).json({ success: false, message: 'Missing fields' });

    const wRows = await db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, withdrawalId)).limit(1);
    if (!wRows.length) return res.json({ success: false, message: 'Withdrawal not found' });
    const withdrawal = wRows[0];

    await db.update(schema.withdrawals).set({
      status, adminNote: adminNote || null, processedAt: new Date(),
    }).where(eq(schema.withdrawals.id, withdrawalId));

    if (status === 'rejected') {
      await db.update(schema.balances).set({
        points: sql`${schema.balances.points} + ${withdrawal.pointsSpent}`,
        totalWithdrawn: sql`GREATEST(0, ${schema.balances.totalWithdrawn} - ${withdrawal.pointsSpent})`,
        updatedAt: new Date(),
      }).where(eq(schema.balances.userId, withdrawal.userId));

      await db.insert(schema.transactions).values({
        userId: withdrawal.userId, type: 'refund', points: withdrawal.pointsSpent,
        description: `🔄 Withdrawal rejected — ${withdrawal.pointsSpent.toLocaleString()} pts refunded`,
      });
    }

    const notifTitle = status === 'approved' ? '✅ Withdrawal Approved!' : '❌ Withdrawal Rejected';
    const notifMsg = status === 'approved'
      ? `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} has been approved.`
      : `Your withdrawal was rejected. ${withdrawal.pointsSpent.toLocaleString()} points refunded.${adminNote ? ` Reason: ${adminNote}` : ''}`;

    await db.insert(schema.notifications).values({
      userId: withdrawal.userId, title: notifTitle, message: notifMsg, type: 'withdrawal',
    });

    const user = await db.select().from(schema.users).where(eq(schema.users.id, withdrawal.userId)).limit(1);
    if (user[0]) {
      const tgMsg = status === 'approved'
        ? `✅ <b>Withdrawal Approved!</b>\n\n<b>${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()}</b> is being processed! 🎉`
        : `❌ <b>Withdrawal Rejected</b>\n\n${withdrawal.pointsSpent.toLocaleString()} points refunded.${adminNote ? `\nReason: ${adminNote}` : ''}`;
      sendTelegram(user[0].telegramId, tgMsg);
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.put('/api/admin/settings', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ success: false });
    await db.insert(schema.settings).values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.get('/api/admin/user-activity/:userId', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { userId } = req.params;

    const [txRows, adRows, dropRows, balRow] = await Promise.all([
      db.select({ id: schema.transactions.id, type: schema.transactions.type, points: schema.transactions.points, description: schema.transactions.description, createdAt: schema.transactions.createdAt })
        .from(schema.transactions).where(eq(schema.transactions.userId, userId))
        .orderBy(desc(schema.transactions.createdAt)).limit(150),
      db.select({ id: schema.adLogs.id }).from(schema.adLogs).where(eq(schema.adLogs.userId, userId)),
      db.select({ claimDate: schema.dailyClaims.claimDate })
        .from(schema.dailyClaims).where(eq(schema.dailyClaims.userId, userId))
        .orderBy(desc(schema.dailyClaims.claimDate)).limit(7),
      db.select({ points: schema.balances.points }).from(schema.balances).where(eq(schema.balances.userId, userId)).limit(1),
    ]);

    const txs = txRows.map(t => ({ id: t.id, type: t.type, points: t.points, description: t.description, created_at: t.createdAt?.toISOString() || '' }));

    const breakdown = { tap:0, farm:0, ads:0, games:0, daily:0, drop:0, referral:0, spin:0, tasks:0, promo:0, admin:0, other:0 };
    let totalEarned = 0;
    txs.forEach(t => {
      const pts = t.points || 0;
      if (pts <= 0) return;
      totalEarned += pts;
      const ty = t.type;
      if (ty === 'tap_earn') breakdown.tap += pts;
      else if (ty === 'farm_claim') breakdown.farm += pts;
      else if (['adsgram_reward','adsgram_task','ad_reward','ad_watch'].includes(ty)) breakdown.ads += pts;
      else if (['tower_climb','lucky_box','dice_roll','card_flip','number_guess','game'].includes(ty)) breakdown.games += pts;
      else if (['daily_reward','daily'].includes(ty)) breakdown.daily += pts;
      else if (ty === 'daily_drop') breakdown.drop += pts;
      else if (['referral','referral_bonus'].includes(ty)) breakdown.referral += pts;
      else if (['spin','spin_reward'].includes(ty)) breakdown.spin += pts;
      else if (ty === 'task_complete') breakdown.tasks += pts;
      else if (ty === 'promo') breakdown.promo += pts;
      else if (['admin_credit','admin_debit','admin_adjust'].includes(ty)) breakdown.admin += pts;
      else breakdown.other += pts;
    });

    const tapCount  = txs.filter(t => t.type === 'tap_earn').length;
    const farmCount = txs.filter(t => t.type === 'farm_claim').length;

    let dropStreak = 0;
    if (dropRows.length > 0) {
      const now = new Date(); now.setUTCHours(0,0,0,0);
      for (let i = 0; i < dropRows.length; i++) {
        const d = new Date(dropRows[i].claimDate as string);
        const exp = new Date(now); exp.setUTCDate(now.getUTCDate() - i);
        if (d.toISOString().split('T')[0] === exp.toISOString().split('T')[0]) dropStreak++;
        else break;
      }
    }

    res.json({
      breakdown, transactions: txs, totalEarned,
      currentBalance: balRow[0]?.points || 0,
      lastSeen: txs[0]?.created_at || null,
      adCount: adRows.length,
      tapCount, farmCount, dropStreak,
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/admin/ban', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { userId, banned } = req.body;
    await db.update(schema.users).set({ isBanned: banned, updatedAt: new Date() }).where(eq(schema.users.id, userId));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.post('/api/admin/adjust-balance', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { userId, points, reason } = req.body;
    const balRows = await db.select().from(schema.balances).where(eq(schema.balances.userId, userId)).limit(1);
    if (!balRows.length) return res.json({ success: false });

    const newPoints = Math.max(0, balRows[0].points + points);
    await db.update(schema.balances).set({ points: newPoints, updatedAt: new Date() }).where(eq(schema.balances.userId, userId));
    await db.insert(schema.transactions).values({
      userId, type: points >= 0 ? 'admin_credit' : 'admin_debit', points,
      description: `🛡️ Admin: ${reason}`,
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.post('/api/admin/tasks', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const [task] = await db.insert(schema.tasks).values(req.body).returning();
    res.json({ success: true, data: task });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.put('/api/admin/tasks/:id/toggle', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    await db.update(schema.tasks).set({ isActive: req.body.isActive, updatedAt: new Date() }).where(eq(schema.tasks.id, req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.delete('/api/admin/tasks/:id', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    await db.delete(schema.userTasks).where(eq(schema.userTasks.taskId, req.params.id));
    await db.delete(schema.tasks).where(eq(schema.tasks.id, req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.get('/api/admin/contests', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const rows = await db.select().from(schema.contests).orderBy(desc(schema.contests.createdAt));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/admin/contests', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const [contest] = await db.insert(schema.contests).values(req.body).returning();
    res.json({ success: true, data: contest });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.post('/api/admin/contests/:id/distribute', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const contestRows = await db.select().from(schema.contests).where(eq(schema.contests.id, req.params.id)).limit(1);
    if (!contestRows.length) return res.json({ success: false, message: 'Contest not found' });
    const contest = contestRows[0];
    if (contest.rewardsDistributed) return res.json({ success: false, message: 'Already distributed' });

    const entries = await db.select().from(schema.contestEntries)
      .where(eq(schema.contestEntries.contestId, contest.id))
      .orderBy(desc(schema.contestEntries.score)).limit(5);

    const rewards = [contest.reward1st, contest.reward2nd, contest.reward3rd, contest.reward4th, contest.reward5th];
    const medals = ['🥇', '🥈', '🥉', '4th', '5th'];

    for (let i = 0; i < entries.length; i++) {
      const reward = rewards[i] || 0;
      if (reward <= 0) continue;
      await incrementPoints(entries[i].userId, reward);
      await db.insert(schema.transactions).values({
        userId: entries[i].userId, type: 'contest_reward', points: reward,
        description: `🏆 ${medals[i]} Contest "${contest.title}" reward!`,
      });
      await db.insert(schema.notifications).values({
        userId: entries[i].userId, title: '🏆 Contest Winner!',
        message: `You placed ${medals[i]} in "${contest.title}" and won ${reward.toLocaleString()} points!`,
        type: 'reward',
      });
      const user = await db.select().from(schema.users).where(eq(schema.users.id, entries[i].userId)).limit(1);
      if (user[0]) sendTelegram(user[0].telegramId, `🏆 <b>Contest Winner!</b>\n\nYou placed <b>${medals[i]}</b> in "${contest.title}"!\n+${reward.toLocaleString()} points! 🎉`);
    }

    await db.update(schema.contests).set({ rewardsDistributed: true, isActive: false }).where(eq(schema.contests.id, contest.id));
    res.json({ success: true, message: `Rewards distributed to ${entries.length} winners!` });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.post('/api/admin/broadcast', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { message, adminTelegramId } = req.body;
    const allUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const notifs = allUsers.map(u => ({ userId: u.id, title: '📢 Announcement', message, type: 'info' }));
    for (let i = 0; i < notifs.length; i += 100) {
      await db.insert(schema.notifications).values(notifs.slice(i, i + 100));
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.get('/api/admin/promos', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const rows = await db.select().from(schema.promos).orderBy(desc(schema.promos.createdAt));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/admin/promos', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const [promo] = await db.insert(schema.promos).values(req.body).returning();
    res.json({ success: true, data: promo });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

app.put('/api/admin/promos/:id/toggle', async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    await db.update(schema.promos).set({ isActive: req.body.isActive }).where(eq(schema.promos.id, req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GENERAL EARN (tap, farm, etc.) — server-enforced per-hour cap
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/earn', async (req, res) => {
  try {
    const { userId, points, type, description } = req.body;
    if (!userId || !points || points <= 0) return res.status(400).json({ success: false, message: 'Invalid earn request' });

    const MAX_PER_REQUEST = 200;
    const MAX_PER_HOUR = 2000;
    const safePoints = Math.min(Math.floor(points), MAX_PER_REQUEST);

    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentEarn = await db.select({
      pts: sql<number>`SUM(${schema.transactions.points})`,
    }).from(schema.transactions)
      .where(and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.type, type || 'earn'),
        gte(schema.transactions.createdAt, oneHourAgo)
      ));

    const earnedThisHour = Number(recentEarn[0]?.pts || 0);
    if (earnedThisHour + safePoints > MAX_PER_HOUR) {
      return res.json({ success: false, message: 'Earn rate limit reached. Try again later.' });
    }

    await incrementPoints(userId, safePoints);
    await db.insert(schema.transactions).values({
      userId, type: type || 'earn', points: safePoints,
      description: description || `+${safePoints} pts`,
    });

    res.json({ success: true, points: safePoints });
  } catch (err) {
    console.error('earn error:', err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ─── Daily claim streak info ───────────────────────────────────────────────────
app.get('/api/daily-streak/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const todayClaim = await db.select().from(schema.dailyClaims)
      .where(and(eq(schema.dailyClaims.userId, userId), eq(schema.dailyClaims.claimDate, today))).limit(1);

    const lastClaim = await db.select().from(schema.dailyClaims)
      .where(eq(schema.dailyClaims.userId, userId))
      .orderBy(desc(schema.dailyClaims.claimDate)).limit(1);

    const claimedToday = todayClaim.length > 0;
    const streak = lastClaim[0]?.dayStreak || 0;

    res.json({ claimedToday, streak });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ API server running on port ${PORT}`);
});
