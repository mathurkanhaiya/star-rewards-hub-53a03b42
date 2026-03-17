import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { getTasks, getUserTasks, completeTask, logAdWatch } from '@/lib/api';
import { Task } from '@/types/telegram';
import { useRewardedAd } from '@/hooks/useAdsgram';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

/* ===============================
   COLORS
================================ */
const TASK_COLORS: Record<string, string> = {
  social: '#22d3ee',
  daily: '#facc15',
  referral: '#22c55e',
  video: '#a855f7',
  special: '#ef4444',
};

export default function TasksPage() {
  const { user, refreshBalance } = useApp();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  /* ===============================
     PROMO STATE
  =================================*/
  const [promoLoading, setPromoLoading] = useState(false);

  /* ===============================
     ADSGRAM (PROMO)
  =================================*/
  const onAdsgramDone = useCallback(() => {
    console.log("Adsgram done");
  }, []);

  const { showAd: showAdsgramAd } = useRewardedAd(onAdsgramDone);

  /* ===============================
     PROMO CLAIM (DOUBLE AD)
  =================================*/
  const handlePromoClaim = async () => {
    if (!user || promoLoading) return;

    triggerHaptic("impact");
    setPromoLoading(true);

    try {
      // 1️⃣ Adsgram
      await showAdsgramAd();

      // 2️⃣ Monetag
      if (!(window as any).show_10742752) {
        throw new Error("Monetag not ready");
      }

      await (window as any).show_10742752();

      // 3️⃣ Reward
      await logAdWatch(user.id, "promo_double_ad", 100);
      await refreshBalance();

      triggerHaptic("success");
      alert("🎉 You earned +100 pts!");

    } catch (err) {
      console.error("Promo failed", err);
      triggerHaptic("error");
      alert("❌ Watch both ads to earn reward");
    }

    setPromoLoading(false);
  };

  /* ===============================
     LOAD DATA
  =================================*/
  async function loadData() {
    if (!user) return;

    setLoading(true);

    const [allTasks, userTasksList] = await Promise.all([
      getTasks(),
      getUserTasks(user.id),
    ]);

    const completedIds = new Set(
      (userTasksList as Array<{ task_id: string }>).map(ut => ut.task_id)
    );

    setCompletedTaskIds(completedIds);

    let available = allTasks.filter(task => {
      const isCompleted = completedIds.has(task.id);
      return task.is_repeatable || !isCompleted;
    });

    available.sort((a, b) => b.reward_points - a.reward_points);

    setTasks(available);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  /* ===============================
     COMPLETE TASK
  =================================*/
  async function handleComplete(task: Task) {
    if (!user || completing) return;

    triggerHaptic();
    setCompleting(task.id);

    try {
      if (task.link) {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.openTelegramLink(task.link);
        } else {
          window.open(task.link, '_blank');
        }
      }

      const result = await completeTask(user.id, task.id);

      if (result.success) {
        triggerHaptic('success');

        setMessage({
          id: task.id,
          text: `+${result.points} pts earned! 🎉`,
          success: true
        });

        setTasks(prev => prev.filter(t => t.id !== task.id));
        setCompletedTaskIds(prev => new Set([...prev, task.id]));

        await refreshBalance();
      } else {
        throw new Error(result.message);
      }

    } catch (err: any) {
      triggerHaptic('error');

      setMessage({
        id: task.id,
        text: err.message || 'Task failed',
        success: false
      });
    }

    setCompleting(null);
    setTimeout(() => setMessage(null), 3000);
  }

  /* ===============================
     FILTER
  =================================*/
  const filteredTasks = useMemo(() => {
    return filter === 'all'
      ? tasks
      : tasks.filter(t => t.task_type === filter);
  }, [tasks, filter]);

  const filters = ['all', 'social', 'daily', 'referral', 'video', 'special'];

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Tasks</h2>
        <p className="text-xs text-gray-400">
          Complete tasks & earn rewards
        </p>
      </div>

      {/* FILTERS */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => {
              triggerHaptic();
              setFilter(f);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold capitalize"
            style={{
              background:
                filter === f
                  ? 'linear-gradient(135deg,#facc15,#f97316)'
                  : '#111827',
              color: filter === f ? '#111' : '#9ca3af',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 🔥 PROMO (DOUBLE AD) */}
      <div className="mb-6 rounded-2xl p-5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">🎁 Special Promo</div>
            <div className="text-xs text-gray-400">
              Watch 2 ads & earn big reward
            </div>
          </div>

          <button
            onClick={handlePromoClaim}
            disabled={promoLoading}
            className="px-4 py-2 rounded-xl font-bold text-black bg-gradient-to-r from-yellow-400 to-orange-500"
          >
            {promoLoading ? "Loading..." : "Claim +100"}
          </button>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="text-center text-gray-400 text-sm">
          Loading tasks...
        </div>
      )}

      {/* EMPTY */}
      {!loading && filteredTasks.length === 0 && (
        <div className="text-center text-gray-400 text-sm">
          🎉 No tasks available right now
        </div>
      )}

      {/* TASK LIST */}
      <div className="space-y-4">
        {filteredTasks.map(task => {
          const isCompleting = completing === task.id;
          const color = TASK_COLORS[task.task_type] || '#facc15';

          return (
            <div
              key={task.id}
              className="rounded-3xl p-5"
              style={{
                background: 'linear-gradient(145deg,#0f172a,#1e293b)',
                border: `1px solid ${color}40`,
              }}
            >
              <div className="flex items-center gap-4">

                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: `${color}20`,
                    border: `1px solid ${color}50`,
                  }}
                >
                  {task.icon || '✨'}
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-sm">{task.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {task.description}
                  </div>
                  <div className="text-xs text-yellow-400 mt-2 font-bold">
                    +{task.reward_points} pts
                  </div>
                </div>

                <button
                  disabled={isCompleting}
                  onClick={() => handleComplete(task)}
                  className="px-4 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    color: '#111'
                  }}
                >
                  {isCompleting ? '...' : 'Start'}
                </button>

              </div>

              {message?.id === task.id && (
                <div
                  className="mt-3 text-xs text-center py-2 rounded-lg"
                  style={{
                    background: message.success
                      ? 'rgba(34,197,94,0.15)'
                      : 'rgba(239,68,68,0.15)',
                    color: message.success ? '#22c55e' : '#ef4444',
                  }}
                >
                  {message.text}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}