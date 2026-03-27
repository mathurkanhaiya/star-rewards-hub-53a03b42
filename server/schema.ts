import { pgTable, uuid, text, bigint, boolean, timestamp, numeric, integer, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  telegramId: bigint('telegram_id', { mode: 'number' }).unique().notNull(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  photoUrl: text('photo_url'),
  level: integer('level').notNull().default(1),
  totalPoints: bigint('total_points', { mode: 'number' }).notNull().default(0),
  referralCode: text('referral_code').unique().notNull(),
  referredBy: bigint('referred_by', { mode: 'number' }),
  isBanned: boolean('is_banned').notNull().default(false),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const balances = pgTable('balances', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  points: bigint('points', { mode: 'number' }).notNull().default(0),
  starsBalance: numeric('stars_balance', { precision: 20, scale: 6 }).notNull().default('0'),
  usdtBalance: numeric('usdt_balance', { precision: 20, scale: 6 }).notNull().default('0'),
  tonBalance: numeric('ton_balance', { precision: 20, scale: 6 }).notNull().default('0'),
  totalEarned: bigint('total_earned', { mode: 'number' }).notNull().default(0),
  totalWithdrawn: bigint('total_withdrawn', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  taskType: text('task_type').notNull().default('social'),
  rewardPoints: bigint('reward_points', { mode: 'number' }).notNull().default(100),
  rewardStars: numeric('reward_stars', { precision: 10, scale: 4 }).notNull().default('0'),
  link: text('link'),
  icon: text('icon'),
  isActive: boolean('is_active').notNull().default(true),
  isRepeatable: boolean('is_repeatable').notNull().default(false),
  repeatHours: integer('repeat_hours').default(24),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userTasks = pgTable('user_tasks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  pointsEarned: bigint('points_earned', { mode: 'number' }).notNull().default(0),
  nextAvailableAt: timestamp('next_available_at', { withTimezone: true }),
});

export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  referrerId: uuid('referrer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  referredId: uuid('referred_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  pointsEarned: bigint('points_earned', { mode: 'number' }).notNull().default(0),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const withdrawals = pgTable('withdrawals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  pointsSpent: bigint('points_spent', { mode: 'number' }).notNull().default(0),
  amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
  walletAddress: text('wallet_address'),
  status: text('status').notNull().default('pending'),
  adminNote: text('admin_note'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  points: bigint('points', { mode: 'number' }).notNull().default(0),
  description: text('description'),
  referenceId: uuid('reference_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dailyClaims = pgTable('daily_claims', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  claimDate: date('claim_date').notNull().default(sql`CURRENT_DATE`),
  dayStreak: integer('day_streak').notNull().default(1),
  pointsEarned: bigint('points_earned', { mode: 'number' }).notNull().default(0),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const spinResults = pgTable('spin_results', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resultType: text('result_type').notNull(),
  pointsEarned: bigint('points_earned', { mode: 'number' }).notNull().default(0),
  starsEarned: numeric('stars_earned', { precision: 10, scale: 4 }).notNull().default('0'),
  spunAt: timestamp('spun_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adLogs = pgTable('ad_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  adType: text('ad_type').notNull(),
  rewardGiven: bigint('reward_given', { mode: 'number' }).notNull().default(0),
  provider: text('provider').notNull().default('adsgram'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contests = pgTable('contests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  contestType: text('contest_type').notNull().default('ads_watch'),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  reward1st: bigint('reward_1st', { mode: 'number' }).notNull().default(5000),
  reward2nd: bigint('reward_2nd', { mode: 'number' }).notNull().default(3000),
  reward3rd: bigint('reward_3rd', { mode: 'number' }).notNull().default(2000),
  reward4th: bigint('reward_4th', { mode: 'number' }).notNull().default(1000),
  reward5th: bigint('reward_5th', { mode: 'number' }).notNull().default(500),
  rewardsDistributed: boolean('rewards_distributed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contestEntries = pgTable('contest_entries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  contestId: uuid('contest_id').notNull().references(() => contests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  score: bigint('score', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const promos = pgTable('promos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  rewardPoints: bigint('reward_points', { mode: 'number' }).notNull().default(50),
  maxClaims: integer('max_claims').notNull().default(100),
  totalClaimed: integer('total_claimed').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const promoClaims = pgTable('promo_claims', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  promoId: uuid('promo_id').notNull().references(() => promos.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gamePlays = pgTable('game_plays', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameType: text('game_type').notNull(),
  pointsEarned: bigint('points_earned', { mode: 'number' }).notNull().default(0),
  playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
});
