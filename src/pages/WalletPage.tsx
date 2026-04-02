import React, { useEffect, useState } from ‘react’;
import { useApp } from ‘@/context/AppContext’;
import { supabase } from ‘@/integrations/supabase/client’;
import { submitWithdrawal } from ‘@/lib/api’;

// 1 TON = 150,000 pts
const TON_TIERS = [
{ pts:  5000, ton: 0.033 },
{ pts: 10000, ton: 0.067 },
{ pts: 15000, ton: 0.1   },
{ pts: 20000, ton: 0.133 },
];

// UPI: same 2/3 ratio applied
const UPI_TIERS = [
{ pts:  5000, inr: 3  },
{ pts: 10000, inr: 7  },
{ pts: 15000, inr: 10 },
{ pts: 20000, inr: 13 },
];

const REQUIRED_ADS = 20;
const TON_RATE     = 150000; // pts per 1 TON

function isValidTon(addr: string) {
return /^UQ[A-Za-z0-9_-]{46,}$/.test(addr);
}
function isValidUpi(upi: string) {
return /^[a-zA-Z0-9.-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
}

type ModalMode = ‘ton’ | ‘upi’ | null;

const CSS = `
@import url(‘https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap’);

@keyframes wpShine   { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes wpFadeIn  { from{opacity:0} to{opacity:1} }
@keyframes wpModalUp { from{transform:translateY(22px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes wpPulse   { 0%,100%{opacity:1} 50%{opacity:0.55} }
@keyframes wpGlow    { 0%,100%{box-shadow:0 0 18px rgba(255,190,0,0.18)} 50%{box-shadow:0 0 32px rgba(255,190,0,0.38)} }

.wp-root { font-family:‘Rajdhani’,sans-serif; padding:0 16px 120px; color:#fff; min-height:100vh; }

/* ── Header ── */
.wp-header   { padding:6px 0 18px; }
.wp-eyebrow  { font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:5px; color:rgba(255,255,255,0.18); text-transform:uppercase; margin-bottom:4px; }
.wp-title    { font-family:‘Orbitron’,monospace; font-size:22px; font-weight:900; letter-spacing:2px; color:#fff; line-height:1; }
.wp-title span { color:#ffbe00; text-shadow:0 0 18px rgba(255,190,0,0.45); }

/* ── Balance card ── */
.wp-balance { background:linear-gradient(135deg,rgba(255,190,0,0.06),rgba(255,190,0,0.02)); border:1px solid rgba(255,190,0,0.18); border-radius:22px; padding:22px 20px 18px; margin-bottom:12px; position:relative; overflow:hidden; text-align:center; animation:wpGlow 4s ease-in-out infinite; }
.wp-balance::before { content:’’; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.55),transparent); }
.wp-balance::after  { content:’’; position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px); background-size:28px 28px; pointer-events:none; border-radius:22px; }
.wp-balance-inner { position:relative; z-index:1; }
.wp-bal-label { font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:4px; color:rgba(255,255,255,0.22); text-transform:uppercase; margin-bottom:6px; }
.wp-bal-val   { font-family:‘Orbitron’,monospace; font-size:48px; font-weight:900; line-height:1; color:#ffbe00; text-shadow:0 0 32px rgba(255,190,0,0.45),0 0 64px rgba(255,190,0,0.18); letter-spacing:2px; margin-bottom:4px; }
.wp-bal-sub   { font-size:11px; color:rgba(255,255,255,0.22); letter-spacing:2px; }

/* ── Rate pill ── */
.wp-rate-pill { display:inline-flex; align-items:center; gap:6px; margin-top:10px; padding:5px 14px; border-radius:20px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.2); }
.wp-rate-pill-txt { font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.3); }
.wp-rate-pill-val { font-family:‘Orbitron’,monospace; font-size:10px; font-weight:700; color:#ffbe00; letter-spacing:1px; }

/* ── Ads progress ── */
.wp-ads-card { background:rgba(255,255,255,0.02); border:1px solid rgba(34,211,238,0.12); border-radius:18px; padding:16px 18px; margin-bottom:16px; position:relative; overflow:hidden; }
.wp-ads-card::before { content:’’; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(34,211,238,0.3),transparent); }
.wp-ads-top  { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.wp-ads-label{ font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.2); text-transform:uppercase; }
.wp-ads-count{ font-family:‘Orbitron’,monospace; font-size:13px; font-weight:700; color:#22d3ee; letter-spacing:1px; }
.wp-progress-track{ height:7px; border-radius:4px; background:rgba(255,255,255,0.06); overflow:hidden; margin-bottom:8px; }
.wp-progress-fill { height:100%; border-radius:4px; background:linear-gradient(90deg,#22d3ee,#06b6d4); transition:width 0.7s cubic-bezier(0.34,1.56,0.64,1); box-shadow:0 0 10px rgba(34,211,238,0.5); }
.wp-ads-msg  { font-size:11px; color:rgba(255,255,255,0.22); letter-spacing:1px; }
.wp-ads-msg.done { color:#4ade80; }

/* ── Section label ── */
.wp-section-label { font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.15); text-transform:uppercase; margin-bottom:10px; padding-left:2px; }

/* ── Tier grid ── */
.wp-tier-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }

.wp-tier { border-radius:18px; padding:16px 14px 14px; position:relative; overflow:hidden; transition:transform 0.15s,box-shadow 0.2s; cursor:pointer; }
.wp-tier.locked   { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); cursor:not-allowed; opacity:0.45; }
.wp-tier.ton-unlocked { background:linear-gradient(135deg,rgba(34,211,238,0.07),rgba(34,211,238,0.02)); border:1px solid rgba(34,211,238,0.22); }
.wp-tier.ton-unlocked:active { transform:scale(0.96); }
.wp-tier.ton-unlocked::before { content:’’; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(34,211,238,0.45),transparent); }
.wp-tier.ton-unlocked::after  { content:’’; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent); animation:wpShine 4s ease-in-out infinite; }
.wp-tier.upi-unlocked { background:linear-gradient(135deg,rgba(99,102,241,0.07),rgba(99,102,241,0.02)); border:1px solid rgba(99,102,241,0.22); }
.wp-tier.upi-unlocked:active { transform:scale(0.96); }
.wp-tier.upi-unlocked::before { content:’’; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(99,102,241,0.45),transparent); }
.wp-tier.upi-unlocked::after  { content:’’; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent); animation:wpShine 4s ease-in-out infinite; }

.wp-tier-lock   { position:absolute; top:10px; right:10px; font-size:12px; opacity:0.4; }
.wp-tier-pts    { font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:1px; color:rgba(255,255,255,0.28); margin-bottom:6px; }
.wp-tier-val    { font-family:‘Orbitron’,monospace; font-size:20px; font-weight:700; line-height:1; margin-bottom:6px; }
.wp-tier-val.ton-val { color:#22d3ee; text-shadow:0 0 14px rgba(34,211,238,0.4); }
.wp-tier-val.upi-val { color:#818cf8; text-shadow:0 0 14px rgba(99,102,241,0.4); }
.wp-tier-val.locked-val { color:rgba(255,255,255,0.2); }

/* Mini pts-need bar */
.wp-tier-mini-bar { height:3px; border-radius:2px; background:rgba(255,255,255,0.06); overflow:hidden; margin-bottom:5px; }
.wp-tier-mini-fill-ton { height:100%; border-radius:2px; background:linear-gradient(90deg,#22d3ee,#06b6d4); transition:width 0.5s; }
.wp-tier-mini-fill-upi { height:100%; border-radius:2px; background:linear-gradient(90deg,#6366f1,#4338ca); transition:width 0.5s; }

.wp-tier-reason { font-size:9px; color:rgba(239,68,68,0.55); letter-spacing:0.5px; margin-top:2px; }
.wp-tier-tap    { font-size:9px; color:rgba(255,255,255,0.2); letter-spacing:0.5px; margin-top:2px; }

/* ── UPI section wrapper ── */
.wp-upi-section { background:rgba(255,255,255,0.015); border:1px solid rgba(99,102,241,0.15); border-radius:22px; padding:18px; margin-bottom:14px; position:relative; overflow:hidden; margin-top:20px; }
.wp-upi-section::before { content:’’; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(99,102,241,0.4),transparent); }
.wp-upi-header { display:flex; align-items:center; gap:10px; margin-bottom:4px; }
.wp-upi-flag   { font-size:22px; }
.wp-upi-title  { font-family:‘Orbitron’,monospace; font-size:13px; font-weight:900; letter-spacing:1.5px; color:#fff; }
.wp-upi-badge  { margin-left:auto; padding:3px 10px; border-radius:20px; background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.25); font-family:‘Orbitron’,monospace; font-size:8px; font-weight:700; letter-spacing:1.5px; color:#818cf8; }
.wp-upi-sub    { font-size:12px; color:rgba(255,255,255,0.22); letter-spacing:0.5px; margin-bottom:14px; }

/* ── Modal ── */
.wp-modal-overlay { position:fixed; inset:0; background:rgba(3,5,10,0.9); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px; animation:wpFadeIn 0.2s ease; }
.wp-modal { background:rgba(6,8,15,0.99); border-radius:26px; width:100%; max-width:360px; padding:26px 22px 20px; position:relative; overflow:hidden; animation:wpModalUp 0.3s cubic-bezier(0.34,1.2,0.64,1); }
.wp-modal.ton-modal { border:1px solid rgba(255,190,0,0.2); }
.wp-modal.ton-modal::before { content:’’; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.55),transparent); }
.wp-modal.upi-modal { border:1px solid rgba(99,102,241,0.25); }
.wp-modal.upi-modal::before { content:’’; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(99,102,241,0.55),transparent); }
.wp-modal::after { content:’’; position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.01) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.01) 1px,transparent 1px); background-size:28px 28px; pointer-events:none; border-radius:26px; }
.wp-modal-inner { position:relative; z-index:1; }

.wp-modal-badge { display:inline-block; padding:3px 10px; border-radius:20px; background:rgba(34,211,238,0.08); border:1px solid rgba(34,211,238,0.2); font-family:‘Orbitron’,monospace; font-size:8px; letter-spacing:2px; color:#22d3ee; margin-bottom:8px; }
.wp-modal-badge.upi-badge-m { background:rgba(99,102,241,0.08); border-color:rgba(99,102,241,0.2); color:#818cf8; }
.wp-modal-title { font-family:‘Orbitron’,monospace; font-size:17px; font-weight:900; letter-spacing:2px; color:#fff; margin-bottom:2px; }
.wp-modal-sub   { font-size:12px; color:rgba(255,255,255,0.25); letter-spacing:1px; margin-bottom:18px; }

/* Big amount display */
.wp-modal-amount-box { background:rgba(0,0,0,0.3); border-radius:16px; padding:16px; text-align:center; margin-bottom:18px; }
.wp-modal-ton   { font-family:‘Orbitron’,monospace; font-size:38px; font-weight:900; color:#22d3ee; letter-spacing:2px; text-shadow:0 0 28px rgba(34,211,238,0.45); line-height:1; }
.wp-modal-inr   { font-family:‘Orbitron’,monospace; font-size:38px; font-weight:900; color:#818cf8; letter-spacing:2px; text-shadow:0 0 28px rgba(99,102,241,0.45); line-height:1; }
.wp-modal-pts-cost { font-size:11px; color:rgba(255,255,255,0.22); letter-spacing:2px; margin-top:5px; }

.wp-input-label { font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.22); text-transform:uppercase; margin-bottom:6px; }
.wp-input { width:100%; padding:13px 14px; border-radius:14px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); color:#fff; font-family:‘Rajdhani’,sans-serif; font-size:13px; outline:none; margin-bottom:14px; transition:border-color 0.2s; box-sizing:border-box; }
.wp-input:focus { border-color:rgba(34,211,238,0.4); }
.wp-input.upi-focus:focus { border-color:rgba(99,102,241,0.5); }
.wp-input::placeholder { color:rgba(255,255,255,0.15); }

.wp-modal-ads { display:flex; align-items:center; justify-content:space-between; background:rgba(34,211,238,0.04); border:1px solid rgba(34,211,238,0.12); border-radius:12px; padding:10px 14px; margin-bottom:14px; }
.wp-modal-ads-label { font-family:‘Orbitron’,monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; }
.wp-modal-ads-val   { font-family:‘Orbitron’,monospace; font-size:13px; font-weight:700; color:#22d3ee; }

.wp-upi-warn { display:flex; align-items:flex-start; gap:8px; background:rgba(251,191,36,0.04); border:1px solid rgba(251,191,36,0.12); border-radius:12px; padding:10px 14px; margin-bottom:14px; font-size:11px; color:rgba(255,255,255,0.3); line-height:1.5; letter-spacing:0.5px; }

.wp-msg { font-family:‘Orbitron’,monospace; font-size:10px; letter-spacing:2px; text-align:center; padding:9px 14px; border-radius:10px; margin-bottom:14px; animation:wpFadeIn 0.2s ease; }
.wp-msg.error   { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#f87171; }
.wp-msg.success { background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); color:#4ade80; }

.wp-confirm-btn { width:100%; padding:16px; border-radius:14px; border:none; background:linear-gradient(135deg,#22d3ee,#06b6d4,#0891b2); color:#020d12; font-family:‘Orbitron’,monospace; font-size:13px; font-weight:700; letter-spacing:2px; cursor:pointer; transition:transform 0.12s,box-shadow 0.2s; box-shadow:0 4px 22px rgba(34,211,238,0.3); margin-bottom:10px; position:relative; overflow:hidden; }
.wp-confirm-btn::after { content:’’; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:wpShine 3s ease-in-out infinite; }
.wp-confirm-btn:active { transform:scale(0.97); }
.wp-confirm-btn.upi-btn { background:linear-gradient(135deg,#6366f1,#4f46e5,#4338ca); color:#fff; box-shadow:0 4px 22px rgba(99,102,241,0.35); }
.wp-confirm-btn:disabled { opacity:0.6; cursor:not-allowed; }

.wp-cancel-btn { width:100%; padding:12px; border-radius:14px; border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.03); color:rgba(255,255,255,0.28); font-family:‘Orbitron’,monospace; font-size:11px; letter-spacing:1px; cursor:pointer; transition:background 0.15s; }
.wp-cancel-btn:hover { background:rgba(255,255,255,0.06); }

/* ── Rate info banner ── */
.wp-rate-banner { display:flex; align-items:center; justify-content:space-between; background:rgba(255,190,0,0.04); border:1px solid rgba(255,190,0,0.12); border-radius:14px; padding:12px 16px; margin-bottom:12px; }
.wp-rate-banner-label { font-family:‘Orbitron’,monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.2); }
.wp-rate-banner-val   { font-family:‘Orbitron’,monospace; font-size:12px; font-weight:700; color:#ffbe00; letter-spacing:1px; }
`;

export default function WalletPage() {
const { user, balance, refreshBalance } = useApp();
const [adCount, setAdCount]                     = useState(0);
const [modalMode, setModalMode]                 = useState<ModalMode>(null);
const [selectedTonTier, setSelectedTonTier]     = useState<typeof TON_TIERS[0] | null>(null);
const [selectedUpiTier, setSelectedUpiTier]     = useState<typeof UPI_TIERS[0] | null>(null);
const [wallet, setWallet]                       = useState(’’);
const [upiId, setUpiId]                         = useState(’’);
const [message, setMessage]                     = useState(’’);
const [msgType, setMsgType]                     = useState<‘error’ | ‘success’>(‘error’);
const [submitting, setSubmitting]               = useState(false);

const pts         = balance?.points || 0;
const progress    = Math.min((adCount / REQUIRED_ADS) * 100, 100);
const adsComplete = adCount >= REQUIRED_ADS;

useEffect(() => {
if (!user) return;
const now = new Date();
const startOfDay = new Date(Date.UTC(
now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
)).toISOString();
supabase
.from(‘ad_logs’)
.select(‘id’, { count: ‘exact’, head: true })
.eq(‘user_id’, user.id)
.gte(‘created_at’, startOfDay)
.then(({ count }) => setAdCount(count || 0));
}, [user]);

function openTonModal(tier: typeof TON_TIERS[0]) {
setSelectedTonTier(tier); setModalMode(‘ton’); setMessage(’’); setWallet(’’);
}
function openUpiModal(tier: typeof UPI_TIERS[0]) {
setSelectedUpiTier(tier); setModalMode(‘upi’); setMessage(’’); setUpiId(’’);
}
function closeModal() {
setModalMode(null); setSelectedTonTier(null); setSelectedUpiTier(null);
setMessage(’’); setWallet(’’); setUpiId(’’);
}

async function handleTonWithdraw() {
if (!selectedTonTier || submitting) return;
if (!isValidTon(wallet.trim()))      { setMessage(‘Invalid TON address’); setMsgType(‘error’); return; }
if (pts < selectedTonTier.pts)       { setMessage(‘Not enough points’);   setMsgType(‘error’); return; }
if (!adsComplete)                    { setMessage(`Watch ${REQUIRED_ADS - adCount} more ads`); setMsgType(‘error’); return; }
setSubmitting(true);
const res = await submitWithdrawal(user!.id, ‘ton’, selectedTonTier.pts, wallet.trim());
if (res.success) {
setMessage(‘Withdrawal submitted!’); setMsgType(‘success’);
refreshBalance();
setTimeout(() => { closeModal(); setSubmitting(false); }, 1800);
} else {
setMessage(res.message || ‘Failed’); setMsgType(‘error’); setSubmitting(false);
}
}

async function handleUpiWithdraw() {
if (!selectedUpiTier || submitting) return;
if (!isValidUpi(upiId.trim()))       { setMessage(‘Invalid UPI ID’);    setMsgType(‘error’); return; }
if (pts < selectedUpiTier.pts)       { setMessage(‘Not enough points’); setMsgType(‘error’); return; }
if (!adsComplete)                    { setMessage(`Watch ${REQUIRED_ADS - adCount} more ads`); setMsgType(‘error’); return; }
setSubmitting(true);
const res = await submitWithdrawal(user!.id, ‘upi’, selectedUpiTier.pts, upiId.trim());
if (res.success) {
setMessage(‘UPI Withdrawal submitted!’); setMsgType(‘success’);
refreshBalance();
setTimeout(() => { closeModal(); setSubmitting(false); }, 1800);
} else {
setMessage(res.message || ‘Failed’); setMsgType(‘error’); setSubmitting(false);
}
}

return (
<>
<style>{CSS}</style>
<div className="wp-root">

```
    {/* Header */}
    <div className="wp-header">
      <div className="wp-eyebrow">Withdraw · TON · UPI</div>
      <div className="wp-title">MY <span>WALLET</span></div>
    </div>

    {/* Balance */}
    <div className="wp-balance">
      <div className="wp-balance-inner">
        <div className="wp-bal-label">Available Balance</div>
        <div className="wp-bal-val">{pts.toLocaleString()}</div>
        <div className="wp-bal-sub">Points · Ready to withdraw</div>
        <div style={{ display:'flex', justifyContent:'center', marginTop:10, gap:8 }}>
          <div className="wp-rate-pill">
            <div className="wp-rate-pill-txt">TON RATE</div>
            <div className="wp-rate-pill-val">150K pts = 1 TON</div>
          </div>
        </div>
      </div>
    </div>

    {/* Ads progress */}
    <div className="wp-ads-card">
      <div className="wp-ads-top">
        <div className="wp-ads-label">Daily Ads Progress</div>
        <div className="wp-ads-count">{adCount} / {REQUIRED_ADS}</div>
      </div>
      <div className="wp-progress-track">
        <div className="wp-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className={`wp-ads-msg ${adsComplete ? 'done' : ''}`}>
        {adsComplete
          ? '✦ Requirement met — withdrawals unlocked'
          : `Watch ${REQUIRED_ADS - adCount} more ads to unlock withdrawals`}
      </div>
    </div>

    {/* ── TON TIERS ── */}
    <div className="wp-section-label">💎 Withdraw TON</div>
    <div className="wp-tier-grid" style={{ marginBottom: 6 }}>
      {TON_TIERS.map((t, i) => {
        const notEnoughPts = pts < t.pts;
        const locked       = notEnoughPts || !adsComplete;
        const fillPct      = Math.min((pts / t.pts) * 100, 100);
        return (
          <div
            key={i}
            className={`wp-tier ${locked ? 'locked' : 'ton-unlocked'}`}
            onClick={() => !locked && openTonModal(t)}
          >
            {locked && <div className="wp-tier-lock">🔒</div>}
            <div className="wp-tier-pts">{t.pts.toLocaleString()} pts</div>
            <div className={`wp-tier-val ${locked ? 'locked-val' : 'ton-val'}`}>
              {t.ton} TON
            </div>
            <div className="wp-tier-mini-bar">
              <div className="wp-tier-mini-fill-ton" style={{ width: `${fillPct}%` }} />
            </div>
            {locked
              ? <div className="wp-tier-reason">
                  {notEnoughPts ? `Need ${(t.pts - pts).toLocaleString()} more` : 'Complete daily ads'}
                </div>
              : <div className="wp-tier-tap">Tap to withdraw →</div>
            }
          </div>
        );
      })}
    </div>

    {/* ── UPI SECTION ── */}
    <div className="wp-upi-section">
      <div className="wp-upi-header">
        <span className="wp-upi-flag">🇮🇳</span>
        <span className="wp-upi-title">UPI Withdraw</span>
        <div className="wp-upi-badge">INDIA ONLY</div>
      </div>
      <div className="wp-upi-sub">Instant INR to Paytm · PhonePe · GPay</div>
      <div className="wp-section-label">Select Amount</div>
      <div className="wp-tier-grid">
        {UPI_TIERS.map((t, i) => {
          const notEnoughPts = pts < t.pts;
          const locked       = notEnoughPts || !adsComplete;
          const fillPct      = Math.min((pts / t.pts) * 100, 100);
          return (
            <div
              key={i}
              className={`wp-tier ${locked ? 'locked' : 'upi-unlocked'}`}
              onClick={() => !locked && openUpiModal(t)}
            >
              {locked && <div className="wp-tier-lock">🔒</div>}
              <div className="wp-tier-pts">{t.pts.toLocaleString()} pts</div>
              <div className={`wp-tier-val ${locked ? 'locked-val' : 'upi-val'}`}>
                ₹{t.inr}
              </div>
              <div className="wp-tier-mini-bar">
                <div className="wp-tier-mini-fill-upi" style={{ width: `${fillPct}%` }} />
              </div>
              {locked
                ? <div className="wp-tier-reason">
                    {notEnoughPts ? `Need ${(t.pts - pts).toLocaleString()} more` : 'Complete daily ads'}
                  </div>
                : <div className="wp-tier-tap">Tap to withdraw →</div>
              }
            </div>
          );
        })}
      </div>
    </div>

    {/* ── TON MODAL ── */}
    {modalMode === 'ton' && selectedTonTier && (
      <div className="wp-modal-overlay"
        onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="wp-modal ton-modal">
          <div className="wp-modal-inner">
            <div className="wp-modal-badge">TON NETWORK</div>
            <div className="wp-modal-title">Withdraw TON</div>
            <div className="wp-modal-sub">{selectedTonTier.pts.toLocaleString()} pts deducted</div>
            <div className="wp-modal-amount-box">
              <div className="wp-modal-ton">{selectedTonTier.ton} TON</div>
              <div className="wp-modal-pts-cost">— {selectedTonTier.pts.toLocaleString()} Points</div>
            </div>

            <div className="wp-input-label">TON Wallet Address</div>
            <input className="wp-input"
              value={wallet} onChange={e => setWallet(e.target.value)}
              placeholder="UQ..." autoComplete="off" spellCheck={false} />

            <div className="wp-modal-ads">
              <div className="wp-modal-ads-label">Daily Ads</div>
              <div className="wp-modal-ads-val">{adCount} / {REQUIRED_ADS} {adsComplete ? '✓' : ''}</div>
            </div>

            {message && <div className={`wp-msg ${msgType}`}>{message}</div>}

            <button className="wp-confirm-btn" onClick={handleTonWithdraw} disabled={submitting}>
              {submitting ? '···' : 'CONFIRM WITHDRAW'}
            </button>
            <button className="wp-cancel-btn" onClick={closeModal}>Cancel</button>
          </div>
        </div>
      </div>
    )}

    {/* ── UPI MODAL ── */}
    {modalMode === 'upi' && selectedUpiTier && (
      <div className="wp-modal-overlay"
        onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="wp-modal upi-modal">
          <div className="wp-modal-inner">
            <div className="wp-modal-badge upi-badge-m">🇮🇳 UPI · INDIA</div>
            <div className="wp-modal-title">UPI Withdraw</div>
            <div className="wp-modal-sub">{selectedUpiTier.pts.toLocaleString()} pts deducted</div>
            <div className="wp-modal-amount-box">
              <div className="wp-modal-inr">₹{selectedUpiTier.inr}</div>
              <div className="wp-modal-pts-cost">— {selectedUpiTier.pts.toLocaleString()} Points</div>
            </div>

            <div className="wp-input-label">Your UPI ID</div>
            <input className="wp-input upi-focus"
              value={upiId} onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi / phone@paytm"
              autoComplete="off" spellCheck={false} inputMode="email" />

            <div className="wp-modal-ads">
              <div className="wp-modal-ads-label">Daily Ads</div>
              <div className="wp-modal-ads-val">{adCount} / {REQUIRED_ADS} {adsComplete ? '✓' : ''}</div>
            </div>

            <div className="wp-upi-warn">
              <span>⚠️</span>
              <span>Processed manually within 24–48 hrs. Double-check your UPI ID.</span>
            </div>

            {message && <div className={`wp-msg ${msgType}`}>{message}</div>}

            <button className="wp-confirm-btn upi-btn" onClick={handleUpiWithdraw} disabled={submitting}>
              {submitting ? '···' : '🇮🇳 CONFIRM UPI WITHDRAW'}
            </button>
            <button className="wp-cancel-btn" onClick={closeModal}>Cancel</button>
          </div>
        </div>
      </div>
    )}

  </div>
</>
```

);
}