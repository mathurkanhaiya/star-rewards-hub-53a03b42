
-- For realtime to work, we need the leaderboard view accessible
-- The leaderboard view is already accessible since it reads from users/balances
-- which service_role can access

-- No additional policies needed — we'll switch to polling in the frontend
-- since Telegram users don't have Supabase auth.uid()
SELECT 1;
