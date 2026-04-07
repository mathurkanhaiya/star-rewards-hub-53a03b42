import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-supabase-client-platform, x-supabase-client-platform-version',
};

function validateInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    params.delete('hash');
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) return { valid: false };
    const authDate = parseInt(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return { valid: false };
    const userStr = params.get('user');
    return { valid: true, user: userStr ? JSON.parse(userStr) : null };
  } catch { return { valid: false }; }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Max reward caps per game type to prevent abuse
const MAX_REWARDS: Record<string, number> = {
  tap_earn: 200,
  daily_drop: 500,
  dice_roll: 500,
  card_flip: 500,
  number_guess: 500,
  lucky_box: 500,
  tower_climb: 2000,
  ad_reward: 200,
  farm_collect: 200,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const initData = req.headers.get('x-telegram-init-data') || '';
    const validation = validateInitData(initData, botToken);
    if (!validation.valid || !validation.user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const body = await req.json();
    const { gameType, points, description, extra } = body;

    if (!gameType || typeof points !== 'number') {
      return json({ error: 'Missing gameType or points' }, 400);
    }

    if (gameType === 'daily_drop') {
      const claimDate = extra?.claimDate;

      if (!claimDate) {
        return json({ error: 'Missing claimDate' }, 400);
      }

      const { data: existingClaim } = await supabase.from('daily_claims')
        .select('id')
        .eq('user_id', dbUser.id)
        .eq('claim_date', claimDate)
        .maybeSingle();

      if (existingClaim) {
        return json({ success: false, error: 'Daily drop already claimed' }, 409);
      }
    }

    // Cap rewards to prevent manipulation
    const maxReward = MAX_REWARDS[gameType] || 500;
    const safePoints = Math.min(Math.max(0, Math.floor(points)), maxReward);

    if (safePoints <= 0) {
      return json({ success: true, points: 0 });
    }

    // Get user
    const { data: dbUser } = await supabase.from('users').select('id, is_banned')
      .eq('telegram_id', validation.user.id).single();
    if (!dbUser) return json({ error: 'User not found' }, 404);
    if (dbUser.is_banned) return json({ error: 'Account suspended' }, 403);

    // Update balance atomically
    await supabase.rpc('increment_points', { p_user_id: dbUser.id, p_points: safePoints });

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: dbUser.id,
      type: gameType,
      points: safePoints,
      description: description || `${gameType}: +${safePoints} pts`,
    });

    // Handle game-specific extra data
    if (extra) {
      const floorsReached = Number(extra.floorsReached ?? extra.floors_reached ?? 0);

      if (gameType === 'tower_climb' && floorsReached > 0) {
        await handleTowerClimb(supabase, dbUser.id, floorsReached, safePoints);
      }
      if (gameType === 'daily_drop' && extra.claimDate) {
        await supabase.from('daily_claims').insert({
          user_id: dbUser.id,
          claim_date: extra.claimDate,
          claimed_at: new Date().toISOString(),
          points_earned: safePoints,
        });
      }
    }

    // Get updated balance
    const { data: newBal } = await supabase.from('balances').select('points, total_earned')
      .eq('user_id', dbUser.id).single();

    return json({ success: true, points: safePoints, balance: newBal });
  } catch (error) {
    console.error('game-reward error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});

async function handleTowerClimb(supabase: any, userId: string, floorsReached: number, points: number) {
  await supabase.from('tower_runs').insert({
    user_id: userId, floors_reached: floorsReached, points_earned: points,
  });

  const { data: existing } = await supabase.from('tower_leaderboard')
    .select('id, best_floor, total_runs, total_floors').eq('user_id', userId).maybeSingle();
  
  if (existing) {
    await supabase.from('tower_leaderboard').update({
      best_floor: Math.max(existing.best_floor, floorsReached),
      total_floors: existing.total_floors + floorsReached,
      total_runs: existing.total_runs + 1,
    }).eq('id', existing.id);
  } else {
    await supabase.from('tower_leaderboard').insert({
      user_id: userId, best_floor: floorsReached, total_floors: floorsReached, total_runs: 1,
    });
  }
}
