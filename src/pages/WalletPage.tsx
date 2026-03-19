import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { submitWithdrawal } from '@/lib/api';
import confetti from 'canvas-confetti';

const TIERS = [
  { pts: 5000, ton: 0.05 },
  { pts: 10000, ton: 0.10 },
  { pts: 15000, ton: 0.15 },
  { pts: 20000, ton: 0.20 },
  { pts: 25000, ton: 0.25 },
  { pts: 30000, ton: 0.30 },
];

const REQUIRED_ADS = 40;

function isValidTon(addr: string) {
  return /^UQ[A-Za-z0-9_-]{46,}$/.test(addr);
}

export default function WalletPage() {
  const { user, balance, refreshBalance } = useApp();

  const [adCount, setAdCount] = useState(0);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [wallet, setWallet] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const pts = balance?.points || 0;

  /* ✅ DAILY ADS */
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  /* 📋 AUTO PASTE WALLET */
  async function pasteWallet() {
    try {
      const text = await navigator.clipboard.readText();
      if (isValidTon(text)) {
        setWallet(text);
      } else {
        setMessage('Clipboard has invalid wallet');
      }
    } catch {
      setMessage('Clipboard access denied');
    }
  }

  /* 💰 WITHDRAW */
  async function handleWithdraw() {
    if (!selectedTier) return;

    if (!isValidTon(wallet)) {
      setMessage('Invalid TON wallet ❌');
      return;
    }

    if (adCount < REQUIRED_ADS) {
      setMessage(`Watch ${REQUIRED_ADS - adCount} more ads`);
      return;
    }

    if (pts < selectedTier.pts) {
      setMessage('Not enough balance');
      return;
    }

    setLoading(true);

    const res = await submitWithdrawal(
      user.id,
      'ton',
      selectedTier.pts,
      wallet
    );

    setLoading(false);

    if (res.success) {
      confetti({ particleCount: 120, spread: 70 });
      setMessage('✅ Success!');
      setSelectedTier(null);
      setWallet('');
      refreshBalance();
    } else {
      setMessage('Failed');
    }
  }

  return (
    <div className="px-4 pb-24 text-white">

      {/* BALANCE */}
      <div className="mb-5 p-5 rounded-2xl bg-[#0f172a] border">
        <div className="text-sm text-gray-400">Balance</div>
        <div className="text-3xl text-yellow-400 font-bold">
          {pts.toLocaleString()} pts
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {TIERS.map((t, i) => {
          const locked = pts < t.pts || adCount < REQUIRED_ADS;

          return (
            <div
              key={i}
              onClick={() => !locked && setSelectedTier(t)}
              className="p-4 rounded-xl text-center transition-all"
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                opacity: locked ? 0.4 : 1,
                pointerEvents: locked ? 'none' : 'auto'
              }}
            >
              <div className="text-sm">{t.pts} pts</div>
              <div className="text-blue-400 font-bold">
                {t.ton} TON
              </div>
            </div>
          );
        })}
      </div>

      {/* REQUIREMENT */}
      <div className="p-4 rounded-xl bg-[#0f172a] border mb-5">
        {adCount >= REQUIRED_ADS
          ? '✅ Ready to withdraw'
          : `🔒 Watch ${REQUIRED_ADS - adCount} ads`}
      </div>

      {/* 💎 POPUP */}
      {selectedTier && (
        <div className="fixed inset-0 backdrop-blur-xl bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl w-[90%] max-w-sm shadow-xl">

            <div className="text-lg font-bold mb-2">
              Withdraw {selectedTier.ton} TON
            </div>

            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Enter TON wallet"
              className="w-full p-3 rounded bg-black/40 mb-2"
            />

            {/* 📋 Paste Button */}
            <button
              onClick={pasteWallet}
              className="text-xs text-blue-400 mb-3"
            >
              📋 Paste from clipboard
            </button>

            <div className="text-xs mb-3 text-gray-400">
              Ads today: {adCount}/{REQUIRED_ADS}
            </div>

            {message && (
              <div className="text-sm text-red-400 mb-2">
                {message}
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={loading}
              className="w-full py-3 bg-yellow-400 text-black rounded-xl font-bold flex justify-center items-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Confirm Withdraw'
              )}
            </button>

            <button
              onClick={() => {
                setSelectedTier(null);
                setMessage('');
              }}
              className="w-full mt-2 text-sm text-gray-400"
            >
              Cancel
            </button>

          </div>
        </div>
      )}
    </div>
  );
}