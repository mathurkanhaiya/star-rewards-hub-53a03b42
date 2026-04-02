import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-supabase-client-platform, x-supabase-client-platform-version',
};

// Validate Telegram WebApp initData using HMAC-SHA256
function validateInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };

    params.delete('hash');
    const entries = Array.from(params.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) return { valid: false };

    // Check auth_date is not too old (allow 24h window)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get initData from header
    const initData = req.headers.get('x-telegram-init-data') || '';
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) return json({ error: 'Missing action' }, 400);

    // Actions that don't require auth
    const publicActions = ['get_settings', 'get_tasks', 'get_active_contests', 'get_leaderboard'];
    
    let telegramUser: any = null;
    let dbUser: any = null;

    if (!publicActions.includes(action)) {
      // Validate initData for protected actions
      const validation = validateInitData(initData, botToken);
      if (!validation.valid || !validation.user) {
        return json({ error: 'Invalid or expired Telegram session' }, 401);
      }
      telegramUser = validation.user;

      // Get DB user
      const { data: u } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramUser.id)
        .single();

      if (!u) return json({ error: 'User not found' }, 404);
      if (u.is_banned) return json({ error: 'Account suspended' }, 403);
      dbUser = u;

      // Update last active
      await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', u.id);
    }

    // Route actions
    switch (action) {
      // ===== PUBLIC =====
      case 'get_settings': {
        const { data } = await supabase.from('settings').select('key, value');
        const settings: Record<string, string> = {};
        (data || []).forEach((s: any) => { settings[s.key] = s.value; });
        return json({ settings });
      }

      case 'get_tasks': {
        const { data } = await supabase.from('tasks').select('*').eq('is_active', true).order('display_order');
        return json({ tasks: data || [] });
      }

      case 'get_active_contests': {
        const { data } = await supabase.from('contests').select('*')
          .eq('is_active', true).gte('ends_at', new Date().toISOString()).order('ends_at');
        return json({ contests: data || [] });
      }

      case 'get_leaderboard': {
        const { data } = await supabase.from('leaderboard').select('*').limit(50);
        return json({ leaderboard: data || [] });
      }

      // ===== AUTHENTICATED =====
      case 'get_user': {
        const { data: bal } = await supabase.from('balances').select('*').eq('user_id', dbUser.id).single();
        return json({ user: dbUser, balance: bal });
      }

      case 'get_balance': {
        const { data } = await supabase.from('balances').select('*').eq('user_id', dbUser.id).single();
        return json({ balance: data });
      }

      case 'get_user_tasks': {
        const { data } = await supabase.from('user_tasks')
          .select('task_id, completed_at, next_available_at').eq('user_id', dbUser.id);
        return json({ userTasks: data || [] });
      }

      case 'get_notifications': {
        const { data } = await supabase.from('notifications').select('*')
          .eq('user_id', dbUser.id).order('created_at', { ascending: false }).limit(30);
        return json({ notifications: data || [] });
      }

      case 'get_unread_count': {
        const { count } = await supabase.from('notifications')
          .select('id', { count: 'exact' }).eq('user_id', dbUser.id).eq('is_read', false);
        return json({ count: count || 0 });
      }

      case 'mark_notification_read': {
        const { notifId } = body;
        if (!notifId) return json({ error: 'Missing notifId' }, 400);
        // Verify notification belongs to user
        const { data: notif } = await supabase.from('notifications').select('user_id').eq('id', notifId).single();
        if (!notif || notif.user_id !== dbUser.id) return json({ error: 'Not found' }, 404);
        await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
        return json({ success: true });
      }

      case 'get_referrals': {
        const { data } = await supabase.from('referrals').select('*')
          .eq('referrer_id', dbUser.id).order('created_at', { ascending: false });
        return json({ referrals: data || [] });
      }

      case 'get_transactions': {
        const { data } = await supabase.from('transactions').select('*')
          .eq('user_id', dbUser.id).order('created_at', { ascending: false }).limit(50);
        return json({ transactions: data || [] });
      }

      case 'get_withdrawals': {
        const { data } = await supabase.from('withdrawals').select('*')
          .eq('user_id', dbUser.id).order('created_at', { ascending: false });
        return json({ withdrawals: data || [] });
      }

      case 'get_daily_claim': {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('daily_claims').select('claimed_at')
          .eq('user_id', dbUser.id).eq('claim_date', today).maybeSingle();
        return json({ claim: data });
      }

      case 'get_spin_count': {
        const { data } = await supabase.from('spin_results').select('spun_at')
          .eq('user_id', dbUser.id).order('spun_at', { ascending: false }).limit(10);
        return json({ spins: data || [] });
      }

      case 'get_contest_leaderboard': {
        const { contestId } = body;
        if (!contestId) return json({ error: 'Missing contestId' }, 400);
        const { data } = await supabase.from('contest_entries')
          .select('user_id, score, updated_at').eq('contest_id', contestId)
          .order('score', { ascending: false }).limit(20);
        if (!data || data.length === 0) return json({ entries: [] });
        const userIds = data.map((d: any) => d.user_id);
        const { data: usersData } = await supabase.from('users')
          .select('id, first_name, username, photo_url, telegram_id').in('id', userIds);
        const userMap: Record<string, any> = {};
        (usersData || []).forEach((u: any) => { userMap[u.id] = u; });
        const entries = data.map((d: any) => ({
          user_id: d.user_id, score: d.score, users: userMap[d.user_id] || null,
        }));
        return json({ entries });
      }

      case 'get_points_leaderboard': {
        const { data } = await supabase.from('balances')
          .select('user_id, points, total_earned')
          .order('points', { ascending: false }).limit(50);
        if (!data || data.length === 0) return json({ leaderboard: [] });
        const userIds = data.map((d: any) => d.user_id);
        const { data: usersData } = await supabase.from('users')
          .select('id, first_name, username, photo_url, telegram_id, total_points, level')
          .in('id', userIds);
        const userMap: Record<string, any> = {};
        (usersData || []).forEach((u: any) => { userMap[u.id] = u; });
        const leaderboard = data.map((d: any, i: number) => ({
          id: d.user_id,
          telegram_id: userMap[d.user_id]?.telegram_id,
          first_name: userMap[d.user_id]?.first_name || 'User',
          username: userMap[d.user_id]?.username,
          photo_url: userMap[d.user_id]?.photo_url,
          total_points: d.points,
          current_points: d.points,
          level: userMap[d.user_id]?.level || 1,
          rank: i + 1,
        }));
        return json({ leaderboard });
      }

      // ===== ADMIN =====
      case 'admin_get_stats':
      case 'admin_get_users':
      case 'admin_get_withdrawals':
      case 'admin_update_withdrawal':
      case 'admin_update_setting':
      case 'admin_ban_user':
      case 'admin_adjust_balance':
      case 'admin_create_task':
      case 'admin_toggle_task':
      case 'admin_delete_task':
      case 'admin_get_contests':
      case 'admin_create_contest':
      case 'admin_end_contest':
      case 'admin_send_broadcast': {
        // Verify admin
        const adminId = parseInt(Deno.env.get('ADMIN_TELEGRAM_ID') || '0');
        if (telegramUser.id !== adminId) {
          return json({ error: 'Unauthorized' }, 403);
        }
        return await handleAdminAction(supabase, action, body, telegramUser);
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    console.error('secure-api error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});

async function handleAdminAction(supabase: any, action: string, body: any, telegramUser: any) {
  switch (action) {
    case 'admin_get_stats': {
      const [usersRes, withdrawalsRes, transactionsRes, adLogsRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('withdrawals').select('id, status', { count: 'exact' }),
        supabase.from('transactions').select('id', { count: 'exact' }),
        supabase.from('ad_logs').select('id', { count: 'exact' }),
      ]);
      return json({
        totalUsers: usersRes.count || 0,
        totalWithdrawals: withdrawalsRes.count || 0,
        pendingWithdrawals: (withdrawalsRes.data || []).filter((w: any) => w.status === 'pending').length,
        totalTransactions: transactionsRes.count || 0,
        totalAdViews: adLogsRes.count || 0,
      });
    }

    case 'admin_get_users': {
      const { data } = await supabase.from('users').select('*, balances(*)')
        .order('created_at', { ascending: false }).range(0, 9999999);
      return json({ users: data || [] });
    }

    case 'admin_get_withdrawals': {
      const { data } = await supabase.from('withdrawals')
        .select('*, users(first_name, username, telegram_id, photo_url)')
        .order('created_at', { ascending: false });
      return json({ withdrawals: data || [] });
    }

    case 'admin_update_withdrawal': {
      const { withdrawalId, status, adminNote } = body;
      // Forward to existing edge function logic
      const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/admin-withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ withdrawalId, status, adminNote }),
      });
      return json(await resp.json());
    }

    case 'admin_update_setting': {
      const { key, value } = body;
      const { data: existing } = await supabase.from('settings').select('id').eq('key', key).single();
      if (existing) {
        await supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
      } else {
        await supabase.from('settings').insert({ key, value, updated_at: new Date().toISOString() });
      }
      return json({ success: true });
    }

    case 'admin_ban_user': {
      const { userId, banned } = body;
      await supabase.from('users').update({ is_banned: banned }).eq('id', userId);
      return json({ success: true });
    }

    case 'admin_adjust_balance': {
      const { userId, points, reason } = body;
      const { data: balance } = await supabase.from('balances').select('points').eq('user_id', userId).single();
      if (!balance) return json({ success: false });
      const newPoints = Math.max(0, balance.points + points);
      await supabase.from('balances').update({ points: newPoints }).eq('user_id', userId);
      await supabase.from('transactions').insert({
        user_id: userId, type: points >= 0 ? 'admin_credit' : 'admin_debit',
        points, description: `🛡️ Admin: ${reason}`,
      });
      return json({ success: true });
    }

    case 'admin_create_task': {
      const { task } = body;
      const { data, error } = await supabase.from('tasks').insert([task]).select().single();
      return json({ success: !error, data });
    }

    case 'admin_toggle_task': {
      const { taskId, isActive } = body;
      await supabase.from('tasks').update({ is_active: isActive }).eq('id', taskId);
      return json({ success: true });
    }

    case 'admin_delete_task': {
      const { taskId } = body;
      await supabase.from('user_tasks').delete().eq('task_id', taskId);
      await supabase.from('tasks').delete().eq('id', taskId);
      return json({ success: true });
    }

    case 'admin_get_contests': {
      const { data } = await supabase.from('contests').select('*').order('created_at', { ascending: false });
      return json({ contests: data || [] });
    }

    case 'admin_create_contest': {
      const { contest } = body;
      const { data, error } = await supabase.from('contests').insert([contest]).select().single();
      return json({ success: !error, data });
    }

    case 'admin_end_contest': {
      const { contestId } = body;
      const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/distribute-contest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ contestId }),
      });
      return json(await resp.json());
    }

    case 'admin_send_broadcast': {
      const { message } = body;
      await supabase.from('broadcasts').insert({ message, sent_by: telegramUser.id });
      const { data: users } = await supabase.from('users').select('id');
      if (users && users.length > 0) {
        const notifs = users.map((u: any) => ({
          user_id: u.id, title: '📢 Announcement', message, type: 'info',
        }));
        for (let i = 0; i < notifs.length; i += 100) {
          await supabase.from('notifications').insert(notifs.slice(i, i + 100));
        }
      }
      return json({ success: true });
    }

    default:
      return json({ error: 'Unknown admin action' }, 400);
  }
}
