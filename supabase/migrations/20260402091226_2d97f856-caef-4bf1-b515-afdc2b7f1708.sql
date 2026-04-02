
-- =============================================
-- PHASE 1: Lock down ALL open RLS policies
-- Replace permissive open policies with restrictive ones
-- Edge functions use service_role key which bypasses RLS
-- =============================================

-- Drop all open policies
DROP POLICY IF EXISTS "open_users" ON public.users;
DROP POLICY IF EXISTS "open_balances" ON public.balances;
DROP POLICY IF EXISTS "open_transactions" ON public.transactions;
DROP POLICY IF EXISTS "open_withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "open_tasks" ON public.tasks;
DROP POLICY IF EXISTS "open_user_tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "open_settings" ON public.settings;
DROP POLICY IF EXISTS "open_daily_claims" ON public.daily_claims;
DROP POLICY IF EXISTS "open_spin_results" ON public.spin_results;
DROP POLICY IF EXISTS "open_ad_logs" ON public.ad_logs;
DROP POLICY IF EXISTS "open_referrals" ON public.referrals;
DROP POLICY IF EXISTS "open_notifications" ON public.notifications;
DROP POLICY IF EXISTS "open_contests" ON public.contests;
DROP POLICY IF EXISTS "open_contest_entries" ON public.contest_entries;
DROP POLICY IF EXISTS "open_broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "open_admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "open_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "open_promos" ON public.promos;
DROP POLICY IF EXISTS "open_promo_claims" ON public.promo_claims;
DROP POLICY IF EXISTS "open_weekly_kings" ON public.weekly_kings;
DROP POLICY IF EXISTS "open_tower_runs" ON public.tower_runs;
DROP POLICY IF EXISTS "open_tower_leaderboard" ON public.tower_leaderboard;
DROP POLICY IF EXISTS "open_crash_rounds" ON public.crash_rounds;
DROP POLICY IF EXISTS "open_crash_leaderboard" ON public.crash_leaderboard;
DROP POLICY IF EXISTS "open_miner_progress" ON public.miner_progress;
DROP POLICY IF EXISTS "open_miner_leaderboard" ON public.miner_leaderboard;
DROP POLICY IF EXISTS "open_lab_progress" ON public.lab_progress;
DROP POLICY IF EXISTS "open_lab_leaderboard" ON public.lab_leaderboard;

-- =============================================
-- PUBLIC READ-ONLY tables (anyone can read, no write)
-- =============================================

-- Settings: read-only for all
CREATE POLICY "settings_read" ON public.settings FOR SELECT USING (true);

-- Tasks: read-only for all
CREATE POLICY "tasks_read" ON public.tasks FOR SELECT USING (true);

-- Contests: read-only for all
CREATE POLICY "contests_read" ON public.contests FOR SELECT USING (true);

-- Promos: read-only for all  
CREATE POLICY "promos_read" ON public.promos FOR SELECT USING (true);

-- =============================================
-- NO DIRECT ACCESS tables (edge functions only via service_role)
-- These tables have RLS enabled but NO policies = no anon access
-- Service role key bypasses RLS automatically
-- =============================================

-- users: no anon access
-- balances: no anon access
-- transactions: no anon access
-- withdrawals: no anon access
-- user_tasks: no anon access
-- daily_claims: no anon access
-- spin_results: no anon access
-- ad_logs: no anon access
-- referrals: no anon access
-- notifications: no anon access
-- contest_entries: no anon access
-- broadcasts: no anon access
-- admin_logs: no anon access
-- user_roles: no anon access
-- promo_claims: no anon access
-- weekly_kings: no anon access
-- tower_runs: no anon access
-- tower_leaderboard: no anon access
-- crash_rounds: no anon access
-- crash_leaderboard: no anon access
-- miner_progress: no anon access
-- miner_leaderboard: no anon access
-- lab_progress: no anon access
-- lab_leaderboard: no anon access
