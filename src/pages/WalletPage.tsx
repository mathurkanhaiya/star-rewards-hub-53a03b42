import React, { useEffect, useState, useRef, useCallback } from ‘react’;
import { useApp } from ‘@/context/AppContext’;
import { submitWithdrawal, getWithdrawals } from ‘@/lib/api’;
import { Withdrawal } from ‘@/types/telegram’;
import { supabase } from ‘@/integrations/supabase/client’;

// ─── Haptic ─────────────────────────────────────────────────────────────────
function triggerHaptic(type: ‘impact’ | ‘success’ | ‘error’ = ‘impact’) {
if (typeof window !== ‘undefined’ && (window as any).Telegram) {
const tg = (window as any).Telegram.WebApp;
if (type === ‘success’) tg?.HapticFeedback?.notificationOccurred(‘success’);
else if (type === ‘error’) tg?.HapticFeedback?.notificationOccurred(‘error’);
else tg?.HapticFeedback?.impactOccurred(‘medium’);
}
}

// ─── Animated Number ─────────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
const [display, setDisplay] = useState(value);
const prev = useRef(value);

useEffect(() => {
let start = prev.current;
const diff = value - start;
const steps = 30;
const increment = diff / steps;
let step = 0;
const timer = setInterval(() => {
step++;
start += increment;
if (step >= steps) { setDisplay(value); clearInterval(timer); }
else setDisplay(Math.floor(start));
}, 20);
prev.current = value;
return () => clearInterval(timer);
}, [value]);

return <>{display.toLocaleString()}</>;
}

// ─── Types ───────────────────────────────────────────────────────────────────
type ToastType = ‘success’ | ‘error’ | ‘info’;
interface Toast { text: string; type: ToastType }

// ─── Constants ───────────────────────────────────────────────────────────────
const CONVERSION_TIERS = [
{ pts: 5_000,  ton: 0.05 },
{ pts: 10_000, ton: 0.10 },
{ pts: 15_000, ton: 0.15 },
{ pts: 20_000, ton: 0.20 },
{ pts: 25_000, ton: 0.25 },
];
const REQUIRED_ADS = 40;

const STATUS_CFG: Record<string, { color: string; bg: string; icon: string }> = {
pending:    { color: ‘#f59e0b’, bg: ‘rgba(245,158,11,0.1)’,  icon: ‘⏳’ },
approved:   { color: ‘#10b981’, bg: ‘rgba(16,185,129,0.1)’, icon: ‘✅’ },
rejected:   { color: ‘#ef4444’, bg: ‘rgba(239,68,68,0.1)’,  icon: ‘❌’ },
processing: { color: ‘#38bdf8’, bg: ‘rgba(56,189,248,0.1)’, icon: ‘🔄’ },
};

// ─── Page ────────────────────────────────────────────────────────────────────
export default function WalletPage() {
const { user, balance, refreshBalance } = useApp();

const [walletInput, setWalletInput]     = useState(’’);
const [savedWallet, setSavedWallet]     = useState(’’);
const [editingWallet, setEditingWallet] = useState(false);
const [withdrawals, setWithdrawals]     = useState<Withdrawal[]>([]);
const [toast, setToast]                 = useState<Toast | null>(null);
const [adCount, setAdCount]             = useState(0);
const [adLoading, setAdLoading]         = useState(true);
const [loadingTier, setLoadingTier]     = useState<number | null>(null);
const [tab, setTab]                     = useState<‘withdraw’ | ‘history’>(‘withdraw’);
const toastTimer = useRef<ReturnType<typeof setTimeout>>();

const availablePoints  = balance?.points ?? 0;
const withdrawUnlocked = adCount >= REQUIRED_ADS;
const adProgress       = Math.min(adCount / REQUIRED_ADS, 1);

function showToast(text: string, type: ToastType = ‘info’) {
setToast({ text, type });
clearTimeout(toastTimer.current);
toastTimer.current = setTimeout(() => setToast(null), 3800);
}

useEffect(() => {
if (!user) return;
getWithdrawals(user.id).then(setWithdrawals);

```
const now = new Date();
const startOfDay = new Date(Date.UTC(
  now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
)).toISOString();

supabase
  .from('ad_logs')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .gte('created_at', startOfDay)
  .then(({ count }) => {
    setAdCount(count ?? 0);
    setAdLoading(false);
  });
```

}, [user]);

// BUG FIX: original set walletInput to ‘’ right after saving — correct flow preserved here
function handleSaveWallet() {
const val = walletInput.trim();
if (!val) {
triggerHaptic(‘error’);
showToast(‘Please enter a TON wallet address’, ‘error’);
return;
}
if (val.length < 30) {
triggerHaptic(‘error’);
showToast(‘Address looks too short — double check it’, ‘error’);
return;
}
setSavedWallet(val);
setWalletInput(’’);
setEditingWallet(false);
triggerHaptic(‘success’);
showToast(‘Wallet saved!’, ‘success’);
}

// BUG FIX: original never refreshed withdrawal history after success
const handleCardWithdraw = useCallback(async (pts: number, idx: number) => {
if (!user) return;

```
if (!savedWallet) {
  triggerHaptic('error');
  showToast('Add your TON wallet first', 'error');
  return;
}
if (!withdrawUnlocked) {
  triggerHaptic('error');
  showToast(`Watch ${REQUIRED_ADS - adCount} more ads to unlock`, 'error');
  return;
}
if (availablePoints < pts) {
  triggerHaptic('error');
  showToast('Insufficient balance', 'error');
  return;
}

triggerHaptic();
setLoadingTier(idx);

const res = await submitWithdrawal(user.id, 'ton', pts, savedWallet);
setLoadingTier(null);

if (res.success) {
  triggerHaptic('success');
  showToast('Withdrawal submitted!', 'success');
  await refreshBalance();
  getWithdrawals(user.id).then(setWithdrawals); // ← BUG FIX: was missing
} else {
  triggerHaptic('error');
  showToast(res.message || 'Withdrawal failed. Try again.', 'error');
}
```

}, [user, savedWallet, withdrawUnlocked, availablePoints, adCount, refreshBalance]);

// ── Render ────────────────────────────────────────────────────────────────
return (
<div style={s.page}>
<div style={s.ambientTop} />
<div style={s.ambientBot} />

```
  {/* HEADER */}
  <header style={s.header}>
    <div>
      <h1 style={s.title}>Wallet</h1>
      <p style={s.subtitle}>Earn · Convert · Withdraw</p>
    </div>
    <div style={s.networkBadge}>
      <span style={s.networkPulse} />
      TON
    </div>
  </header>

  {/* BALANCE */}
  <div style={s.balanceCard}>
    <div style={s.balInner}>
      <p style={s.balLabel}>Available Balance</p>
      <div style={s.balRow}>
        <span style={s.balValue}><AnimatedNumber value={availablePoints} /></span>
        <span style={s.balUnit}>PTS</span>
      </div>
      <span style={s.balEst}>
        ≈ {(availablePoints * 0.00001).toFixed(4)} TON estimated
      </span>
    </div>
    <div style={s.balDeco}>◈</div>
  </div>

  {/* TABS */}
  <div style={s.tabBar}>
    {(['withdraw', 'history'] as const).map(t => (
      <button key={t} onClick={() => setTab(t)}
        style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}>
        {t === 'withdraw' ? '💸 Withdraw' : '📋 History'}
      </button>
    ))}
  </div>

  {/* ═══ WITHDRAW ═══ */}
  {tab === 'withdraw' && (
    <>
      {/* Wallet */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <span>💼</span>
          <span style={s.cardTitle}>TON Wallet</span>
          {savedWallet && !editingWallet && (
            <button onClick={() => setEditingWallet(true)} style={s.editBtn}>Edit</button>
          )}
        </div>
        {savedWallet && !editingWallet ? (
          <div style={s.savedBox}>
            <span style={s.savedDot} />
            <span style={s.savedAddr}>{savedWallet.slice(0,8)}…{savedWallet.slice(-6)}</span>
            <span style={s.savedCheck}>✓ Active</span>
          </div>
        ) : (
          <div style={s.walletRow}>
            <input
              value={walletInput}
              onChange={e => setWalletInput(e.target.value)}
              placeholder="EQ... or UQ... address"
              style={s.input}
              autoComplete="off"
              spellCheck={false}
            />
            <button onClick={handleSaveWallet} style={s.saveBtn}>
              {editingWallet ? 'Update' : 'Save'}
            </button>
          </div>
        )}
      </section>

      {/* Ad lock */}
      <section style={{
        ...s.adCard,
        background: withdrawUnlocked ? 'rgba(16,185,129,0.06)' : 'rgba(251,191,36,0.05)',
        borderColor: withdrawUnlocked ? 'rgba(16,185,129,0.2)' : 'rgba(251,191,36,0.2)',
      }}>
        <div style={s.adRow}>
          <div style={s.adLeft}>
            <span style={{ fontSize: 20 }}>{withdrawUnlocked ? '✅' : '🔒'}</span>
            <div>
              <p style={{ ...s.adStatus, color: withdrawUnlocked ? '#10b981' : '#fbbf24' }}>
                {withdrawUnlocked ? 'Unlocked' : 'Locked'}
              </p>
              <p style={s.adSub}>
                {adLoading ? 'Loading…' : `${adCount} / ${REQUIRED_ADS} ads watched today`}
              </p>
            </div>
          </div>
          <span style={{ ...s.adCountTxt, color: withdrawUnlocked ? '#10b981' : '#fbbf24' }}>
            {adCount}/{REQUIRED_ADS}
          </span>
        </div>
        <div style={s.progBg}>
          <div style={{
            ...s.progFill,
            width: `${adProgress * 100}%`,
            background: withdrawUnlocked
              ? 'linear-gradient(90deg,#10b981,#6ee7b7)'
              : 'linear-gradient(90deg,#f59e0b,#fde68a)',
          }} />
        </div>
      </section>

      {/* Tiers */}
      <section style={s.card}>
        <div style={s.cardHead}>
          <span>⚡</span>
          <span style={s.cardTitle}>Withdraw Options</span>
        </div>
        <div style={s.tiersWrap}>
          {CONVERSION_TIERS.map((tier, i) => {
            const canAfford = availablePoints >= tier.pts;
            const active    = withdrawUnlocked && canAfford;
            const loading   = loadingTier === i;
            return (
              <button
                key={i}
                onClick={() => active && !loading && handleCardWithdraw(tier.pts, i)}
                disabled={!active || loading}
                style={{
                  ...s.tierBtn,
                  opacity: active ? 1 : 0.38,
                  cursor: active ? 'pointer' : 'not-allowed',
                  ...(active ? s.tierBtnActive : {}),
                }}
              >
                {active && <div style={s.tierGlow} />}
                <div style={s.tierLeft}>
                  <span style={s.tierPts}>{(tier.pts / 1000).toFixed(0)}K</span>
                  <span style={s.tierPtsLbl}>pts</span>
                </div>
                <span style={s.tierArrow}>
                  {loading ? '◌' : '→'}
                </span>
                <div style={s.tierRight}>
                  <span style={s.tierTon}>{tier.ton.toFixed(2)}</span>
                  <span style={s.tierTonLbl}>TON</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </>
  )}

  {/* ═══ HISTORY ═══ */}
  {tab === 'history' && (
    <section style={s.card}>
      <div style={s.cardHead}>
        <span>📋</span>
        <span style={s.cardTitle}>Withdrawal History</span>
      </div>
      {withdrawals.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: 36, margin: '0 0 10px' }}>📭</p>
          <p style={s.emptyTitle}>No withdrawals yet</p>
          <p style={s.emptySub}>Your requests will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {withdrawals.map((w, i) => {
            const cfg = STATUS_CFG[w.status] ?? STATUS_CFG['pending'];
            return (
              <div key={w.id ?? i} style={s.histItem}>
                <div>
                  <p style={s.histPts}>{w.points?.toLocaleString()} pts</p>
                  <p style={s.histAddr}>
                    {w.wallet_address
                      ? `${w.wallet_address.slice(0,6)}…${w.wallet_address.slice(-4)}`
                      : '—'}
                  </p>
                </div>
                <div style={{ ...s.badge, background: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' }}>
                  {cfg.icon} {w.status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  )}

  {/* TOAST */}
  {toast && (
    <div style={{
      ...s.toast,
      background: toast.type === 'success' ? 'rgba(16,185,129,0.95)'
        : toast.type === 'error' ? 'rgba(239,68,68,0.95)'
        : 'rgba(15,23,42,0.97)',
      boxShadow: toast.type === 'success' ? '0 8px 32px rgba(16,185,129,0.35)'
        : toast.type === 'error' ? '0 8px 32px rgba(239,68,68,0.35)'
        : '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️'}
      <span style={{ color: '#fff', fontWeight: 600 }}>{toast.text}</span>
    </div>
  )}
</div>
```

);
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
page: {
position: ‘relative’, minHeight: ‘100vh’, overflow: ‘hidden’,
background: ‘#05090f’,
paddingBottom: 120, paddingLeft: 16, paddingRight: 16, paddingTop: 8,
color: ‘#e2e8f0’,
fontFamily: “‘Sora’,‘SF Pro Display’,-apple-system,sans-serif”,
},
ambientTop: {
position: ‘fixed’, top: -100, right: -80, width: 300, height: 300,
borderRadius: ‘50%’, pointerEvents: ‘none’, zIndex: 0,
background: ‘radial-gradient(circle,rgba(251,191,36,0.07),transparent 70%)’,
},
ambientBot: {
position: ‘fixed’, bottom: 0, left: -80, width: 260, height: 260,
borderRadius: ‘50%’, pointerEvents: ‘none’, zIndex: 0,
background: ‘radial-gradient(circle,rgba(56,189,248,0.06),transparent 70%)’,
},

header: {
position: ‘relative’, zIndex: 1,
display: ‘flex’, justifyContent: ‘space-between’, alignItems: ‘center’,
paddingTop: 14, marginBottom: 20,
},
title: {
margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: ‘-0.8px’,
background: ‘linear-gradient(135deg,#f1f5f9 30%,#64748b)’,
WebkitBackgroundClip: ‘text’, WebkitTextFillColor: ‘transparent’,
},
subtitle: { margin: ‘3px 0 0’, fontSize: 11, color: ‘#334155’, fontWeight: 500, letterSpacing: ‘0.5px’ },
networkBadge: {
display: ‘flex’, alignItems: ‘center’, gap: 7,
padding: ‘6px 14px’, borderRadius: 99,
background: ‘rgba(56,189,248,0.08)’,
border: ‘1px solid rgba(56,189,248,0.2)’,
fontSize: 12, fontWeight: 700, color: ‘#38bdf8’, letterSpacing: ‘1px’,
},
networkPulse: {
width: 7, height: 7, borderRadius: ‘50%’, flexShrink: 0,
background: ‘#38bdf8’, boxShadow: ‘0 0 0 2px rgba(56,189,248,0.25),0 0 8px #38bdf8’,
},

balanceCard: {
position: ‘relative’, zIndex: 1,
borderRadius: 24, marginBottom: 16, overflow: ‘hidden’,
background: ‘linear-gradient(145deg,#0d1a2e,#0f172a,#0c1423)’,
border: ‘1px solid rgba(251,191,36,0.15)’,
boxShadow: ‘0 20px 60px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.03)’,
},
balInner: { padding: ‘22px 20px 20px’ },
balDeco: {
position: ‘absolute’, right: 18, top: ‘50%’,
transform: ‘translateY(-50%)’,
fontSize: 60, color: ‘rgba(251,191,36,0.05)’,
fontWeight: 900, lineHeight: 1, userSelect: ‘none’,
},
balLabel: {
margin: ‘0 0 6px’, fontSize: 10, fontWeight: 700,
color: ‘#475569’, letterSpacing: ‘1.5px’, textTransform: ‘uppercase’,
},
balRow: { display: ‘flex’, alignItems: ‘baseline’, gap: 8, marginBottom: 6 },
balValue: { fontSize: 44, fontWeight: 900, color: ‘#fbbf24’, letterSpacing: ‘-2px’, lineHeight: 1 },
balUnit:  { fontSize: 13, fontWeight: 700, color: ‘#78350f’ },
balEst:   { fontSize: 11, color: ‘#1e3a5f’ },

tabBar: {
position: ‘relative’, zIndex: 1,
display: ‘flex’, gap: 6, marginBottom: 16,
padding: 4, borderRadius: 16,
background: ‘rgba(255,255,255,0.03)’,
border: ‘1px solid rgba(255,255,255,0.05)’,
},
tabBtn: {
flex: 1, padding: ‘10px 0’, borderRadius: 12, border: ‘none’,
background: ‘transparent’, color: ‘#334155’,
fontSize: 13, fontWeight: 600, cursor: ‘pointer’, transition: ‘all 0.18s’,
},
tabActive: {
background: ‘rgba(255,255,255,0.07)’,
color: ‘#cbd5e1’,
boxShadow: ‘0 2px 10px rgba(0,0,0,0.3)’,
},

card: {
position: ‘relative’, zIndex: 1,
background: ‘rgba(255,255,255,0.025)’,
border: ‘1px solid rgba(255,255,255,0.07)’,
borderRadius: 20, padding: 16, marginBottom: 14,
boxShadow: ‘0 4px 24px rgba(0,0,0,0.25)’,
},
cardHead: { display: ‘flex’, alignItems: ‘center’, gap: 8, marginBottom: 14, fontSize: 16 },
cardTitle: {
flex: 1, fontSize: 11, fontWeight: 700, color: ‘#94a3b8’,
textTransform: ‘uppercase’, letterSpacing: ‘0.8px’,
},
editBtn: {
fontSize: 11, fontWeight: 700, color: ‘#38bdf8’,
background: ‘rgba(56,189,248,0.1)’, border: ‘1px solid rgba(56,189,248,0.2)’,
borderRadius: 8, padding: ‘3px 10px’, cursor: ‘pointer’,
},

walletRow: { display: ‘flex’, gap: 8 },
input: {
flex: 1, padding: ‘12px 14px’, borderRadius: 12,
background: ‘rgba(0,0,0,0.35)’, border: ‘1px solid rgba(255,255,255,0.1)’,
color: ‘#e2e8f0’, fontSize: 13, fontFamily: ‘monospace’,
outline: ‘none’, boxSizing: ‘border-box’,
},
saveBtn: {
padding: ‘12px 18px’, borderRadius: 12, border: ‘none’,
background: ‘linear-gradient(135deg,#38bdf8,#0ea5e9)’,
color: ‘#fff’, fontWeight: 700, fontSize: 13, cursor: ‘pointer’,
boxShadow: ‘0 4px 16px rgba(56,189,248,0.25)’, whiteSpace: ‘nowrap’,
},
savedBox: {
display: ‘flex’, alignItems: ‘center’, gap: 10,
padding: ‘10px 14px’, borderRadius: 12,
background: ‘rgba(16,185,129,0.06)’,
border: ‘1px solid rgba(16,185,129,0.2)’,
},
savedDot: {
width: 8, height: 8, borderRadius: ‘50%’, flexShrink: 0,
background: ‘#10b981’, boxShadow: ‘0 0 6px #10b981’,
},
savedAddr: { fontSize: 13, color: ‘#6ee7b7’, fontFamily: ‘monospace’, flex: 1 },
savedCheck: { fontSize: 10, fontWeight: 700, color: ‘#10b981’, whiteSpace: ‘nowrap’ },

adCard: {
position: ‘relative’, zIndex: 1,
borderRadius: 16, padding: ‘14px 16px’, marginBottom: 14, border: ‘1px solid’,
},
adRow: { display: ‘flex’, alignItems: ‘center’, justifyContent: ‘space-between’, marginBottom: 12 },
adLeft: { display: ‘flex’, alignItems: ‘center’, gap: 10 },
adStatus: { margin: 0, fontSize: 13, fontWeight: 700 },
adSub: { margin: ‘2px 0 0’, fontSize: 11, color: ‘#475569’ },
adCountTxt: { fontSize: 18, fontWeight: 900 },
progBg: { height: 5, borderRadius: 99, background: ‘rgba(255,255,255,0.05)’ },
progFill: { height: ‘100%’, borderRadius: 99, transition: ‘width 0.6s cubic-bezier(0.4,0,0.2,1)’ },

tiersWrap: { display: ‘flex’, flexDirection: ‘column’, gap: 8 },
tierBtn: {
position: ‘relative’, overflow: ‘hidden’,
display: ‘flex’, alignItems: ‘center’, gap: 12,
padding: ‘14px 16px’, borderRadius: 14,
background: ‘rgba(255,255,255,0.03)’,
border: ‘1px solid rgba(255,255,255,0.07)’,
width: ‘100%’, boxSizing: ‘border-box’,
transition: ‘opacity 0.2s’,
},
tierBtnActive: {
border: ‘1px solid rgba(56,189,248,0.2)’,
boxShadow: ‘0 4px 20px rgba(0,0,0,0.25)’,
},
tierGlow: {
position: ‘absolute’, right: -20, top: ‘50%’,
transform: ‘translateY(-50%)’,
width: 60, height: 60, borderRadius: ‘50%’,
background: ‘radial-gradient(circle,rgba(56,189,248,0.12),transparent 70%)’,
pointerEvents: ‘none’,
},
tierLeft: { display: ‘flex’, alignItems: ‘baseline’, gap: 3, flex: 1 },
tierPts: { fontSize: 22, fontWeight: 900, color: ‘#cbd5e1’, letterSpacing: ‘-0.5px’ },
tierPtsLbl: { fontSize: 11, color: ‘#475569’, fontWeight: 600 },
tierArrow: { fontSize: 15, color: ‘#334155’, fontWeight: 700, minWidth: 20, textAlign: ‘center’ },
tierRight: { display: ‘flex’, alignItems: ‘baseline’, gap: 3 },
tierTon: { fontSize: 22, fontWeight: 900, color: ‘#38bdf8’, letterSpacing: ‘-0.5px’ },
tierTonLbl: { fontSize: 11, color: ‘#1e4a6b’, fontWeight: 600 },

histItem: {
display: ‘flex’, alignItems: ‘center’, justifyContent: ‘space-between’,
padding: ‘12px 14px’, borderRadius: 12,
background: ‘rgba(0,0,0,0.2)’,
border: ‘1px solid rgba(255,255,255,0.05)’,
},
histPts:  { margin: 0, fontSize: 15, fontWeight: 800, color: ‘#fbbf24’ },
histAddr: { margin: ‘3px 0 0’, fontSize: 11, color: ‘#334155’, fontFamily: ‘monospace’ },
badge: {
fontSize: 11, fontWeight: 700, padding: ‘4px 10px’,
borderRadius: 20, border: ‘1px solid’, textTransform: ‘capitalize’,
},

empty: { textAlign: ‘center’, paddingTop: 32, paddingBottom: 12 },
emptyTitle: { fontSize: 15, fontWeight: 700, color: ‘#1e293b’, margin: ‘0 0 4px’ },
emptySub:   { fontSize: 12, color: ‘#0f172a’ },

toast: {
position: ‘fixed’, bottom: 100, left: ‘50%’,
transform: ‘translateX(-50%)’,
display: ‘flex’, alignItems: ‘center’, gap: 10,
padding: ‘13px 20px’, borderRadius: 16,
fontSize: 13, zIndex: 999, maxWidth: ‘88vw’,
backdropFilter: ‘blur(16px)’,
},
};

// Inject font + keyframes once
if (typeof document !== ‘undefined’ && !document.getElementById(‘wallet-page-styles’)) {
const el = document.createElement(‘style’);
el.id = ‘wallet-page-styles’;
el.textContent = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');`;
document.head.appendChild(el);
}