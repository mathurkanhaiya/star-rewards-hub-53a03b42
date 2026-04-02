import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getLeaderboard, getActiveContests, getContestLeaderboard } from '@/lib/api';
import { LeaderboardEntry, Contest } from '@/types/telegram';
import { useApp } from '@/context/AppContext';

type LeaderboardTab = 'points' | 'ads';
type AdsSubTab = 'today' | 'yesterday' | 'week';

/* ─────────────────────────────────────────────
   Pure helpers — outside component, never recreated
───────────────────────────────────────────── */
function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window === 'undefined') return;
  const tg = (window as any).Telegram?.WebApp;
  if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
  else tg?.HapticFeedback?.impactOccurred('medium');
}

function formatCountdown(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff / (1000 * 60)) % 60);
  return `${h}h ${m}m`;
}

function getDateRange(subTab: AdsSubTab): { from: string; to?: string } {
  const now = new Date();
  const utc = (y: number, mo: number, d: number) =>
    new Date(Date.UTC(y, mo, d)).toISOString();
  const Y = now.getUTCFullYear(), M = now.getUTCMonth(), D = now.getUTCDate();
  if (subTab === 'today')     return { from: utc(Y, M, D) };
  if (subTab === 'yesterday') return { from: utc(Y, M, D - 1), to: utc(Y, M, D) };
  return { from: utc(Y, M, D - 7) };
}

const ADS_SUBTABS: { id: AdsSubTab; label: string }[] = [
  { id: 'today',     label: 'Today'     },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week',      label: '7 Days'    },
];

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#f97316'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];
const POLL_INTERVAL = 20_000; // 20s — slightly longer to reduce load
const CACHE_TTL     = 12_000; // 12s — skip fetch if data is fresh

/* ─────────────────────────────────────────────
   CSS — constant, never causes style node diff
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes lbFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes lbSpin   { to{transform:rotate(360deg)} }
@keyframes lbFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes lbPulse  { 0%,100%{opacity:0.6} 50%{opacity:1} }
@keyframes lbShine  { 0%{left:-100%} 40%,100%{left:150%} }

.lb-root { font-family:'Rajdhani',sans-serif; padding:0 16px 112px; color:#fff; min-height:100vh; }

.lb-header { padding:4px 0 20px; }
.lb-eyebrow { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:5px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:4px; }
.lb-title { font-family:'Orbitron',monospace; font-size:22px; font-weight:900; letter-spacing:2px; color:#fff; line-height:1; }
.lb-title span { color:#ffbe00; text-shadow:0 0 16px rgba(255,190,0,0.4); }

.lb-my-rank { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:20px; margin-bottom:14px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.25); font-family:'Orbitron',monospace; font-size:11px; font-weight:700; color:#ffbe00; letter-spacing:1px; }

.lb-tabs { display:flex; gap:6px; margin-bottom:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:4px; }
.lb-tab { flex:1; padding:9px; border-radius:10px; border:none; font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:background 0.2s,color 0.2s,box-shadow 0.2s; color:rgba(255,255,255,0.25); background:none; }
.lb-tab.active { background:#ffbe00; color:#1a0800; box-shadow:0 2px 12px rgba(255,190,0,0.3); }

.lb-subtabs { display:flex; gap:6px; margin-bottom:14px; }
.lb-subtab { flex:1; padding:7px; border-radius:12px; border:1px solid rgba(255,255,255,0.06); font-family:'Orbitron',monospace; font-size:9px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:all 0.2s; color:rgba(255,255,255,0.25); background:rgba(255,255,255,0.03); }
.lb-subtab.active { background:rgba(34,211,238,0.12); border-color:rgba(34,211,238,0.35); color:#22d3ee; box-shadow:0 0 12px rgba(34,211,238,0.2); }

.lb-contest { background:rgba(255,190,0,0.05); border:1px solid rgba(255,190,0,0.2); border-radius:16px; padding:14px 16px; margin-bottom:14px; position:relative; overflow:hidden; }
.lb-contest::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent); }
.lb-contest-title { font-family:'Orbitron',monospace; font-size:12px; font-weight:700; letter-spacing:1px; color:#ffbe00; margin-bottom:3px; }
.lb-contest-sub { font-size:11px; color:rgba(255,255,255,0.3); letter-spacing:1px; }

.lb-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:56px 0; gap:12px; }
.lb-spinner { width:36px; height:36px; border-radius:50%; border:2px solid rgba(255,190,0,0.15); border-top:2px solid #ffbe00; animation:lbSpin 0.8s linear infinite; }
.lb-loading-txt { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.15); }

.lb-empty { text-align:center; padding:48px 0; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.1); text-transform:uppercase; }

.lb-podium { display:flex; align-items:flex-end; justify-content:center; gap:8px; margin-bottom:20px; }
.lb-podium-item { display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; max-width:110px; animation:lbFadeIn 0.4s ease both; }
.lb-podium-item:nth-child(1){animation-delay:0.1s} .lb-podium-item:nth-child(2){animation-delay:0s} .lb-podium-item:nth-child(3){animation-delay:0.2s}
.lb-podium-crown { font-size:20px; animation:lbFloat 2s ease-in-out infinite; }
.lb-podium-avatar { border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; font-family:'Orbitron',monospace; font-weight:700; position:relative; }
.lb-podium-avatar img { width:100%; height:100%; object-fit:cover; }
.lb-podium-name { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; }
.lb-podium-pts { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:1px; text-align:center; }
.lb-podium-base { width:100%; border-radius:12px 12px 0 0; display:flex; align-items:center; justify-content:center; font-family:'Orbitron',monospace; font-size:18px; font-weight:900; }

.lb-row { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:16px; padding:12px 14px; margin-bottom:8px; cursor:pointer; transition:transform 0.12s,border-color 0.2s; position:relative; overflow:hidden; animation:lbFadeIn 0.3s ease both; }
.lb-row:active { transform:scale(0.98); }
.lb-row.me { background:rgba(255,190,0,0.06); border-color:rgba(255,190,0,0.3); box-shadow:0 0 20px rgba(255,190,0,0.1); }
.lb-row.me::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent); }

.lb-row-rank { font-family:'Orbitron',monospace; font-size:13px; font-weight:700; width:32px; text-align:center; flex-shrink:0; color:rgba(255,255,255,0.3); }
.lb-row-rank.gold   { color:#fbbf24; }
.lb-row-rank.silver { color:#94a3b8; }
.lb-row-rank.bronze { color:#f97316; }

.lb-row-avatar { width:40px; height:40px; border-radius:50%; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:'Orbitron',monospace; font-size:14px; font-weight:700; background:rgba(255,255,255,0.06); }
.lb-row-avatar img { width:100%; height:100%; object-fit:cover; }

.lb-row-body { flex:1; min-width:0; }
.lb-row-name { font-size:14px; font-weight:600; color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px; }
.lb-you-badge { font-family:'Orbitron',monospace; font-size:7px; font-weight:700; letter-spacing:1px; padding:1px 6px; border-radius:6px; background:rgba(255,190,0,0.15); border:1px solid rgba(255,190,0,0.3); color:#ffbe00; flex-shrink:0; }
.lb-row-sub { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:1px; margin-top:1px; }

.lb-row-pts { text-align:right; flex-shrink:0; }
.lb-row-pts-val { font-family:'Orbitron',monospace; font-size:16px; font-weight:700; color:#ffbe00; letter-spacing:0.5px; }
.lb-row-pts-val.ads { color:#22d3ee; }
.lb-row-pts-lbl { font-size:9px; letter-spacing:1px; color:rgba(255,255,255,0.2); text-align:right; }

.lb-movement { font-size:10px; font-weight:700; animation:lbPulse 1.5s ease-in-out infinite; }
.lb-refresh-dot { width:6px; height:6px; border-radius:50%; background:#4ade80; display:inline-block; margin-left:6px; animation:lbPulse 1.5s ease-in-out infinite; }
`;

/* ─────────────────────────────────────────────
   AnimatedPoints — skips animation if diff is tiny
   (avoids distracting flicker on poll updates)
───────────────────────────────────────────── */
function AnimatedPoints({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const diff = Math.abs(value - prevRef.current);
    // Skip animation for tiny changes (poll noise) — just snap
    if (diff === 0) return;
    if (diff < 5) { setDisplay(value); prevRef.current = value; return; }

    let start = prevRef.current;
    const steps = 24;
    const inc = (value - start) / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      start += inc;
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 500 / steps);
    prevRef.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function LeaderboardPage() {
  const { user } = useApp();

  const [leaders,       setLeaders]       = useState<LeaderboardEntry[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Record<number, number>>({});
  const [contests,      setContests]      = useState<Contest[]>([]);
  const [tab,           setTab]           = useState<LeaderboardTab>('points');
  const [adsSubTab,     setAdsSubTab]     = useState<AdsSubTab>('today');
  const [adLeaders,     setAdLeaders]     = useState<any[]>([]);

  // Separate loading states: initial (show spinner) vs background (silent refresh)
  const [initialLoading, setInitialLoading] = useState(true);

  // Cache: key = `${tab}-${adsSubTab}`, value = { data, ts }
  const cache = useRef<Record<string, { ts: number; leaders?: any[]; adLeaders?: any[]; contests?: any[] }>>({});

  // Stable ref to leaders so the interval callback never has a stale closure
  const leadersRef = useRef<LeaderboardEntry[]>([]);
  useEffect(() => { leadersRef.current = leaders; }, [leaders]);

  // Track whether component is mounted to prevent setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  /* ── Fetch points leaderboard ── */
  const fetchPoints = useCallback(async () => {
    const data = await getLeaderboard();
    const prev: Record<number, number> = {};
    leadersRef.current.forEach(l => { prev[l.telegram_id] = l.rank; });
    const mapped: LeaderboardEntry[] = (data || []).map((l: any, i: number) => ({
      id: l.id,
      telegram_id: l.telegram_id,
      first_name: l.first_name || 'User',
      username: l.username,
      photo_url: l.photo_url,
      total_points: l.total_points ?? 0,
      current_points: l.current_points ?? l.total_points ?? 0,
      level: l.level ?? 1,
      rank: l.rank ?? i + 1,
    }));
    return { mapped, prev };
  }, []);

  /* ── Fetch ads leaderboard ── */
  const fetchAds = useCallback(async (subTab: AdsSubTab) => {
    const activeContests = await getActiveContests();
    // For now, show contest leaderboards only
    return {
      contests: activeContests as Contest[],
      adLeaders: [],
    };
  }, []);

  /* ── Main load — uses cache, suppresses loading flicker on polls ── */
  const loadData = useCallback(async (isBackground = false) => {
    // Pause polling when tab is hidden (saves requests)
    if (isBackground && document.visibilityState === 'hidden') return;

    const cacheKey = `${tab}-${adsSubTab}`;
    const cached   = cache.current[cacheKey];
    const fresh    = cached && Date.now() - cached.ts < CACHE_TTL;

    // If we have fresh cache AND this is a background poll → skip entirely
    if (fresh && isBackground) return;

    // Only show spinner on initial/tab-switch loads, not background polls
    if (!isBackground && !fresh) {
      if (mountedRef.current) setInitialLoading(true);
    }

    try {
      if (tab === 'points') {
        const result = await fetchPoints();
        if (!mountedRef.current) return;
        setPreviousRanks(result.prev);
        setLeaders(result.mapped);
        cache.current[cacheKey] = { ts: Date.now(), leaders: result.mapped };
      } else {
        const result = await fetchAds(adsSubTab);
        if (!mountedRef.current) return;
        setContests(result.contests ?? []);
        setAdLeaders(result.adLeaders);
        cache.current[cacheKey] = { ts: Date.now(), adLeaders: result.adLeaders, contests: result.contests };
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      if (mountedRef.current) setInitialLoading(false);
    }
  }, [tab, adsSubTab, fetchPoints, fetchAds]);

  /* ── Initial load + polling ── */
  useEffect(() => {
    loadData(false); // first load — show spinner

    const interval = setInterval(() => loadData(true), POLL_INTERVAL);

    // Pause/resume polling on tab visibility
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadData(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadData]); // loadData is stable per tab/subtab combo

  /* ── Derived ── */
  const myRank = user && leaders.length > 0
    ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank
    : null;
  const activeContest = tab === 'ads'
    ? contests.find(c => c.contest_type === 'ads_watch')
    : null;

  function rankClass(rank: number) {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  }

  function openProfile(telegramId?: number, username?: string) {
    triggerHaptic();
    if (username)    window.open(`https://t.me/${username}`, '_blank');
    else if (telegramId) window.open(`tg://user?id=${telegramId}`);
  }

  const podiumOrder   = leaders.length >= 3 ? [leaders[1], leaders[0], leaders[2]] : leaders.slice(0, 3);
  const podiumHeights = [80, 104, 64];
  const podiumSizes   = [48, 60, 44];

  return (
    <>
      <style>{CSS}</style>
      <div className="lb-root">

        {/* Header */}
        <div className="lb-header">
          <div className="lb-eyebrow">Compete · Rank</div>
          <div className="lb-title">
            LEADER<span>BOARD</span>
            {/* Subtle live dot — shows data is auto-refreshing, no spinner flicker */}
            {!initialLoading && <span className="lb-refresh-dot" title="Live" />}
          </div>
        </div>

        {myRank && (
          <div className="lb-my-rank">✦ YOUR RANK &nbsp; #{myRank}</div>
        )}

        {/* Main tabs */}
        <div className="lb-tabs">
          {[
            { id: 'points', label: 'Points'    },
            { id: 'ads',    label: 'Ads Watch' },
          ].map(t => (
            <button
              key={t.id}
              className={`lb-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { triggerHaptic(); setTab(t.id as LeaderboardTab); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeContest && (
          <div className="lb-contest">
            <div className="lb-contest-title">🏆 {activeContest.title}</div>
            <div className="lb-contest-sub">Ends in {formatCountdown(activeContest.ends_at)}</div>
          </div>
        )}

        {/* Spinner — only on initial/tab-switch, NOT on background polls */}
        {initialLoading && (
          <div className="lb-loading">
            <div className="lb-spinner" />
            <div className="lb-loading-txt">Loading Rankings</div>
          </div>
        )}

        {/* ── POINTS TAB ── */}
        {!initialLoading && tab === 'points' && (
          <>
            {leaders.length === 0 ? (
              <div className="lb-empty">✦ No players yet ✦</div>
            ) : (
              <>
                {leaders.length >= 3 && (
                  <div className="lb-podium">
                    {podiumOrder.map((leader, podiumIdx) => {
                      if (!leader) return null;
                      const visualRank = [2, 1, 3][podiumIdx];
                      const color      = RANK_COLORS[visualRank - 1];
                      const pts        = leader.total_points ?? (leader as any).points ?? 0;
                      const isMe       = user && leader.telegram_id === user.telegram_id;
                      return (
                        <div
                          key={leader.id}
                          className="lb-podium-item"
                          onClick={() => openProfile(leader.telegram_id, leader.username)}
                        >
                          {visualRank === 1 && <div className="lb-podium-crown">👑</div>}
                          <div
                            className="lb-podium-avatar"
                            style={{
                              width: podiumSizes[podiumIdx],
                              height: podiumSizes[podiumIdx],
                              border: `2px solid ${color}60`,
                              boxShadow: `0 0 16px ${color}40`,
                              fontSize: podiumSizes[podiumIdx] / 3,
                              color,
                            }}
                          >
                            {leader.photo_url
                              ? <img src={leader.photo_url} alt="" />
                              : (leader.first_name?.[0] || '?')}
                          </div>
                          <div className="lb-podium-name" style={{ color: isMe ? '#ffbe00' : 'rgba(255,255,255,0.7)' }}>
                            {leader.first_name || 'User'}
                          </div>
                          <div className="lb-podium-pts" style={{ color }}>
                            {pts.toLocaleString()}
                          </div>
                          <div
                            className="lb-podium-base"
                            style={{
                              height: podiumHeights[podiumIdx],
                              background: `${color}12`,
                              border: `1px solid ${color}30`,
                              color,
                            }}
                          >
                            {RANK_LABELS[visualRank - 1]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {leaders.slice(3).map((leader, idx) => {
                  const isMe      = user && leader.telegram_id === user.telegram_id;
                  const pts       = leader.total_points ?? (leader as any).points ?? 0;
                  const prevRank  = previousRanks[leader.telegram_id];
                  const movement  = prevRank
                    ? leader.rank < prevRank ? 'up' : leader.rank > prevRank ? 'down' : null
                    : null;
                  return (
                    <div
                      key={leader.id}
                      className={`lb-row ${isMe ? 'me' : ''}`}
                      onClick={() => openProfile(leader.telegram_id, leader.username)}
                      style={{ animationDelay: `${idx * 0.04}s` }}
                    >
                      <div className={`lb-row-rank ${rankClass(leader.rank)}`}>#{leader.rank}</div>
                      <div className="lb-row-avatar" style={isMe ? { border: '1px solid rgba(255,190,0,0.4)' } : {}}>
                        {leader.photo_url
                          ? <img src={leader.photo_url} alt="" />
                          : <span style={{ color: '#ffbe00' }}>{leader.first_name?.[0] || '?'}</span>}
                      </div>
                      <div className="lb-row-body">
                        <div className="lb-row-name">
                          {leader.first_name || leader.username || 'User'}
                          {movement === 'up'   && <span className="lb-movement" style={{ color: '#4ade80' }}>↑</span>}
                          {movement === 'down' && <span className="lb-movement" style={{ color: '#ef4444' }}>↓</span>}
                          {isMe && <span className="lb-you-badge">YOU</span>}
                        </div>
                        <div className="lb-row-sub">@{leader.username || `uid_${leader.telegram_id}`}</div>
                      </div>
                      <div className="lb-row-pts">
                        <div className="lb-row-pts-val"><AnimatedPoints value={pts} /></div>
                        <div className="lb-row-pts-lbl">pts</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ── ADS TAB ── */}
        {!initialLoading && tab === 'ads' && (
          <>
            <div className="lb-subtabs">
              {ADS_SUBTABS.map(st => (
                <button
                  key={st.id}
                  className={`lb-subtab ${adsSubTab === st.id ? 'active' : ''}`}
                  onClick={() => { triggerHaptic(); setAdsSubTab(st.id); }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {adLeaders.length === 0 ? (
              <div className="lb-empty">✦ No data yet ✦</div>
            ) : adLeaders.map((entry: any, i: number) => {
              const isMe = user && entry.users?.telegram_id === user.telegram_id;
              const rank = i + 1;
              return (
                <div
                  key={entry.user_id}
                  className={`lb-row ${isMe ? 'me' : ''}`}
                  onClick={() => openProfile(entry.users?.telegram_id, entry.users?.username)}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className={`lb-row-rank ${rankClass(rank)}`}>
                    {rank <= 3 ? RANK_LABELS[rank - 1] : `#${rank}`}
                  </div>
                  <div className="lb-row-avatar" style={isMe ? { border: '1px solid rgba(255,190,0,0.4)' } : {}}>
                    {entry.users?.photo_url
                      ? <img src={entry.users.photo_url} alt="" />
                      : <span style={{ color: '#22d3ee' }}>{entry.users?.first_name?.[0] || '?'}</span>}
                  </div>
                  <div className="lb-row-body">
                    <div className="lb-row-name">
                      {entry.users?.first_name || entry.users?.username || 'User'}
                      {isMe && <span className="lb-you-badge">YOU</span>}
                    </div>
                    <div className="lb-row-sub">@{entry.users?.username || `uid_${entry.users?.telegram_id}`}</div>
                  </div>
                  <div className="lb-row-pts">
                    <div className="lb-row-pts-val ads">{entry.score}</div>
                    <div className="lb-row-pts-lbl">ads</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

      </div>
    </>
  );
}
