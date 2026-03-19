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

/* ===============================
   TELEGRAM HAPTIC
================================ */
type HapticType = "impact" | "success" | "error";

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

/* ===============================
   Animated Balance
================================ */
interface AnimatedNumberProps {
  value: number;
}

function AnimatedNumber({ value }: AnimatedNumberProps) {
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
      } else {
        setDisplay(Math.floor(start));
      }
    }, 20);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* ===============================
   Countdown Formatter
================================ */
function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ===============================
   HOME PAGE
================================ */
export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyMessage, setDailyMessage] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [adLoading, setAdLoading] = useState(false);
  const [dailyCooldown, setDailyCooldown] = useState(0);
  const [coinBurst, setCoinBurst] = useState(false);
  const [activeTab, setActiveTab] = useState<"earn" | "history">("earn");

  // 🔥 Smart Ad System
  const [adNetwork, setAdNetwork] = useState<"adsgram" | "monetag">("adsgram");
  const lastAdTime = useRef<number>(0); // ✅ FIX 1: useRef instead of useState to avoid stale closure

  const COOLDOWN = 8000;

  /* ===============================
     ADSGRAM REWARD
  =================================*/
  const onAdsgramReward = useCallback(async () => {
    if (!user) return;
    triggerHaptic("success");
    await logAdWatch(user.id, "adsgram_reward", 40);
    await refreshBalance();
    setCoinBurst(true);
    setDailyMessage("+40 pts 🎬 (Adsgram)");
    setTimeout(() => setCoinBurst(false), 1200);
    setTimeout(() => setDailyMessage(""), 3000);
    setAdNetwork("monetag");
  }, [user, refreshBalance]);

  const { showAd: showAdsgramAd } = useRewardedAd(onAdsgramReward);

  /* ===============================
     MONETAG REWARD
  =================================*/
  const showMonetagAd = useCallback(async (): Promise<boolean> => { // ✅ FIX 2: wrapped in useCallback, explicit return type
    if (!user) return false;
    try {
      if (!(window as any).show_10742752) {
        throw new Error("Monetag not loaded");
      }
      await (window as any).show_10742752();
      triggerHaptic("success");
      await logAdWatch(user.id, "monetag_reward", 15);
      await refreshBalance();
      setCoinBurst(true);
      setDailyMessage("+15 pts 💰 (Monetag)");
      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(""), 3000);
      setAdNetwork("adsgram");
      return true;
    } catch (err) {
      console.error("❌ Monetag failed", err);
      return false;
    }
  }, [user, refreshBalance]);

  /* ===============================
     COOLDOWN TICKER
  =================================*/
  useEffect(() => { // ✅ FIX 3: countdown ticker was missing — dailyCooldown never decremented
    if (dailyCooldown <= 0) return;
    const timer = setInterval(() => {
      setDailyCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [dailyCooldown > 0]); // only restart when transitioning from 0 → positive

  /* ===============================
     LOAD DATA
  =================================*/
  const checkDailyCooldown = useCallback(async () => { // ✅ FIX 4: moved out of render scope + useCallback
    if (!user) return;
    const claim = await getDailyClaim(user.id);
    if (claim) {
      const now = new Date();
      const midnightUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      );
      const remaining = Math.max(
        0,
        Math.floor((midnightUTC.getTime() - now.getTime()) / 1000)
      );
      setDailyCooldown(remaining);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
    checkDailyCooldown();
  }, [user, checkDailyCooldown]); // ✅ FIX 5: added checkDailyCooldown to dependency array

  /* ===============================
     DAILY CLAIM
  =================================*/
  async function handleDailyClaim() {
    if (!user || dailyCooldown > 0) return;
    triggerHaptic("impact");
    setDailyClaiming(true);

    const result = await claimDailyReward(user.id);

    if (result.success) {
      triggerHaptic("success");
      setDailyMessage(`+${result.points} pts 🔥`);
      setCoinBurst(true);
      const now = new Date();
      const midnightUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      );
      setDailyCooldown(
        Math.floor((midnightUTC.getTime() - now.getTime()) / 1000)
      );
      await refreshBalance();
      setTimeout(() => setCoinBurst(false), 1200);
    } else {
      triggerHaptic("error");
      setDailyMessage(result.message || "Already claimed!");
      await checkDailyCooldown();
    }

    setDailyClaiming(false);
    setTimeout(() => setDailyMessage(""), 3000);
  }

  /* ===============================
     AD HANDLER
  =================================*/
  const handleWatchAd = async () => { // ✅ FIX 6: extracted inline async handler to named function
    if (!user) return;

    const now = Date.now();
    if (now - lastAdTime.current < COOLDOWN) { // ✅ FIX 1b: reading from ref
      alert("⏳ Wait a few seconds before next ad");
      return;
    }

    lastAdTime.current = now; // ✅ FIX 1c: writing to ref
    triggerHaptic("impact");
    setAdLoading(true);

    try {
      if (adNetwork === "adsgram") {
        await showAdsgramAd();
      } else {
        const success = await showMonetagAd();
        if (!success) {
          await showAdsgramAd(); // fallback
        }
      }
    } catch (err) {
      console.error("Ad error → fallback", err); // ✅ FIX 7: log the error object
      try {
        await showAdsgramAd();
      } catch {
        alert("Ad failed. Try again later.");
      }
    }

    setAdLoading(false);
  };

  /* ===============================
     RENDER
  =================================*/
  return (
    <div className="px-4 pb-28 text-white">
      {/* BALANCE */}
      <div className="rounded-3xl p-6 mb-6 text-center bg-gradient-to-br from-slate-900 to-slate-800 border border-yellow-400/20">
        {coinBurst && <div className="text-4xl animate-bounce">💰</div>}
        <div className="text-xs text-gray-400 mb-1">Total Balance</div>
        <div className="text-5xl font-black text-yellow-400">
          <AnimatedNumber value={balance?.points ?? 0} /> {/* ✅ FIX 8: ?? instead of || for 0-safe check */}
        </div>
        <div className="text-xs text-gray-500 mt-1">Available Points</div>
      </div>

      {/* WATCH AD */}
      <button
        onClick={handleWatchAd}
        disabled={adLoading}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-lg active:scale-95"
      >
        {adLoading
          ? "Loading Ad..."
          : adNetwork === "adsgram"
          ? "🎬 Watch Adsgram Ad (+40)"
          : "💰 Watch Monetag Ad (+15)"}
      </button>

      {/* DAILY */}
      <div className="p-5 mb-6 flex justify-between bg-slate-800 rounded-2xl">
        <div>
          <div className="font-bold">🎁 Daily Reward</div>
          <div className="text-xs text-gray-400">
            {dailyMessage ||
              (dailyCooldown > 0
                ? `⏳ ${formatCountdown(dailyCooldown)}`
                : `+${settings?.daily_bonus_base ?? 100} pts`)}
          </div>
        </div>
        <button
          onClick={handleDailyClaim}
          disabled={dailyClaiming || dailyCooldown > 0}
          className="px-5 py-2 bg-green-500 rounded-xl font-bold disabled:opacity-50" // ✅ FIX 9: visual disabled state
        >
          {dailyCooldown > 0 ? "Locked" : "Claim"}
        </button>
      </div>

      {/* TABS */}
      <div className="flex mb-4 bg-slate-900 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("earn")}
          className={`flex-1 py-2 rounded-lg font-bold ${
            activeTab === "earn" ? "bg-yellow-400 text-black" : "text-gray-400"
          }`}
        >
          Earn
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 rounded-lg font-bold ${
            activeTab === "history" ? "bg-yellow-400 text-black" : "text-gray-400"
          }`}
        >
          History
        </button>
      </div>

      {/* EARN */}
      {activeTab === "earn" && (
        <div className="space-y-4 mb-6">
          <AdsgramTask blockId="task-25198" />
        </div>
      )}

      {/* HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {transactions.length === 0 && (
            <div className="text-gray-400 text-center">No transactions yet</div>
          )}
          {transactions.map((t: any) => (
            <div
              key={t.id}
              className="p-4 rounded-xl bg-slate-800 flex justify-between"
            >
              <div className="text-sm">{t.type}</div>
              <div className="text-yellow-400 font-bold">+{t.points}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
