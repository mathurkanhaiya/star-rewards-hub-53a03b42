import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function validateInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    if (!initData) return { valid: false };
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    // For bot-token validation, exclude only hash; signature stays in the payload if present
    params.delete('hash');
    const entries = Array.from(params.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) {
      console.error('Hash mismatch. Expected:', hash, 'Got:', computedHash);
      console.error('Data check string:', dataCheckString.substring(0, 200));
      return { valid: false };
    }
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return { valid: false };
    const userStr = params.get('user');
    const user = userStr ? JSON.parse(userStr) : null;
    return { valid: true, user };
  } catch (e) {
    console.error('initData validation error:', e);
    return { valid: false };
  }
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

    // Validate Telegram initData
    const initData = req.headers.get('x-telegram-init-data') || '';
    const { referralCode } = await req.json();

    const validation = validateInitData(initData, botToken);
    if (!validation.valid || !validation.user) {
      console.error('telegram-auth: initData validation failed, initData length:', initData.length);
      return json({ error: 'Invalid Telegram session' }, 401);
    }

    const telegramUser = validation.user;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramUser.id)
      .single();

    if (existingUser) {
      // Update last active and profile info
      await supabase
        .from('users')
        .update({
          last_active_at: new Date().toISOString(),
          photo_url: telegramUser.photo_url || existingUser.photo_url,
          first_name: telegramUser.first_name || existingUser.first_name,
          last_name: telegramUser.last_name || existingUser.last_name,
          username: telegramUser.username || existingUser.username,
        })
        .eq('id', existingUser.id);

      // Fetch balance for returning user
      const { data: balance } = await supabase
        .from('balances').select('*').eq('user_id', existingUser.id).single();

      // Fetch settings
      const { data: settingsRows } = await supabase.from('settings').select('key, value');
      const settings: Record<string, string> = {};
      (settingsRows || []).forEach((s: any) => { settings[s.key] = s.value; });

      // Fetch notifications
      const { data: notifs } = await supabase.from('notifications').select('*')
        .eq('user_id', existingUser.id).order('created_at', { ascending: false }).limit(30);

      const { count: unreadCount } = await supabase.from('notifications')
        .select('id', { count: 'exact' }).eq('user_id', existingUser.id).eq('is_read', false);

      return json({
        user: existingUser,
        balance: balance || null,
        settings,
        notifications: notifs || [],
        unreadCount: unreadCount || 0,
      });
    }

    // Create new user
    const referralCodeGen = `${telegramUser.id}`;

    let referrerId: string | null = null;
    if (referralCode && referralCode !== String(telegramUser.id)) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', parseInt(referralCode))
        .single();
      if (referrer) referrerId = referrer.id;
    }

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramUser.id,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name || null,
        username: telegramUser.username || null,
        photo_url: telegramUser.photo_url || null,
        referral_code: referralCodeGen,
        referred_by: referralCode ? parseInt(referralCode) : null,
      })
      .select()
      .single();

    if (userError) throw userError;

    await supabase.from('balances').insert({ user_id: newUser.id, points: 200 });

    const { data: settingsRows } = await supabase.from('settings').select('key, value');
    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

    const welcomeBonus = 200;
    const referralBonus = parseInt(settingsMap.points_per_referral || '500');
    const referredBonus = parseInt(settingsMap.referral_bonus_referred || '200');

    await supabase.from('transactions').insert({
      user_id: newUser.id, type: 'bonus', points: welcomeBonus,
      description: '🎉 Welcome bonus',
    });

    await sendTelegramMessage(telegramUser.id,
      `🎉 <b>Welcome to the app!</b>\n\nYou received <b>${welcomeBonus} points</b> as a welcome bonus!\n\nComplete tasks, spin the wheel, and invite friends to earn more! 🚀`
    );

    // Handle referral
    if (referrerId) {
      await supabase.from('referrals').insert({
        referrer_id: referrerId, referred_id: newUser.id,
        points_earned: referralBonus, is_verified: true,
      });

      await supabase.rpc('increment_points', { p_user_id: referrerId, p_points: referralBonus });
      await supabase.from('transactions').insert({
        user_id: referrerId, type: 'referral', points: referralBonus,
        description: `👥 Referral bonus from @${telegramUser.username || telegramUser.first_name}`,
      });

      await supabase.from('notifications').insert({
        user_id: referrerId,
        title: '👥 New Referral!',
        message: `@${telegramUser.username || telegramUser.first_name} joined using your link! +${referralBonus} points!`,
        type: 'referral',
      });

      const { data: referrerUser } = await supabase.from('users').select('telegram_id').eq('id', referrerId).single();
      if (referrerUser) {
        await sendTelegramMessage(referrerUser.telegram_id,
          `👥 <b>New Referral!</b>\n\n@${telegramUser.username || telegramUser.first_name} joined using your link!\n+${referralBonus} points added to your balance! 🎉`
        );
      }

      await supabase.rpc('increment_points', { p_user_id: newUser.id, p_points: referredBonus });
      await supabase.from('transactions').insert({
        user_id: newUser.id, type: 'referral', points: referredBonus,
        description: '🔗 Joined via referral bonus',
      });

      const now = new Date().toISOString();
      const { data: inviteContests } = await supabase
        .from('contests').select('id')
        .eq('contest_type', 'invite').eq('is_active', true)
        .lte('starts_at', now).gte('ends_at', now);

      if (inviteContests && inviteContests.length > 0) {
        for (const contest of inviteContests) {
          const { data: existing } = await supabase
            .from('contest_entries').select('id, score')
            .eq('contest_id', contest.id).eq('user_id', referrerId).single();

          if (existing) {
            await supabase.from('contest_entries').update({
              score: existing.score + 1, updated_at: now,
            }).eq('id', existing.id);
          } else {
            await supabase.from('contest_entries').insert({
              contest_id: contest.id, user_id: referrerId, score: 1,
            });
          }
        }
      }
    }

    // Fetch the new balance
    const { data: newBalance } = await supabase
      .from('balances').select('*').eq('user_id', newUser.id).single();

    return json({
      user: newUser,
      balance: newBalance || { points: welcomeBonus, total_earned: welcomeBonus },
      settings: settingsMap,
      notifications: [],
      unreadCount: 0,
    });

  } catch (error) {
    console.error('telegram-auth error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
