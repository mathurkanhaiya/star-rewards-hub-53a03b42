import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { submitWithdrawal, getWithdrawals } from '@/lib/api';
import { Withdrawal } from '@/types/telegram';
import { supabase } from '@/integrations/supabase/client';

function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    let start = prev.current;
    const diff = value - start;
    const duration = 600;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += increment;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, duration / steps);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* 🔥 FIXED TON ONLY */
const CONVERSION_TIERS = [
  { pts: 5000, ton: 0.05 },
  { pts: 10000, ton: 0.10 },
  { pts: 15000, ton: 0.15 },
  { pts: 20000, ton: 0.20 },
  { pts: 25000, ton: 0.25 },
];

const REQUIRED_ADS = 40;

export default function WalletPage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [points, setPoints] = useState('');
  const [wallet, setWallet] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'withdraw' | 'history'>('withdraw');
  const [adCount, setAdCount] = useState<number>(0);
  const [adCountLoading, setAdCountLoading] = useState(true);

  const availablePoints = balance?.points || 0;
  const minPoints = parseInt(settings.min_withdrawal_points || '10000');
  const withdrawUnlocked = adCount >= REQUIRED_ADS;

  useEffect(() => {
    if (user) {
      getWithdrawals(user.id).then(w => setWithdrawals(w));

      const todayUTC = new Date();
      const startOfDay = new Date(Date.UTC(
        todayUTC.getUTCFullYear(),
        todayUTC.getUTCMonth(),
        todayUTC.getUTCDate()
      )).toISOString();

      supabase
        .from('ad_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfDay)
        .then(({ count }) => {
          setAdCount(count || 0);
          setAdCountLoading(false);
        });
    }
  }, [user]);

  async function handleWithdraw() {
    if (!user) return;

    if (!withdrawUnlocked) {
      triggerHaptic('error');
      setMessage(`Watch ${REQUIRED_ADS - adCount} more ads`);
      return;
    }

    const pts = parseInt(points);

    if (isNaN(pts) || pts < minPoints) {
      triggerHaptic('error');
      setMessage(`Minimum withdrawal: ${minPoints}`);
      return;
    }

    if (pts > availablePoints) {
      triggerHaptic('error');
      setMessage('Insufficient balance');
      return;
    }

    if (!wallet.trim()) {
      triggerHaptic('error');
      setMessage('Enter TON address');
      return;
    }

    triggerHaptic();
    setSubmitting(true);

    const result = await submitWithdrawal(user.id, 'ton', pts, wallet);

    if (result.success) {
      triggerHaptic('success');
      setMessage('✅ Withdrawal submitted!');
      setPoints('');
      setWallet('');
      await refreshBalance();
      getWithdrawals(user.id).then(w => setWithdrawals(w));
    } else {
      triggerHaptic('error');
      setMessage(result.message || 'Withdrawal failed');
    }

    setSubmitting(false);
    setTimeout(() => setMessage(''), 4000);
  }

  const statusColor: Record<string, string> = {
    pending: '#facc15',
    approved: '#22c55e',
    rejected: '#ef4444',
    processing: '#38bdf8',
  };

  const adProgress = Math.min(adCount / REQUIRED_ADS, 1);

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Wallet</h2>
        <p className="text-xs text-gray-400">Withdraw your earnings</p>
      </div>

      {/* BALANCE */}
      <div className="rounded-3xl p-6 mb-6"
        style={{
          background: 'linear-gradient(145deg,#0f172a,#1e293b)',
          border: '1px solid rgba(250,204,21,0.3)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}>
        <div className="text-xs text-gray-400 mb-2">Available Balance</div>
        <div className="text-4xl font-bold text-yellow-400">
          <AnimatedNumber value={availablePoints} /> pts
        </div>
      </div>

      {/* 🔥 CONVERSION CARD */}
      <div className="rounded-3xl p-5 mb-5"
        style={{
          background: 'linear-gradient(145deg,#0f172a,#1e293b)',
          border: '1px solid rgba(59,130,246,0.3)',
        }}>
        <div className="text-sm font-bold mb-4 text-blue-400">
          🔄 Convert PTS → TON
        </div>

        <div className="space-y-2">
          {CONVERSION_TIERS.map((tier, index) => (
            <div
              key={index}
              onClick={() => {
                setPoints(String(tier.pts));
                triggerHaptic();
              }}
              className="flex justify-between px-4 py-3 rounded-xl cursor-pointer active:scale-[0.97]"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <span>{tier.pts.toLocaleString()} pts</span>
              <span className="text-gray-500">→</span>
              <span className="text-blue-400 font-bold">
                {tier.ton.toFixed(2)} TON
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AD REQUIREMENT */}
      <div className="rounded-2xl p-4 mb-5"
        style={{
          background: withdrawUnlocked ? 'rgba(34,197,94,0.08)' : 'rgba(250,204,21,0.08)',
          border: `1px solid ${withdrawUnlocked ? 'rgba(34,197,94,0.3)' : 'rgba(250,204,21,0.3)'}`,
        }}>
        <div className="flex justify-between mb-2">
          <span>{withdrawUnlocked ? '✅ Unlocked' : '🔒 Locked'}</span>
          <span>{adCount}/{REQUIRED_ADS}</span>
        </div>

        <div className="w-full h-2 bg-gray-800 rounded">
          <div
            className="h-full bg-yellow-400 rounded"
            style={{ width: `${adProgress * 100}%` }}
          />
        </div>
      </div>

      {/* INPUT */}
      <input
        type="number"
        value={points}
        onChange={e => setPoints(e.target.value)}
        placeholder={`Min ${minPoints}`}
        className="w-full px-4 py-4 rounded-2xl bg-[#0f172a] border mb-3"
      />

      <input
        type="text"
        value={wallet}
        onChange={e => setWallet(e.target.value)}
        placeholder="Enter TON address"
        className="w-full px-4 py-4 rounded-2xl bg-[#0f172a] border mb-4"
      />

      {message && <div className="mb-3 text-center">{message}</div>}

      <button
        onClick={handleWithdraw}
        disabled={submitting || !withdrawUnlocked}
        className="w-full py-4 rounded-2xl font-bold bg-yellow-400 text-black"
      >
        {submitting ? 'Processing...' : 'Withdraw'}
      </button>
    </div>
  );
}