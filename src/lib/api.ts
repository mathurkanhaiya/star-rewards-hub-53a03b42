import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';

const API = '/api';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

function adminHeaders(telegramId: number) {
  return { 'Content-Type': 'application/json', 'x-admin-telegram-id': String(telegramId) };
}

export async function initUser(telegramUser: {
  id: number; first_name: string; last_name?: string; username?: string; photo_url?: string;
}, referralCode?: string): Promise<AppUser | null> {
  try {
    const data = await apiFetch('/auth', { method: 'POST', body: JSON.stringify({ telegramUser, referralCode }) });
    return data.user || null;
  } catch { return null; }
}

export async function getUser(telegramId: number): Promise<AppUser | null> {
  try { return await apiFetch(`/user/${telegramId}`); } catch { return null; }
}

export async function getUserBalance(userId: string): Promise<UserBalance | null> {
  try { return await apiFetch(`/balance/${userId}`); } catch { return null; }
}

export async function getTasks(): Promise<Task[]> {
  try { return (await apiFetch('/tasks')) || []; } catch { return []; }
}

export async function getUserTasks(userId: string) {
  try { return (await apiFetch(`/tasks/completed/${userId}`)) || []; } catch { return []; }
}

export async function completeTask(userId: string, taskId: string) {
  try { return await apiFetch('/tasks/complete', { method: 'POST', body: JSON.stringify({ userId, taskId }) }); }
  catch { return { success: false, message: 'Error completing task' }; }
}

export async function claimDailyReward(userId: string) {
  try { return await apiFetch('/daily-reward', { method: 'POST', body: JSON.stringify({ userId }) }); }
  catch { return { success: false, message: 'Error claiming daily reward' }; }
}

export async function spinWheel(userId: string) {
  try { return await apiFetch('/spin', { method: 'POST', body: JSON.stringify({ userId }) }); }
  catch { return { success: false, message: 'Error spinning wheel' }; }
}

export async function submitWithdrawal(userId: string, method: string, points: number, walletAddress?: string) {
  try { return await apiFetch('/withdraw', { method: 'POST', body: JSON.stringify({ userId, method, points, walletAddress }) }); }
  catch { return { success: false, message: 'Error submitting withdrawal' }; }
}

export async function getWithdrawals(userId: string): Promise<Withdrawal[]> {
  try { return (await apiFetch(`/withdrawals/${userId}`)) || []; } catch { return []; }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try { return (await apiFetch('/leaderboard')) || []; } catch { return []; }
}

export async function getReferrals(userId: string) {
  try { return (await apiFetch(`/referrals/${userId}`)) || []; } catch { return []; }
}

export async function getTransactions(userId: string) {
  try { return (await apiFetch(`/transactions/${userId}`)) || []; } catch { return []; }
}

export async function logAdWatch(userId: string, adType: string, rewardGiven: number) {
  try { return await apiFetch('/ads/log', { method: 'POST', body: JSON.stringify({ userId, adType, rewardGiven }) }); }
  catch { return { success: false }; }
}

export async function getSettings(): Promise<Record<string, string>> {
  try { return (await apiFetch('/settings')) || {}; } catch { return {}; }
}

export async function getDailyClaim(userId: string) {
  try { return await apiFetch(`/daily-claim/${userId}`); } catch { return null; }
}

export async function getSpinCount(userId: string) {
  try { return (await apiFetch(`/spins/${userId}`)) || []; } catch { return []; }
}

export async function getNotifications(userId: string) {
  try { return (await apiFetch(`/notifications/${userId}`)) || []; } catch { return []; }
}

export async function markNotificationRead(notifId: string) {
  try { await apiFetch(`/notifications/${notifId}/read`, { method: 'PATCH' }); } catch { /* ignore */ }
}

export async function getUnreadNotifCount(userId: string): Promise<number> {
  try {
    const data = await apiFetch(`/notifications/${userId}/unread`);
    return data?.count || 0;
  } catch { return 0; }
}

export async function getActiveContests() {
  try { return (await apiFetch('/contests/active')) || []; } catch { return []; }
}

export async function getContestLeaderboard(contestId: string) {
  try { return (await apiFetch(`/contests/${contestId}/leaderboard`)) || []; } catch { return []; }
}

export async function claimPromo(promoId: string, userId: string) {
  try { return await apiFetch('/promos/claim', { method: 'POST', body: JSON.stringify({ promoId, userId }) }); }
  catch { return { success: false }; }
}

// ── Game reward (all games must use this — server enforces limits + caps) ──────
export async function submitGameReward(userId: string, gameType: string, pointsWon: number) {
  try { return await apiFetch('/game/reward', { method: 'POST', body: JSON.stringify({ userId, gameType, pointsWon }) }); }
  catch { return { success: false, message: 'Error recording game reward' }; }
}

export async function checkGamePlays(userId: string, gameType: string) {
  try { return await apiFetch(`/game/check/${userId}/${gameType}`); }
  catch { return { canPlay: false, playsToday: 0, maxPlaysPerDay: 5 }; }
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function adminGetStats(adminTelegramId: number) {
  try { return await fetch(`${API}/admin/stats`, { headers: adminHeaders(adminTelegramId) }).then(r => r.json()); }
  catch { return {}; }
}

export async function adminGetUsers(adminTelegramId: number) {
  try { return (await fetch(`${API}/admin/users`, { headers: adminHeaders(adminTelegramId) }).then(r => r.json())) || []; }
  catch { return []; }
}

export async function adminGetWithdrawals(adminTelegramId: number) {
  try { return (await fetch(`${API}/admin/withdrawals`, { headers: adminHeaders(adminTelegramId) }).then(r => r.json())) || []; }
  catch { return []; }
}

export async function adminUpdateWithdrawal(withdrawalId: string, status: string, adminNote: string | undefined, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/withdrawal`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ withdrawalId, status, adminNote, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminUpdateSetting(key: string, value: string, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/settings`, {
      method: 'PUT', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ key, value, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminBanUser(userId: string, banned: boolean, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/ban`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ userId, banned, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminAdjustBalance(userId: string, points: number, reason: string, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/adjust-balance`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ userId, points, reason, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminCreateTask(task: Omit<Task, 'id'>, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/tasks`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ ...task, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminToggleTask(taskId: string, isActive: boolean, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/tasks/${taskId}/toggle`, {
      method: 'PUT', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ isActive, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminDeleteTask(taskId: string, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/tasks/${taskId}`, {
      method: 'DELETE', headers: adminHeaders(adminTelegramId),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminGetContests(adminTelegramId: number) {
  try { return (await fetch(`${API}/admin/contests`, { headers: adminHeaders(adminTelegramId) }).then(r => r.json())) || []; }
  catch { return []; }
}

export async function adminCreateContest(contest: object, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/contests`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ ...contest, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminEndContest(contestId: string, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/contests/${contestId}/distribute`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminSendBroadcast(message: string, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/broadcast`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ message, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminGetPromos(adminTelegramId: number) {
  try { return (await fetch(`${API}/admin/promos`, { headers: adminHeaders(adminTelegramId) }).then(r => r.json())) || []; }
  catch { return []; }
}

export async function adminCreatePromo(promo: object, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/promos`, {
      method: 'POST', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ ...promo, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

export async function adminTogglePromo(promoId: string, isActive: boolean, adminTelegramId: number) {
  try {
    return await fetch(`${API}/admin/promos/${promoId}/toggle`, {
      method: 'PUT', headers: adminHeaders(adminTelegramId),
      body: JSON.stringify({ isActive, adminTelegramId }),
    }).then(r => r.json());
  } catch { return { success: false }; }
}

// ── General earn (tap, farm, etc.) ───────────────────────────────────────────
export async function earnPoints(userId: string, points: number, type: string, description: string) {
  try { return await apiFetch('/earn', { method: 'POST', body: JSON.stringify({ userId, points, type, description }) }); }
  catch { return { success: false }; }
}

export async function getDailyStreak(userId: string): Promise<{ claimedToday: boolean; streak: number }> {
  try { return await apiFetch(`/daily-streak/${userId}`); }
  catch { return { claimedToday: false, streak: 0 }; }
}

// Legacy exports kept for compatibility
export async function getAdWatchLeaderboard(contestId?: string) {
  if (contestId) return getContestLeaderboard(contestId);
  return [];
}

export async function getReferralLeaderboard() { return []; }
