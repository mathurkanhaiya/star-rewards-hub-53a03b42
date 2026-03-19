import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { submitWithdrawal, getWithdrawals } from '@/lib/api';
import { Withdrawal } from '@/types/telegram';
import { supabase } from '@/integrations/supabase/client';

function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  const tg = (window as any)?.Telegram?.WebApp;
  if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
  else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
  else tg?.HapticFeedback?.impactOccurred('medium');
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

/* 🔥 TON VALIDATION */
function isValidTonAddress(address: string) {
  return /^UQ[A-Za-z0-9_-]{46,}$/.test(address);
}

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
  const [message, setMessage] = useState('');
  const [adCount, setAdCount] = useState(0);

  const availablePoints = balance?.points || 0;
  const withdrawUnlocked = adCount >= REQUIRED_ADS;

  useEffect(() => {
    if (user) {
      loadWallet();
      loadAds();
    }
  }, [user]);

  /* 🔥 LOAD WALLET FROM DB */
  async function loadWallet() {
    const { data } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (data?.wallet_address) {
      setSavedWallet(data.wallet_address);
    }
  }

  /* 🔥 SAVE WALLET TO DB */
  async function handleSaveWallet() {
    if (!isValidTonAddress(wallet)) {
      setMessage('Invalid TON wallet');
      triggerHaptic('error');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ wallet_address: wallet })
      .eq('id', user.id);

    if (error) {
      setMessage('Failed to save wallet');
      return;
    }

    setSavedWallet(wallet);
    setWallet('');
    setMessage('✅ Wallet saved');
    triggerHaptic('success');
  }

  /* 🔥 LOAD ADS */
  async function loadAds() {
    const todayUTC = new Date();
    const startOfDay = new Date(Date.UTC(
      todayUTC.getUTCFullYear(),
      todayUTC.getUTCMonth(),
      todayUTC.getUTCDate()
    )).toISOString();

    const { count } = await supabase
      .from('ad_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfDay);

    setAdCount(count || 0);
  }

  /* 💰 WITHDRAW */
  async function handleWithdraw(pts: number) {
    if (!savedWallet) {
      setMessage('Add wallet first');
      return;
    }

    if (!withdrawUnlocked) {
      setMessage('Watch more ads');
      return;
    }

    if (availablePoints < pts) {
      setMessage('Not enough balance');
      return;
    }

    const res = await submitWithdrawal(user.id, 'ton', pts, savedWallet);

    if (res.success) {
      setMessage('✅ Withdraw success');
      await refreshBalance();
    } else {
      setMessage('Failed');
    }
  }

  return (
    <div className="px-4 pb-28 text-white">

      {/* BALANCE */}
      <div className="p-6 mb-5 bg-[#0f172a] rounded-2xl">
        <div>Balance</div>
        <div className="text-3xl text-yellow-400">
          <AnimatedNumber value={availablePoints} /> pts
        </div>
      </div>

      {/* WALLET */}
      <div className="p-4 mb-5 bg-[#0f172a] rounded-2xl">
        <div className="mb-2">Wallet</div>

        {savedWallet ? (
          <div className="text-green-400 break-all">
            {savedWallet}
          </div>
        ) : (
          <>
            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Enter TON wallet"
              className="w-full p-3 mb-2 bg-black rounded"
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

      {/* CARDS */}
      <div className="space-y-3">
        {CONVERSION_TIERS.map((tier, i) => {
          const locked = !withdrawUnlocked || availablePoints < tier.pts;

          return (
            <div
              key={i}
              onClick={() => !locked && handleWithdraw(tier.pts)}
              className="p-4 rounded-xl flex justify-between"
              style={{ opacity: locked ? 0.5 : 1 }}
            >
              <span>{tier.pts}</span>
              <span>{tier.ton} TON</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}