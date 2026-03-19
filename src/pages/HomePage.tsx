import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  claimDailyReward,
  getTransactions,
  logAdWatch,
  getDailyClaim
} from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";
import AdsgramTask from "@/components/AdsgramTask";

/* =============================== */
type HapticType = "impact" | "success" | "error";

interface Transaction {
  id: string;
  type: string;
  points: number;
}

/* =============================== */
function triggerHaptic(type: HapticType) {
  if (typeof window !== "undefined" && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;

    if (tg?.HapticFeedback) {
      if (type === "impact") tg.HapticFeedback.impactOccurred("medium");
      if (type === "success") tg.HapticFeedback.notificationOccurred("success");
      if (type === "error") tg.HapticFeedback.notificationOccurred("error");
    }
  }
}

/* =============================== */
function AnimatedNumber({ value = 0 }: { value: number }) {
  const [display, setDisplay] = useState<number>(value);
  const prev = useRef<number>(value);

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
      } else {
        setDisplay(Math.floor(start));
      }
    }, 20);

    prev.current = value;

    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* =============================== */
function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* =============================== */
export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyMessage, setDailyMessage] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [adLoading, setAdLoading] = useState(false);
  const [dailyCooldown, setDailyCooldown] = useState(0);
  const [coinBurst, setCoinBurst] = useState(false);
  const [activeTab, setActiveTab] = useState<"earn" | "history">("earn");

  const [adNetwork, setAdNetwork] = useState<"adsgram" | "monetag">("adsgram");
  const [lastAdTime, setLastAdTime] = useState<number>(0);

  const COOLDOWN = 5000;
  const isAdRunning = useRef(false);

  const rewardReceived = useRef(false);

  /* =============================== */
  const onAdsgramReward = useCallback(async () => {
    if (!user) return;

    rewardReceived.current = true;

    triggerHaptic("success");

    await logAdWatch(user.id, "adsgram_reward", 40);
    await refreshBalance();

    const updated = await getTransactions(user.id);
    setTransactions(updated);

    setCoinBurst(true);
    setDailyMessage("+40 pts 🎬 (Adsgram)");

    setTimeout(() => setCoinBurst(false), 1200);
    setTimeout(() => setDailyMessage(""), 3000);

    setAdNetwork("monetag");
  }, [user, refreshBalance]);

  const { showAd: showAdsgramAd } = useRewardedAd(onAdsgramReward);

  /* =============================== */
  const showMonetagAd = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      if (!(window as any).show_10742752) throw new Error();

      await (window as any).show_10742752();

      rewardReceived.current = true;

      triggerHaptic("success");

      await logAdWatch(user.id, "monetag_reward", 15);
      await refreshBalance();

      const updated = await getTransactions(user.id);
      setTransactions(updated);

      setCoinBurst(true);
      setDailyMessage("+15 pts 💰 (Monetag)");

      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(""), 3000);

      setAdNetwork("adsgram");

      return true;
    } catch {
      return false;
    }
  };

  /* =============================== */
  useEffect(() => {
    if (!user) return;

    getTransactions(user.id).then(setTransactions);
    checkDailyCooldown();
  }, [user]);

  useEffect(() => {
    if (dailyCooldown <= 0) return;

    const interval = setInterval(() => {
      setDailyCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [dailyCooldown]);

  async function checkDailyCooldown() {
    if (!user) return;

    const claim = await getDailyClaim(user.id);

    if (claim) {
      const now = new Date();
      const midnightUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1
        )
      );

      const remaining = Math.max(
        0,
        Math.floor((midnightUTC.getTime() - now.getTime()) / 1000)
      );

      setDailyCooldown(remaining);
    }
  }

  async function handleDailyClaim() {
    if (!user || dailyCooldown > 0) return;

    setDailyClaiming(true);

    const result = await claimDailyReward(user.id);

    if (result.success) {
      setDailyMessage(`+${result.points} pts 🔥`);
      await refreshBalance();
    } else {
      setDailyMessage(result.message);
    }

    setDailyClaiming(false);
    setTimeout(() => setDailyMessage(""), 3000);
  }

  /* =============================== */
  async function handleAdClick() {
    if (!user) return;
    if (isAdRunning.current) return;

    const now = Date.now();

    if (now - lastAdTime < COOLDOWN) {
      alert("⏳ Wait a bit...");
      return;
    }

    isAdRunning.current = true;
    setLastAdTime(now);
    setAdLoading(true);
    triggerHaptic("impact");

    rewardReceived.current = false;

    try {
      if (adNetwork === "adsgram") {
        await showAdsgramAd();

        await new Promise((res) => setTimeout(res, 3000));

        if (!rewardReceived.current) {
          const success = await showMonetagAd();
          if (!success) await showAdsgramAd();
        }
      } else {
        const success = await showMonetagAd();
        if (!success) await showAdsgramAd();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdLoading(false);
      isAdRunning.current = false;
    }
  }

  /* =============================== */
  return (
    <div className="px-4 pb-28 text-white bg-gradient-to-b from-black via-slate-900 to-black min-h-screen">
      
      {/* BALANCE CARD */}
      <div className="rounded-3xl p-6 mb-6 text-center bg-gradient-to-br from-yellow-400/10 to-orange-500/10 backdrop-blur-xl border border-yellow-400/20 shadow-xl">
        {coinBurst && <div className="text-4xl animate-bounce">💰</div>}
        <div className="text-xs text-gray-400 mb-1">Total Balance</div>
        <div className="text-5xl font-black text-yellow-400 drop-shadow-lg">
          <AnimatedNumber value={balance?.points || 0} />
        </div>
      </div>

      {/* WATCH AD */}
      <button
        onClick={handleAdClick}
        disabled={adLoading}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-2xl active:scale-95 transition"
      >
        {adLoading ? "Loading..." : "🎬 Watch Ad & Earn"}
      </button>

      {/* DAILY */}
      <div className="p-5 mb-6 flex justify-between bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/10">
        <div>
          <div className="font-bold">🎁 Daily Reward</div>
          <div className="text-xs text-gray-400">
            {dailyMessage ||
              (dailyCooldown > 0
                ? `⏳ ${formatCountdown(dailyCooldown)}`
                : `+${settings?.daily_bonus_base || 100} pts`)}
          </div>
        </div>

        <button
          onClick={handleDailyClaim}
          disabled={dailyCooldown > 0}
          className="px-5 py-2 bg-green-500 rounded-xl font-bold shadow"
        >
          Claim
        </button>
      </div>

      {/* HISTORY */}
      <div className="space-y-3">
        {transactions.map((t) => (
          <div
            key={t.id}
            className="p-4 rounded-xl bg-slate-800/60 backdrop-blur border border-white/10 flex justify-between"
          >
            <div>{t.type}</div>
            <div className="text-yellow-400 font-bold">+{t.points}</div>
          </div>
        ))}
      </div>
    </div>
  );
}