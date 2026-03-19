import React, { useEffect, useState, useRef } from 'react';
import {
  getLeaderboard,
  getActiveContests,
} from '@/lib/api';
import { LeaderboardEntry, Contest } from '@/types/telegram';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';

type LeaderboardTab = 'points' | 'ads';
type AdsSubTab = 'alltime' | 'today' | 'yesterday' | 'week' | 'month';

function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

function AnimatedPoints({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    let start = previous.current;
    const diff = value - start;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += increment;
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 600 / steps);

    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function formatCountdown(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff / (1000 * 60)) % 60);
  return `${h}h ${m}m`;
}

/* ── date range helper ── */
function getDateRange(subTab: AdsSubTab): { from: string; to?: string } | null {
  const now = new Date();

  if (subTab === 'today') {
    return {
      from: new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
      )).toISOString(),
    };
  }

  if (subTab === 'yesterday') {
    const start = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1
    ));
    const end = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ));
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (subTab === 'week') {
    return {
      from: new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7
      )).toISOString(),
    };
  }

  if (subTab === 'month') {
    return {
      from: new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()
      )).toISOString(),
    };
  }

  return null; // alltime — no filter
}

const ADS_SUBTABS: { id: AdsSubTab; label: string }[] = [
  { id: 'alltime',   label: 'All Time'  },
  { id: 'today',     label: 'Today'     },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week',      label: '7 Days'    },
  { id: 'month',     label: '30 Days'   },
];

export default function LeaderboardPage() {
  const { user } = useApp();

  const [leaders, setLeaders]             = useState<LeaderboardEntry[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Record<number, number>>({});
  const [contests, setContests]           = useState<Contest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState<LeaderboardTab>('points');
  const [adsSubTab, setAdsSubTab]         = useState<AdsSubTab>('alltime');
  const [adLeaders, setAdLeaders]         = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [tab, adsSubTab]);

  async function loadData() {
    setLoading(true);

    if (tab === 'points') {
      const data = await getLeaderboard();
      const newLeaders = data || [];

      const prev: Record<number, number> = {};
      leaders.forEach(l => { prev[l.telegram_id] = l.rank; });
      setPreviousRanks(prev);
      setLeaders(newLeaders);
    }

    if (tab === 'ads') {
      const activeContests = await getActiveContests();
      setContests(activeContests as Contest[]);

      /* ── ✅ FIX: build query with correct date range ── */
      const range = getDateRange(adsSubTab);

      let query = supabase
        .from('ad_logs')
        .select('user_id, created_at'); // ✅ select created_at so filter works

      if (range?.from) query = query.gte('created_at', range.from);
      if (range?.to)   query = query.lt('created_at', range.to);

      const { data: adLogs, error } = await query;

      if (error) {
        console.error('ad_logs query error:', error);
        setAdLeaders([]);
        setLoading(false);
        return;
      }

      /* ── aggregate ── */
      const counts: Record<string, number> = {};
      (adLogs || []).forEach((log: any) => {
        counts[log.user_id] = (counts[log.user_id] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);

      if (sorted.length === 0) {
        setAdLeaders([]);
        setLoading(false);
        return;
      }

      const userIds = sorted.map(([uid]) => uid);

      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, username, telegram_id, photo_url')
        .in('id', userIds);

      const userMap: Record<string, any> = {};
      (users || []).forEach(u => { userMap[u.id] = u; });

      setAdLeaders(sorted.map(([uid, score]) => ({
        user_id: uid,
        score,
        users: userMap[uid] || {},
      })));
    }

    setLoading(false);
  }

  const myRank = user && leaders.length > 0
    ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank
    : null;

  const activeContest = tab === 'ads'
    ? contests.find(c => c.contest_type === 'ads_watch')
    : null;

  return (
    <div className="px-4 pb-28 text-white">

      <div className="mb-4">
        <h2 className="text-lg font-bold">Leaderboard</h2>
        <p className="text-xs text-gray-400">Compete & win rewards</p>
      </div>

      {/* ── main tabs ── */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[#111827]">
        {[
          { id: 'points', label: 'Points',    icon: '⚡' },
          { id: 'ads',    label: 'Ads Watch', icon: '🎬' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { triggerHaptic(); setTab(t.id as LeaderboardTab); }}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: tab === t.id
                ? 'linear-gradient(135deg,#facc15,#f97316)'
                : 'transparent',
              color: tab === t.id ? '#111' : '#9ca3af',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── active contest ── */}
      {activeContest && (
        <div className="rounded-xl p-3 mb-4 bg-[#1f2937] border border-yellow-500/30">
          <div className="font-bold mb-1">🏆 {activeContest.title}</div>
          <div className="text-xs text-gray-400">
            Ends in {formatCountdown(activeContest.ends_at)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div style={{
            width: 36, height: 36,
            border: '3px solid rgba(250,204,21,0.2)',
            borderTop: '3px solid #facc15',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div className="text-xs text-gray-500">Loading...</div>
        </div>

      ) : tab === 'points' ? (
        /* ══════════ POINTS TAB ══════════ */
        <div className="space-y-3">
          {myRank && (
            <div className="text-xs text-center text-gray-500 mb-1">
              Your rank: <span className="text-yellow-400 font-bold">#{myRank}</span>
            </div>
          )}

          {leaders.map(leader => {
            const isMe = user && leader.telegram_id === user.telegram_id;
            const totalPoints = leader.total_points ?? (leader as any).points ?? 0;
            const previousRank = previousRanks[leader.telegram_id];
            let movement: 'up' | 'down' | null = null;

            if (previousRank) {
              if (leader.rank < previousRank)      { movement = 'up'; triggerHaptic('success'); }
              else if (leader.rank > previousRank)   movement = 'down';
            }

            return (
              <div
                key={leader.id}
                onClick={() => {
                  triggerHaptic();
                  if (leader.username) window.open(`https://t.me/${leader.username}`, '_blank');
                  else window.open(`tg://user?id=${leader.telegram_id}`);
                }}
                className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition active:scale-[0.97]"
                style={{
                  background: isMe ? 'rgba(250,204,21,0.12)' : 'rgba(17,24,39,0.85)',
                  border: isMe ? '1px solid rgba(250,204,21,0.5)' : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative font-bold text-yellow-400 w-8 text-sm">
                    #{leader.rank}
                    {leader.rank === 1 && (
                      <span style={{ position: 'absolute', top: -12, left: 2, animation: 'float 2s ease-in-out infinite' }}>
                        👑
                      </span>
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-sm font-bold">
                    {leader.photo_url
                      ? <img src={leader.photo_url} alt="" className="w-full h-full object-cover" />
                      : (leader.first_name?.[0] || '?')}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {leader.first_name || leader.username || 'User'}
                      {movement === 'up'   && <span className="text-green-400 text-xs animate-pulse">↑</span>}
                      {movement === 'down' && <span className="text-red-400   text-xs animate-pulse">↓</span>}
                      {isMe && <span className="text-yellow-400 text-xs">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-500">UID: {leader.telegram_id}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-yellow-400 text-lg">
                    <AnimatedPoints value={totalPoints} />
                  </div>
                  <div className="text-xs text-gray-500">pts</div>
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* ══════════ ADS TAB ══════════ */
        <>
          {/* ── sub-tabs (scrollable) ── */}
          <div
            className="flex gap-1.5 mb-4 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {ADS_SUBTABS.map(st => (
              <button
                key={st.id}
                onClick={() => { triggerHaptic(); setAdsSubTab(st.id); }}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  background: adsSubTab === st.id
                    ? 'linear-gradient(135deg,#facc15,#f97316)'
                    : 'rgba(255,255,255,0.06)',
                  color:  adsSubTab === st.id ? '#111' : '#6b7280',
                  border: adsSubTab === st.id
                    ? '1px solid transparent'
                    : '1px solid rgba(255,255,255,0.06)',
                  whiteSpace: 'nowrap',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* ── list ── */}
          <div className="space-y-3">
            {adLeaders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-3xl mb-3">📭</div>
                <div className="text-sm text-gray-400">
                  No ad watches{' '}
                  {adsSubTab === 'today'     ? 'today'          :
                   adsSubTab === 'yesterday' ? 'yesterday'      :
                   adsSubTab === 'week'      ? 'this week'      :
                   adsSubTab === 'month'     ? 'this month'     : 'yet'}
                </div>
              </div>
            ) : adLeaders.map((entry: any, i: number) => (
              <div
                key={entry.user_id}
                onClick={() => {
                  triggerHaptic();
                  if (entry.users?.username) window.open(`https://t.me/${entry.users.username}`, '_blank');
                  else window.open(`tg://user?id=${entry.users?.telegram_id}`);
                }}
                className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition active:scale-[0.97]"
                style={{
                  background: user && entry.users?.telegram_id === user.telegram_id
                    ? 'rgba(250,204,21,0.1)'
                    : 'rgba(17,24,39,0.85)',
                  border: user && entry.users?.telegram_id === user.telegram_id
                    ? '1px solid rgba(250,204,21,0.4)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative font-bold text-yellow-400 w-8 text-sm">
                    #{i + 1}
                    {i === 0 && (
                      <span style={{ position: 'absolute', top: -12, left: 2, animation: 'float 2s ease-in-out infinite' }}>
                        👑
                      </span>
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-sm font-bold">
                    {entry.users?.photo_url
                      ? <img src={entry.users.photo_url} alt="" className="w-full h-full object-cover" />
                      : (entry.users?.first_name?.[0] || '?')}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {entry.users?.first_name || entry.users?.username || 'User'}
                      {user && entry.users?.telegram_id === user.telegram_id && (
                        <span className="text-yellow-400 text-xs">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      UID: {entry.users?.telegram_id || '—'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-yellow-400">{entry.score}</div>
                  <div className="text-xs text-gray-500">ads</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
