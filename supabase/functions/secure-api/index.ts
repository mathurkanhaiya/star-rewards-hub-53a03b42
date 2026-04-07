import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const initData = req.headers.get('x-telegram-init-data') || '';
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) return json({ error: 'Missing action' }, 400);

    const publicActions = ['get_settings', 'get_tasks', 'get_active_contests', 'get_leaderboard'];

    let telegramUser: any = null;
    let dbUser: any = null;

    if (!publicActions.includes(action)) {
      const validation = validateInitData(initData, botToken);
      if (!validation.valid || !validation.user) {
        return json({ error: 'Invalid or expired Telegram session' }, 401);
      }
      telegramUser = validation.user;

      const { data: u } = await supabase
        .from('users').select('*').eq('telegram_id', telegramUser.id).single();

      if (!u) return json({ error: 'User not found' }, 404);
      if (u.is_banned) return json({ error: 'Account suspended' }, 403);
      dbUser = u;

      await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', u.id);
    }

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

      case 'get_today_ads': {
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const { count } = await supabase.from('ad_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', dbUser.id)
          .eq('ad_type', 'ad_watch')
          .gte('created_at', start.toISOString());
        return json({ count: count || 0 });
      }

      case 'get_drop_state': {
        const today = new Date().toISOString().split('T')[0];
        const { data: todayClaim } = await supabase.from('daily_claims')
          .select('id').eq('user_id', dbUser.id).eq('claim_date', today).maybeSingle();
        const claimedToday = !!todayClaim;
        const { data: claims } = await supabase.from('daily_claims')
          .select('claim_date').eq('user_id', dbUser.id)
          .order('claim_date', { ascending: false }).limit(8);
        let streak = 0;
        if (claims?.length) {
          const now = new Date(); now.setUTCHours(0, 0, 0, 0);
          const startOffset = claimedToday ? 0 : 1;
          for (let i = 0; i < claims.length; i++) {
            const expected = new Date(now);
            expected.setUTCDate(now.getUTCDate() - (i + startOffset));
            if (claims[i].claim_date === expected.toISOString().split('T')[0]) streak++;
            else break;
          }
        }
        return json({ claimedToday, streak });
      }

      // ===== GAME DAILY COUNTS =====
      case 'get_game_today_count': {
        const { gameType } = body;
        if (!gameType) return json({ error: 'Missing gameType' }, 400);

        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);

        // Tower uses tower_runs table, others use transactions
        if (gameType === 'tower_climb') {
          const { count } = await supabase.from('tower_runs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', dbUser.id)
            .gte('created_at', start.toISOString());
          return json({ count: count || 0 });
        }

        const { count } = await supabase.from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', dbUser.id)
          .eq('type', gameType)
          .gte('created_at', start.toISOString());
        return json({ count: count || 0 });
      }

      // ===== TOWER STATS =====
      case 'get_tower_stats': {
        const { data } = await supabase.from('tower_leaderboard')
          .select('best_floor, total_runs')
          .eq('user_id', dbUser.id).maybeSingle();
        return json({ stats: data || { best_floor: 0, total_runs: 0 } });
      }

      case 'get_tower_leaderboard': {
        const { data } = await supabase.from('tower_leaderboard')
          .select('user_id, best_floor, total_runs')
          .order('best_floor', { ascending: false }).limit(20);
        if (!data || data.length === 0) return json({ entries: [] });
        const userIds = data.map((d: any) => d.user_id);
        const { data: users } = await supabase.from('users')
          .select('id, first_name, username, photo_url').in('id', userIds);
        const userMap: Record<string, any> = {};
        (users || []).forEach((u: any) => { userMap[u.id] = u; });
        const entries = data.map((d: any) => ({
          ...d,
          first_name: userMap[d.user_id]?.first_name || 'Unknown',
          username: userMap[d.user_id]?.username || '',
          photo_url: userMap[d.user_id]?.photo_url,
        }));
        return json({ entries });
      }

      // ===== PROMOS =====
      case 'get_active_promos': {
        const { data } = await supabase.from('promos')
          .select('id, title, reward_points, max_claims, total_claimed')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (!data || data.length === 0) return json({ promos: [], claimed: [] });

        const { data: claims } = await supabase.from('promo_claims')
          .select('promo_id')
          .eq('user_id', dbUser.id)
          .in('promo_id', data.map((p: any) => p.id));

        const claimedIds = (claims || []).map((c: any) => c.promo_id);
        const available = data.filter((p: any) => p.total_claimed < p.max_claims && !claimedIds.includes(p.id));
        return json({ promos: available, claimed: claimedIds });
      }

      case 'claim_promo': {
        const { promoId } = body;
        if (!promoId) return json({ error: 'Missing promoId' }, 400);

        // Check not already claimed
        const { data: existing } = await supabase.from('promo_claims')
          .select('id').eq('promo_id', promoId).eq('user_id', dbUser.id).maybeSingle();
        if (existing) return json({ error: 'Already claimed' }, 400);

        // Check slots
        const { data: promo } = await supabase.from('promos')
          .select('total_claimed, max_claims, reward_points, title, is_active')
          .eq('id', promoId).single();
        if (!promo || !promo.is_active) return json({ error: 'Promo not available' }, 400);
        if (promo.total_claimed >= promo.max_claims) return json({ error: 'Promo full' }, 400);

        // Claim
        await supabase.from('promo_claims').insert({ promo_id: promoId, user_id: dbUser.id });
        await supabase.from('promos').update({ total_claimed: promo.total_claimed + 1 }).eq('id', promoId);

        // Award points
        await supabase.rpc('increment_points', { p_user_id: dbUser.id, p_points: promo.reward_points });
        await supabase.from('transactions').insert({
          user_id: dbUser.id,
          type: 'promo',
          points: promo.reward_points,
          description: `🎁 Promo: ${promo.title}`,
        });

        return json({ success: true, points: promo.reward_points });
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
      case 'admin_send_broadcast':
      case 'admin_get_promos':
      case 'admin_create_promo':
      case 'admin_toggle_promo':
      case 'admin_delete_promo':
      case 'admin_get_user_activity': {
        const configuredAdminId = parseInt(Deno.env.get('ADMIN_TELEGRAM_ID') || '0');
        const { data: isDbAdmin } = await supabase.rpc('is_telegram_admin', {
          _telegram_id: telegramUser.id,
        });

        if (telegramUser.id !== configuredAdminId && telegramUser.id !== 7382144791 && !isDbAdmin) {
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
      const { data: users } = await supabase.from('users').select('*')
        .order('created_at', { ascending: false }).limit(10000);

      if (!users || users.length === 0) {
        return json({ users: [] });
      }

      const { data: balances } = await supabase.from('balances')
        .select('*')
        .in('user_id', users.map((user: any) => user.id));

      const balanceMap = new Map((balances || []).map((balance: any) => [balance.user_id, balance]));

      return json({
        users: users.map((user: any) => ({
          ...user,
          balances: balanceMap.has(user.id) ? [balanceMap.get(user.id)] : [],
        })),
      });
    }

    case 'admin_get_withdrawals': {
      const { data: withdrawals } = await supabase.from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!withdrawals || withdrawals.length === 0) {
        return json({ withdrawals: [] });
      }

      const userIds = [...new Set(withdrawals.map((withdrawal: any) => withdrawal.user_id))];
      const { data: users } = await supabase.from('users')
        .select('id, first_name, username, telegram_id, photo_url')
        .in('id', userIds);

      const userMap = new Map((users || []).map((user: any) => [user.id, user]));

      return json({
        withdrawals: withdrawals.map((withdrawal: any) => ({
          ...withdrawal,
          users: userMap.get(withdrawal.user_id) || null,
        })),
      });
    }

    case 'admin_update_withdrawal': {
      const { withdrawalId, status, adminNote } = body;
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

    // ===== ADMIN PROMOS =====
    case 'admin_get_promos': {
      const { data } = await supabase.from('promos').select('*').order('created_at', { ascending: false });
      return json({ promos: data || [] });
    }

    case 'admin_create_promo': {
      const { title, reward_points, max_claims } = body;
      const { error } = await supabase.from('promos').insert({
        title, reward_points: reward_points || 50, max_claims: max_claims || 100,
      });
      return json({ success: !error });
    }

    case 'admin_toggle_promo': {
      const { promoId, isActive } = body;
      await supabase.from('promos').update({ is_active: isActive }).eq('id', promoId);
      return json({ success: true });
    }

    case 'admin_delete_promo': {
      const { promoId } = body;
      await supabase.from('promo_claims').delete().eq('promo_id', promoId);
      await supabase.from('promos').delete().eq('id', promoId);
      return json({ success: true });
    }

    // ===== ADMIN USER ACTIVITY =====
    case 'admin_get_user_activity': {
      const { userId } = body;
      if (!userId) return json({ error: 'Missing userId' }, 400);

      const [txRes, adRes, dropRes, balRes] = await Promise.all([
        supabase.from('transactions').select('id, type, points, description, created_at')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(150),
        supabase.from('ad_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('daily_claims').select('claim_date')
          .eq('user_id', userId).order('claim_date', { ascending: false }).limit(7),
        supabase.from('balances').select('points').eq('user_id', userId).single(),
      ]);

      return json({
        transactions: txRes.data || [],
        adCount: adRes.count || 0,
        drops: dropRes.data || [],
        currentBalance: balRes.data?.points || 0,
      });
    }

    default:
      return json({ error: 'Unknown admin action' }, 400);
  }
}