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

const SPIN_PRIZES = [
  { type: 'points', points: 10, stars: 0, probability: 0.30 },
  { type: 'points', points: 15, stars: 0, probability: 0.25 },
  { type: 'points', points: 20, stars: 0, probability: 0.15 },
  { type: 'points', points: 30, stars: 0, probability: 0.08 },
  { type: 'points', points: 25, stars: 0, probability: 0.05 },
  { type: 'stars', points: 17, stars: 0, probability: 0.07 },
  { type: 'stars', points: 35, stars: 0, probability: 0.03 },
  { type: 'empty', points: 0, stars: 0, probability: 0.07 },
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
    const { count } = await supabase
      .from('spin_results').select('id', { count: 'exact' })
      .eq('user_id', userId).gte('spun_at', `${today}T00:00:00Z`);

    const maxSpins = 3;
    if ((count || 0) >= maxSpins) {
      return json({ success: false, message: 'Daily spin limit reached! Come back tomorrow.' });
    }

    const prize = selectPrize();

    await supabase.from('spin_results').insert({
      user_id: userId, result_type: prize.type,
      points_earned: prize.points, stars_earned: prize.stars,
    });

    if (prize.type !== 'empty' && prize.points > 0) {
      await supabase.rpc('increment_points', { p_user_id: userId, p_points: prize.points });

      await supabase.from('transactions').insert({
        user_id: userId, type: 'spin', points: prize.points,
        description: `🎡 Spin: ${prize.points} points won!`,
      });
    }

    const usedSpins = (count || 0) + 1;
    if (usedSpins >= maxSpins) {
      await sendTelegramMessage(dbUser.telegram_id,
        `🎡 <b>Spins Used Up!</b>\n\nYou've used all ${maxSpins} spins today.\nCome back tomorrow for more! ⏰`
      );
    }

    return json({ success: true, result: prize.type, points: prize.points, stars: prize.stars });
  } catch (error) {
    console.error('spin-wheel error:', error);
    return json({ success: false, message: (error as Error).message }, 500);
  }
});