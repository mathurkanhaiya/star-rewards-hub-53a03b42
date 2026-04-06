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
    params.delete('signature');
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

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('TG send error:', e); }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const initData = req.headers.get('x-telegram-init-data') || '';
    await req.json().catch(() => ({}));

    const validation = validateInitData(initData, botToken);
    if (!validation.valid || !validation.user) {
      return json({ success: false, message: 'Invalid session' }, 401);
    }

    const { data: dbUser } = await supabase.from('users').select('id, telegram_id')
      .eq('telegram_id', validation.user.id).single();
    if (!dbUser) return json({ success: false, message: 'User not found' }, 404);

    const userId = dbUser.id;
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('daily_claims').select('id').eq('user_id', userId).eq('claim_date', today).single();

    if (existing) {
      return json({ success: false, message: 'Already claimed today! Come back tomorrow 🌙' });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const { data: lastClaim } = await supabase
      .from('daily_claims').select('day_streak')
      .eq('user_id', userId).eq('claim_date', yesterday).single();

    const streak = lastClaim ? lastClaim.day_streak + 1 : 1;
    const basePoints = 100;
    const streakBonus = Math.min(streak * 10, 500);
    const totalPoints = basePoints + streakBonus;

    await supabase.from('daily_claims').insert({
      user_id: userId, claim_date: today, day_streak: streak, points_earned: totalPoints,
    });

    await supabase.rpc('increment_points', { p_user_id: userId, p_points: totalPoints });

    await supabase.from('transactions').insert({
      user_id: userId, type: 'daily', points: totalPoints,
      description: `🎁 Daily reward (Day ${streak} streak)`,
    });

    await sendTelegramMessage(dbUser.telegram_id,
      `🎁 <b>Daily Reward Claimed!</b>\n\n+${totalPoints} points\n🔥 Streak: Day ${streak}\n\nCome back tomorrow to keep your streak!`
    );

    return json({ success: true, points: totalPoints, streak });
  } catch (error) {
    console.error('daily-reward error:', error);
    return json({ success: false, message: (error as Error).message }, 500);
  }
});