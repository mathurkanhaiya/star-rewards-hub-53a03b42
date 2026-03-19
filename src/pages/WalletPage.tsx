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
    }, 20);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* 🔥 FIXED CARDS */
const CONVERSION_TIERS = [
  { pts: 5000, ton: 0.05 },
  { pts: 10000, ton: 0.10 },
  { pts: 15000, ton: 0.15 },
  { pts: 20000, ton: 0.20 },
  { pts: 25000, ton: 0.25 },
];

const REQUIRED_ADS = 40;

export default function WalletPage() {
  const { user, balance, refreshBalance } = useApp();

  const [wallet, setWallet] = useState('');
  const [savedWallet, setSavedWallet] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [message, setMessage] = useState('');
  const [adCount, setAdCount] = useState(0);

  const availablePoints = balance?.points || 0;
  const withdrawUnlocked = adCount >= REQUIRED_ADS;

  useEffect(() => {
    if (user) {
      getWithdrawals(user.id).then(setWithdrawals);

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
        .then(({ count }) => setAdCount(count || 0));
    }
  }, [user]);

  /* ✅ SAVE WALLET */
  function handleSaveWallet() {
    if (!wallet.trim()) {
      setMessage('Enter wallet address');
      return;
    }
    setSavedWallet(wallet);
    setWallet('');
    setMessage('✅ Wallet saved');
  }

  /* 💰 WITHDRAW FROM CARD */
  async function handleCardWithdraw(pts: number) {
    if (!user) return;

    if (!savedWallet) {
      setMessage('Add wallet first');
      triggerHaptic('error');
      return;
    }

    if (!withdrawUnlocked) {
      setMessage('Watch more ads');
      triggerHaptic('error');
      return;
    }

    if (availablePoints < pts) {
      setMessage('Not enough balance');
      triggerHaptic('error');
      return;
    }

    const res = await submitWithdrawal(user.id, 'ton', pts, savedWallet);

    if (res.success) {
      triggerHaptic('success');
      setMessage('✅ Withdraw successful');
      await refreshBalance();
    } else {
      triggerHaptic('error');
      setMessage('Failed');
    }
  }

  return (
    <div className="px-4 pb-28 text-white">

      {/* BALANCE */}
      <div className="rounded-3xl p-6 mb-5 bg-[#0f172a] border">
        <div className="text-sm text-gray-400">Available Balance</div>
        <div className="text-3xl font-bold text-yellow-400">
          <AnimatedNumber value={availablePoints} /> pts
        </div>
      </div>

      {/* 🔥 ADD WALLET */}
      <div className="mb-5 p-4 rounded-2xl bg-[#0f172a] border">
        <div className="text-sm mb-2 font-bold">💼 Your Wallet</div>

        {savedWallet ? (
          <div className="text-green-400 text-sm break-all">
            {savedWallet}
          </div>
        ) : (
          <>
            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Enter TON address"
              className="w-full p-3 rounded bg-black mb-2"
            />
            <button
              onClick={handleSaveWallet}
              className="w-full py-2 bg-blue-500 rounded"
            >
              Save Wallet
            </button>
          </>
        )}
      </div>

      {/* 🔄 CONVERSION CARDS */}
      <div className="space-y-3 mb-5">
        {CONVERSION_TIERS.map((tier, i) => {
          const locked = !withdrawUnlocked || availablePoints < tier.pts;

          return (
            <div
              key={i}
              onClick={() => !locked && handleCardWithdraw(tier.pts)}
              className="flex justify-between p-4 rounded-xl cursor-pointer"
              style={{
                opacity: locked ? 0.5 : 1,
                background: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <span>{tier.pts.toLocaleString()} pts</span>
              <span>→</span>
              <span className="text-blue-400 font-bold">
                {tier.ton.toFixed(2)} TON
              </span>
            </div>
          );
        })}
      </div>

      {/* 🔒 REQUIREMENT */}
      <div className="p-4 rounded-xl bg-[#0f172a] border mb-4">
        <div className="text-sm">
          {withdrawUnlocked
            ? '✅ Withdraw unlocked'
            : `🔒 Watch ${REQUIRED_ADS - adCount} ads`}
        </div>
      </div>

      {message && (
        <div className="text-center text-sm">{message}</div>
      )}
    </div>
  );
}