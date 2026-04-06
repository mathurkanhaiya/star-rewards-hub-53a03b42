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
    const { method, points, walletAddress } = await req.json();

    const validation = validateInitData(initData, botToken);
    if (!validation.valid || !validation.user) {
      return json({ success: false, message: 'Invalid session' }, 401);
    }

    const { data: dbUser } = await supabase.from('users').select('id, telegram_id, username, first_name')
      .eq('telegram_id', validation.user.id).single();
    if (!dbUser) return json({ success: false, message: 'User not found' }, 404);

    const userId = dbUser.id;
    if (!method || !points) return json({ success: false, message: 'Missing fields' }, 400);

    const { data: settings } = await supabase.from('settings').select('key, value');
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

    const minPoints = parseInt(settingsMap.min_withdrawal_points || '10000');
    if (points < minPoints) {
      return json({ success: false, message: `Minimum withdrawal is ${minPoints.toLocaleString()} points` });
    }

    const rateKey = `${method}_conversion_rate`;
    const rate = parseInt(settingsMap[rateKey] || '1000');
    const amount = points / rate;

    const { data: balance } = await supabase.from('balances').select('points, total_withdrawn').eq('user_id', userId).single();
    if (!balance || balance.points < points) {
      return json({ success: false, message: 'Insufficient balance' });
    }

    const { count: pendingCount } = await supabase
      .from('withdrawals').select('id', { count: 'exact' })
      .eq('user_id', userId).eq('status', 'pending');

    const maxPending = parseInt(settingsMap.max_pending_withdrawals || '2');
    if ((pendingCount || 0) >= maxPending) {
      return json({ success: false, message: 'You have too many pending withdrawals' });
    }

    await supabase.from('withdrawals').insert({
      user_id: userId, method, points_spent: points, amount,
      wallet_address: walletAddress || null, status: 'pending',
    });

    await supabase.from('balances').update({
      points: balance.points - points,
      total_withdrawn: (balance.total_withdrawn || 0) + points,
    }).eq('user_id', userId);

    await supabase.from('transactions').insert({
      user_id: userId, type: 'spend', points: -points,
      description: `💸 Withdrawal request: ${amount.toFixed(2)} ${method.toUpperCase()}`,
    });

    await supabase.from('notifications').insert({
      user_id: userId,
      title: '💸 Withdrawal Submitted',
      message: `Your withdrawal of ${points.toLocaleString()} pts (${amount.toFixed(2)} ${method.toUpperCase()}) is pending review.`,
      type: 'withdrawal',
    });

    await sendTelegramMessage(dbUser.telegram_id,
      `💸 <b>Withdrawal Submitted</b>\n\nAmount: <b>${amount.toFixed(2)} ${method.toUpperCase()}</b>\nPoints spent: ${points.toLocaleString()}\n\nYour request is pending admin review.`
    );

    const adminTgId = Deno.env.get('ADMIN_TELEGRAM_ID');
    if (adminTgId) {
      await sendTelegramMessage(parseInt(adminTgId),
        `🔔 <b>New Withdrawal Request</b>\n\nUser: ${dbUser.first_name || 'Unknown'} (@${dbUser.username || 'N/A'})\nAmount: <b>${amount.toFixed(2)} ${method.toUpperCase()}</b>\nPoints: ${points.toLocaleString()}\nWallet: ${walletAddress || 'N/A'}`
      );
    }

    return json({ success: true, message: 'Withdrawal request submitted!' });
  } catch (error) {
    console.error('withdraw error:', error);
    return json({ success: false, message: (error as Error).message }, 500);
  }
});