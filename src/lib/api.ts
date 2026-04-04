import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';

const EDGE_FN = `https://utfkqzmrcdfbnjdkjais.supabase.co/functions/v1`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getInitData(): string {
  try {
    return (window as any).Telegram?.WebApp?.initData || '';
  } catch {
    return '';
  }
}

// Secure API call — all requests go through the secure-api edge function
export async function secureCall(action: string, params: Record<string, any> = {}): Promise<any> {
  const response = await fetch(`${EDGE_FN}/secure-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': API_KEY,
      'x-telegram-init-data': getInitData(),
    },
    body: JSON.stringify({ action, ...params }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Secure game reward call
export async function claimGameReward(
  gameType: string,
  points: number,
  description: string,
  extra?: Record<string, any>
): Promise<{ success: boolean; points: number; balance?: any }> {
  try {
    const response = await fetch(`${EDGE_FN}/game-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'x-telegram-init-data': getInitData(),
      },
      body: JSON.stringify({ gameType, points, description, extra }),
    });
    return await response.json();
  } catch {
    return { success: false, points: 0 };
  }
}

// ==================== Public Functions ====================

export async function getSettings(): Promise<Record<string, string>> {
  const data = await secureCall('get_settings');
  return data.settings || {};
}

export async function getTasks(): Promise<Task[]> {
  const data = await secureCall('get_tasks');
  return (data.tasks as Task[]) || [];
}

export async function getActiveContests() {
  const data = await secureCall('get_active_contests');
  return data.contests || [];
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const data = await secureCall('get_leaderboard');
  return (data.leaderboard as LeaderboardEntry[]) || [];
}

// ==================== Auth ====================

export async function initUser(telegramUser: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}, referralCode?: string): Promise<{ user: AppUser | null; balance?: UserBalance | null; settings?: Record<string, string>; notifications?: any[]; unreadCount?: number }> {
  try {
    const response = await fetch(`${EDGE_FN}/telegram-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'x-telegram-init-data': getInitData(),
      },
      body: JSON.stringify({ referralCode }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('initUser failed:', data.error);
      return { user: null };
    }
    return {
      user: data.user || null,
      balance: data.balance || null,
      settings: data.settings || {},
      notifications: data.notifications || [],
      unreadCount: data.unreadCount || 0,
    };
  } catch (err) {
    console.error('initUser error:', err);
    return { user: null };
  }
}

// ==================== Authenticated User Functions ====================

export async function getUser(telegramId: number): Promise<AppUser | null> {
  try {
    const data = await secureCall('get_user');
    return data.user as AppUser || null;
  } catch {
    return null;
  }
}

export async function getUserBalance(userId: string): Promise<UserBalance | null> {
  try {
    const data = await secureCall('get_balance');
    return data.balance as UserBalance || null;
  } catch {
    return null;
  }
}

export async function getUserTasks(userId: string) {
  try {
    const data = await secureCall('get_user_tasks');
    return data.userTasks || [];
  } catch {
    return [];
  }
}

export async function getNotifications(userId: string) {
  try {
    const data = await secureCall('get_notifications');
    return data.notifications || [];
  } catch {
    return [];
  }
}

export async function getUnreadNotifCount(userId: string): Promise<number> {
  try {
    const data = await secureCall('get_unread_count');
    return data.count || 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(notifId: string) {
  await secureCall('mark_notification_read', { notifId });
}

export async function getTodayAdsCount(): Promise<number> {
  try {
    const data = await secureCall('get_today_ads');
    return data.count || 0;
  } catch {
    return 0;
  }
}

export async function getGameTodayCount(gameType: string): Promise<number> {
  try {
    const data = await secureCall('get_game_today_count', { gameType });
    return data.count || 0;
  } catch {
    return 0;
  }
}

export async function getTowerStats(): Promise<{ best_floor: number; total_runs: number }> {
  try {
    const data = await secureCall('get_tower_stats');
    return data.stats || { best_floor: 0, total_runs: 0 };
  } catch {
    return { best_floor: 0, total_runs: 0 };
  }
}

export async function getTowerLeaderboard() {
  try {
    const data = await secureCall('get_tower_leaderboard');
    return data.entries || [];
  } catch {
    return [];
  }
}

export async function getDropState(): Promise<{ claimedToday: boolean; streak: number }> {
  try {
    const data = await secureCall('get_drop_state');
    return { claimedToday: data.claimedToday || false, streak: data.streak || 0 };
  } catch {
    return { claimedToday: false, streak: 0 };
  }
}

export async function getReferrals(userId: string) {
  try {
    const data = await secureCall('get_referrals');
    return data.referrals || [];
  } catch {
    return [];
  }
}

export async function getTransactions(userId: string) {
  try {
    const data = await secureCall('get_transactions');
    return data.transactions || [];
  } catch {
    return [];
  }
}

export async function getWithdrawals(userId: string): Promise<Withdrawal[]> {
  try {
    const data = await secureCall('get_withdrawals');
    return (data.withdrawals as Withdrawal[]) || [];
  } catch {
    return [];
  }
}

export async function getDailyClaim(userId: string) {
  try {
    const data = await secureCall('get_daily_claim');
    return data.claim;
  } catch {
    return null;
  }
}

export async function getSpinCount(userId: string) {
  try {
    const data = await secureCall('get_spin_count');
    return data.spins || [];
  } catch {
    return [];
  }
}

// ===== Promos =====

export async function getActivePromos() {
  try {
    const data = await secureCall('get_active_promos');
    return { promos: data.promos || [], claimed: data.claimed || [] };
  } catch {
    return { promos: [], claimed: [] };
  }
}

export async function claimPromo(promoId: string) {
  return secureCall('claim_promo', { promoId });
}

// ==================== Actions (dedicated edge functions) ====================

export async function completeTask(userId: string, taskId: string): Promise<{ success: boolean; points?: number; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/complete-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ userId, taskId }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error completing task' };
  }
}

export async function claimDailyReward(userId: string): Promise<{ success: boolean; points?: number; streak?: number; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/daily-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ userId }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error claiming daily reward' };
  }
}

export async function spinWheel(userId: string): Promise<{ success: boolean; result?: string; points?: number; stars?: number; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/spin-wheel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ userId }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error spinning wheel' };
  }
}

export async function submitWithdrawal(
  userId: string, method: string, points: number, walletAddress?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ userId, method, points, walletAddress }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error submitting withdrawal' };
  }
}

export async function logAdWatch(userId: string, adType: string, rewardGiven: number) {
  try {
    const response = await fetch(`${EDGE_FN}/log-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ userId, adType, rewardGiven }),
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

// ==================== Leaderboard Functions ====================

export async function getContestLeaderboard(contestId: string) {
  try {
    const data = await secureCall('get_contest_leaderboard', { contestId });
    return data.entries || [];
  } catch {
    return [];
  }
}

export async function getAdWatchLeaderboard(contestId?: string) {
  if (contestId) return getContestLeaderboard(contestId);
  return [];
}

export async function getReferralLeaderboard() {
  return [];
}

// ==================== Admin Functions ====================

export async function adminGetStats() {
  return secureCall('admin_get_stats');
}

export async function adminGetUsers() {
  const data = await secureCall('admin_get_users');
  return data.users || [];
}

export async function adminGetWithdrawals() {
  const data = await secureCall('admin_get_withdrawals');
  return data.withdrawals || [];
}

export async function adminUpdateWithdrawal(withdrawalId: string, status: string, adminNote?: string) {
  return secureCall('admin_update_withdrawal', { withdrawalId, status, adminNote });
}

export async function adminUpdateSetting(key: string, value: string) {
  return secureCall('admin_update_setting', { key, value });
}

export async function adminBanUser(userId: string, banned: boolean) {
  return secureCall('admin_ban_user', { userId, banned });
}

export async function adminAdjustBalance(userId: string, points: number, reason: string) {
  return secureCall('admin_adjust_balance', { userId, points, reason });
}

export async function adminCreateTask(task: Omit<Task, 'id'>) {
  return secureCall('admin_create_task', { task });
}

export async function adminToggleTask(taskId: string, isActive: boolean) {
  return secureCall('admin_toggle_task', { taskId, isActive });
}

export async function adminDeleteTask(taskId: string) {
  return secureCall('admin_delete_task', { taskId });
}

export async function adminGetContests() {
  const data = await secureCall('admin_get_contests');
  return data.contests || [];
}

export async function adminCreateContest(contest: {
  title: string;
  contest_type: string;
  ends_at: string;
  reward_1st: number;
  reward_2nd: number;
  reward_3rd: number;
  reward_4th: number;
  reward_5th: number;
}) {
  return secureCall('admin_create_contest', { contest });
}

export async function adminEndContest(contestId: string) {
  return secureCall('admin_end_contest', { contestId });
}

export async function adminSendBroadcast(message: string, adminTelegramId: number) {
  return secureCall('admin_send_broadcast', { message });
}

// ===== Admin Promos =====

export async function adminGetPromos() {
  const data = await secureCall('admin_get_promos');
  return data.promos || [];
}

export async function adminCreatePromo(title: string, reward_points: number, max_claims: number) {
  return secureCall('admin_create_promo', { title, reward_points, max_claims });
}

export async function adminTogglePromo(promoId: string, isActive: boolean) {
  return secureCall('admin_toggle_promo', { promoId, isActive });
}

export async function adminDeletePromo(promoId: string) {
  return secureCall('admin_delete_promo', { promoId });
}

// ===== Admin User Activity =====

export async function adminGetUserActivity(userId: string) {
  return secureCall('admin_get_user_activity', { userId });
}