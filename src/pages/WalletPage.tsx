import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { submitWithdrawal } from '@/lib/api';

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
    const inc = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += inc;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else setDisplay(Math.floor(start));
    }, 20);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* TON VALIDATION */
function isValidTon(addr: string) {
  return /^UQ[A-Za-z0-9_-]{46,}$/.test(addr);
}

const TIERS = [
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

  const pts = balance?.points || 0;
  const unlocked = adCount >= REQUIRED_ADS;

  useEffect(() => {
    if (!user) return;
    loadWallet();
    loadAds();
  }, [user]);

  async function loadWallet() {
    const { data } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('telegram_id', user.id)
      .single();

    if (data?.wallet_address) setSavedWallet(data.wallet_address);
  }

  async function saveWallet() {
    if (!isValidTon(wallet)) {
      setMessage('Invalid TON wallet ❌');
      triggerHaptic('error');
      return;
    }

    await supabase
      .from('users')
      .update({ wallet_address: wallet })
      .eq('telegram_id', user.id);

    setSavedWallet(wallet);
    setWallet('');
    setMessage('✅ Wallet saved');
    triggerHaptic('success');
  }

  async function loadAds() {
    const { count } = await supabase
      .from('ad_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setAdCount(count || 0);
  }

  async function withdraw(ptsAmount: number) {
    if (!savedWallet) {
      setMessage('Add wallet first');
      return;
    }
    if (!unlocked) {
      setMessage('Complete ads first');
      return;
    }
    if (pts < ptsAmount) {
      setMessage('Not enough balance');
      return;
    }

    const res = await submitWithdrawal(user.id, 'ton', ptsAmount, savedWallet);

    if (res.success) {
      triggerHaptic('success');
      setMessage('✅ Withdrawal sent');
      refreshBalance();
    } else {
      setMessage('Failed');
    }
  }

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-5">
        <h1 className="text-xl font-bold">Wallet</h1>
        <p className="text-xs text-gray-400">Withdraw your earnings</p>
      </div>

      {/* BALANCE CARD */}
      <div className="p-6 mb-5 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg,#0f172a,#1e293b)',
          border: '1px solid rgba(250,204,21,0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
        <div className="text-xs text-gray-400">Available Balance</div>
        <div className="text-4xl font-bold text-yellow-400">
          <AnimatedNumber value={pts}/> pts
        </div>
      </div>

      {/* WALLET CARD */}
      <div className="p-5 mb-5 rounded-2xl bg-[#0f172a] border border-[#1e293b]">
        <div className="text-sm font-bold mb-2">💼 Wallet</div>

        {savedWallet ? (
          <div className="text-green-400 break-all text-sm">
            {savedWallet}
          </div>
        ) : (
          <>
            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Enter TON wallet"
              className="w-full p-3 rounded-xl bg-black mb-2"
            />
            <button
              onClick={saveWallet}
              className="w-full py-3 rounded-xl bg-blue-500 font-bold"
            >
              Save Wallet
            </button>
          </>
        )}
      </div>

      {/* CONVERSION */}
      <div className="mb-5">
        <div className="text-sm font-bold mb-3 text-blue-400">
          🔄 Convert PTS → TON
        </div>

        <div className="space-y-3">
          {TIERS.map((t, i) => {
            const locked = !unlocked || pts < t.pts;

            return (
              <div
                key={i}
                onClick={() => !locked && withdraw(t.pts)}
                className="p-4 rounded-2xl flex justify-between transition-all active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(145deg,#0f172a,#1e293b)',
                  border: '1px solid #1e293b',
                  opacity: locked ? 0.5 : 1,
                  boxShadow: locked ? 'none' : '0 10px 20px rgba(0,0,0,0.4)'
                }}
              >
                <span>{t.pts.toLocaleString()} pts</span>
                <span className="text-gray-500">→</span>
                <span className="text-blue-400 font-bold">
                  {t.ton.toFixed(2)} TON
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* REQUIREMENT */}
      <div className="p-4 rounded-xl mb-4"
        style={{
          background: unlocked ? 'rgba(34,197,94,0.1)' : 'rgba(250,204,21,0.1)',
          border: `1px solid ${unlocked ? '#22c55e' : '#facc15'}`
        }}>
        {unlocked
          ? '✅ Withdraw unlocked'
          : `🔒 Watch ${REQUIRED_ADS - adCount} more ads`}
      </div>

      {/* MESSAGE */}
      {message && (
        <div className="text-center text-sm text-gray-300">
          {message}
        </div>
      )}
    </div>
  );
}