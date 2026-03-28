import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import HomePage from "@/pages/HomePage";
import TasksPage from "@/pages/TasksPage";
import SpinPage from "@/pages/SpinPage";
import ReferralPage from "@/pages/ReferralPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import WalletPage from "@/pages/WalletPage";
import NotificationsPage from "@/pages/NotificationsPage";
import AdminPanel from "@/pages/AdminPanel";
import GamesPage from "@/pages/GamesPage";
import TowerClimbPage from "@/pages/TowerClimbPage";
import LuckyBoxPage from "@/pages/LuckyBoxPage";
import DiceRollPage from "@/pages/DiceRollPage";
import CardFlipPage from "@/pages/CardFlipPage";
import NumberGuessPage from "@/pages/NumberGuessPage";

// Security: Backend validation function
import { validateInitDataOnBackend } from "@/lib/api";

const queryClient = new QueryClient();

type Page =
  | "home" | "tasks" | "spin" | "referral" | "leaderboard"
  | "wallet" | "notifications" | "admin" | "games"
  | "tower" | "dice" | "cardflip" | "numberguess" | "luckybox";

// Device Fingerprint (helps detect alt accounts & shared links)
function getDeviceFingerprint(): string {
  const data = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    navigator.language,
    navigator.hardwareConcurrency || "0",
  ].join("|");

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600&display=swap');

@keyframes ldSpin   { to{transform:rotate(360deg)} }
@keyframes ldFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes ldDot    { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }
@keyframes ldBar    { 0%{width:0%} 100%{width:90%} }
@keyframes ldFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes ldGlow   { 0%,100%{box-shadow:0 0 20px rgba(255,190,0,0.3),0 0 40px rgba(255,190,0,0.1)} 50%{box-shadow:0 0 40px rgba(255,190,0,0.6),0 0 80px rgba(255,190,0,0.2)} }
@keyframes ldPulse  { 0%,100%{opacity:0.4} 50%{opacity:1} }

@keyframes bnGlow   { 0%,100%{text-shadow:0 0 20px rgba(239,68,68,0.4)} 50%{text-shadow:0 0 50px rgba(239,68,68,0.8)} }
@keyframes bnScan   { 0%{top:-10%} 100%{top:110%} }
@keyframes bnFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes bnPulse  { 0%,100%{opacity:0.5} 50%{opacity:1} }

/* LOADING */
.ld-root {
  position: fixed; inset: 0;
  background: #06080f;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden;
}
.ld-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,190,0,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,190,0,0.02) 1px, transparent 1px);
  background-size: 32px 32px;
}
.ld-orb {
  position: absolute; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgba(255,190,0,0.07) 0%, transparent 70%);
  width: 360px; height: 360px; top: -80px; left: 50%; transform: translateX(-50%);
}

.ld-logo-wrap {
  position: relative; width: 110px; height: 110px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 28px;
  animation: ldFadeUp 0.5s ease both;
}
.ld-ring {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #ffbe00;
  border-right-color: rgba(255,190,0,0.25);
  animation: ldSpin 1.2s linear infinite;
}
.ld-ring2 {
  position: absolute; inset: 8px; border-radius: 50%;
  border: 1px solid transparent;
  border-bottom-color: rgba(255,190,0,0.4);
  animation: ldSpin 2s linear infinite reverse;
}
.ld-img {
  width: 76px; height: 76px; border-radius: 50%; object-fit: cover;
  position: relative; z-index: 1;
  animation: ldFloat 3s ease-in-out infinite, ldGlow 2s ease-in-out infinite;
}

.ld-title {
  font-family: 'Orbitron', monospace;
  font-size: 22px; font-weight: 900; letter-spacing: 4px;
  color: #ffbe00;
  text-shadow: 0 0 24px rgba(255,190,0,0.4);
  margin-bottom: 4px;
  animation: ldFadeUp 0.5s 0.1s ease both;
}
.ld-sub {
  font-family: 'Orbitron', monospace;
  font-size: 9px; letter-spacing: 4px;
  color: rgba(255,255,255,0.2); text-transform: uppercase;
  margin-bottom: 28px;
  animation: ldFadeUp 0.5s 0.2s ease both;
}
.ld-bar-track {
  width: 180px; height: 3px;
  background: rgba(255,255,255,0.06); border-radius: 2px;
  overflow: hidden; margin-bottom: 16px;
  animation: ldFadeUp 0.5s 0.3s ease both;
}
.ld-bar-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #ffbe00, #f59e0b);
  box-shadow: 0 0 8px rgba(255,190,0,0.5);
  animation: ldBar 2.5s ease-out forwards;
}
.ld-dots {
  display: flex; gap: 6px;
  animation: ldFadeUp 0.5s 0.4s ease both;
}
.ld-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #ffbe00;
  animation: ldDot 1.2s ease-in-out infinite;
}
.ld-dot:nth-child(2) { animation-delay: 0.2s; }
.ld-dot:nth-child(3) { animation-delay: 0.4s; }

/* BAN / BLOCKED */
.bn-root {
  position: fixed; inset: 0;
  background: #06080f;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden; padding: 24px; text-align: center;
}
.bn-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(239,68,68,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(239,68,68,0.025) 1px, transparent 1px);
  background-size: 32px 32px;
}
.bn-orb {
  position: absolute; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 65%);
  width: 400px; height: 400px; top: 50%; left: 50%;
  transform: translate(-50%,-50%);
}
.bn-scan {
  position: absolute; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(239,68,68,0.3), transparent);
  animation: bnScan 3s linear infinite; pointer-events: none;
}

.bn-gif-wrap {
  position: relative; margin-bottom: 20px;
  animation: bnFadeUp 0.5s ease both;
}
.bn-gif {
  width: 130px; height: 130px; border-radius: 18px;
  border: 1px solid rgba(239,68,68,0.25);
  box-shadow: 0 0 30px rgba(239,68,68,0.15);
}

.bn-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 14px; border-radius: 20px; margin-bottom: 12px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25);
  font-family: 'Orbitron', monospace; font-size: 8px; font-weight: 700;
  letter-spacing: 3px; color: #ef4444;
  animation: bnFadeUp 0.5s 0.1s ease both;
}
.bn-badge-dot {
  width: 5px; height: 5px; border-radius: 50%; background: #ef4444;
  animation: bnPulse 1.2s ease-in-out infinite;
}

.bn-title {
  font-family: 'Orbitron', monospace;
  font-size: 24px; font-weight: 900; letter-spacing: 2px;
  color: #ef4444; line-height: 1.1; margin-bottom: 10px;
  animation: bnFadeUp 0.5s 0.2s ease both, bnGlow 2s 0.5s ease-in-out infinite;
}
.bn-line {
  width: 50px; height: 1px; margin: 0 auto 12px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  animation: bnFadeUp 0.5s 0.3s ease both;
}
.bn-msg {
  font-family: 'Rajdhani', sans-serif;
  font-size: 14px; color: rgba(255,255,255,0.3);
  letter-spacing: 0.5px; line-height: 1.6;
  max-width: 260px; margin-bottom: 20px;
  animation: bnFadeUp 0.5s 0.4s ease both;
}
.bn-support {
  font-family: 'Orbitron', monospace;
  font-size: 8px; letter-spacing: 2px;
  color: rgba(255,255,255,0.1); text-transform: uppercase;
  animation: bnFadeUp 0.5s 0.5s ease both;
}
`;

function AppContent() {
  const { isLoading, user, isAdmin, telegramUser, setTelegramUser } = useApp();

  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAltBlocked, setIsAltBlocked] = useState(false);

  // Security Check - Runs once when app loads
  useEffect(() => {
    const runSecurityCheck = async () => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) {
        setAuthError("Please open this app inside Telegram");
        setAuthChecked(true);
        return;
      }

      const rawInitData = tg.initData;
      if (!rawInitData) {
        setAuthError("Invalid Telegram session");
        setAuthChecked(true);
        return;
      }

      tg.ready();

      try {
        const fingerprint = getDeviceFingerprint();

        const result = await validateInitDataOnBackend(rawInitData, fingerprint);

        if (result.success) {
          setTelegramUser(result.user);
        } else {
          if (result.reason === "multiple_devices" || result.reason === "alt_detected") {
            setIsAltBlocked(true);
          } else {
            setAuthError(result.message || "Session validation failed");
          }
        }
      } catch (err) {
        console.error("Auth error:", err);
        setAuthError("Authentication failed. Please reopen the app from Telegram.");
      } finally {
        setAuthChecked(true);
      }
    };

    if (!authChecked) runSecurityCheck();
  }, [authChecked, setTelegramUser]);

  // Loading Screen
  if (!authChecked || isLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="ld-root">
          <div className="ld-grid" />
          <div className="ld-orb" />
          <div className="ld-logo-wrap">
            <div className="ld-ring" />
            <div className="ld-ring2" />
            <img
              src="https://i.ibb.co/hJxry1hZ/53-AB4888-9018-455-D-B962-232-FAA620823.png"
              alt="Logo"
              className="ld-img"
            />
          </div>
          <div className="ld-title">ADS REWARDS</div>
          <div className="ld-sub">Watch · Earn · Win</div>
          <div className="ld-bar-track">
            <div className="ld-bar-fill" />
          </div>
          <div className="ld-dots">
            <div className="ld-dot" />
            <div className="ld-dot" />
            <div className="ld-dot" />
          </div>
        </div>
      </>
    );
  }

  // Alt Account / Multiple Device Blocked Screen
  if (isAltBlocked) {
    return (
      <>
        <style>{CSS}</style>
        <div className="bn-root">
          <div className="bn-grid" />
          <div className="bn-orb" />
          <div className="bn-scan" />
          <div className="bn-gif-wrap">
            <img
              src="https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773769725182-0fda5970.gif"
              alt="Blocked"
              className="bn-gif"
            />
          </div>
          <div className="bn-badge">
            <div className="bn-badge-dot" />
            SECURITY ALERT
          </div>
          <div className="bn-title">MULTIPLE DEVICES<br/>DETECTED</div>
          <div className="bn-line" />
          <div className="bn-msg">
            Your account was accessed from different devices.<br />
            Access has been temporarily blocked to protect your rewards.
          </div>
          <div className="bn-support">
            Contact support with your Telegram username
          </div>
        </div>
      </>
    );
  }

  // Not opened inside Telegram or invalid session
  if (!telegramUser || authError) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #05070f 0%, #0a0e1a 50%, #060a14 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{
          position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(262 80% 40% / 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: 'linear-gradient(135deg, hsl(262 80% 50% / 0.2), hsl(220 80% 50% / 0.2))',
          border: '1px solid hsl(262 80% 50% / 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 0 40px hsl(262 80% 50% / 0.2)',
        }}>
          <img
            src="https://i.ibb.co/hJxry1hZ/53-AB4888-9018-455-D-B962-232-FAA620823.png"
            alt="ADS Rewards"
            style={{ width: 60, height: 60, objectFit: 'contain' }}
          />
        </div>

        <div style={{
          fontSize: 22, fontWeight: 700, letterSpacing: 3,
          color: '#fff', marginBottom: 6,
          fontFamily: "'Orbitron', monospace", textTransform: 'uppercase',
        }}>
          ADS REWARDS
        </div>
        <div style={{ fontSize: 12, color: 'hsl(220 15% 50%)', letterSpacing: 2, marginBottom: 40 }}>
          WATCH · EARN · WIN
        </div>

        <div style={{
          width: '100%', maxWidth: 340,
          background: 'hsl(220 25% 10% / 0.8)',
          border: '1px solid hsl(220 30% 20% / 0.6)',
          borderRadius: 20, padding: '28px 24px',
          backdropFilter: 'blur(20px)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #0088cc, #00aaff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,136,204,0.4)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
            </svg>
          </div>

          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
            Telegram Only
          </div>
          <div style={{ fontSize: 13, color: 'hsl(220 15% 55%)', lineHeight: 1.6, marginBottom: 24 }}>
            ADS Rewards is a Telegram Mini App.<br/>
            Open it inside Telegram to start earning.
          </div>

          <a
            href="https://t.me/Adsrewartsbot/app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', width: '100%', padding: '13px 0',
              background: 'linear-gradient(135deg, #0088cc, #00aaff)',
              borderRadius: 12, color: '#fff',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              letterSpacing: 0.5,
              boxShadow: '0 4px 20px rgba(0,136,204,0.35)',
            }}
          >
            Open in Telegram
          </a>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: 'hsl(220 15% 30%)', textAlign: 'center' }}>
          @adsrewartsbot
        </div>
      </div>
    );
  }

  // Banned User Screen
  if (user?.is_banned) {
    return (
      <>
        <style>{CSS}</style>
        <div className="bn-root">
          <div className="bn-grid" />
          <div className="bn-orb" />
          <div className="bn-scan" />
          <div className="bn-gif-wrap">
            <img
              src="https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773769725182-0fda5970.gif"
              alt="Banned"
              className="bn-gif"
            />
          </div>
          <div className="bn-badge">
            <div className="bn-badge-dot" />
            ACCESS REVOKED
          </div>
          <div className="bn-title">ACCOUNT<br/>SUSPENDED</div>
          <div className="bn-line" />
          <div className="bn-msg">
            Your account has been suspended for violating our community guidelines.
          </div>
          <div className="bn-support">
            Contact support if you think this is a mistake
          </div>
        </div>
      </>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case "home":          return <HomePage />;
      case "tasks":         return <TasksPage />;
      case "spin":          return <SpinPage />;
      case "referral":      return <ReferralPage />;
      case "leaderboard":   return <LeaderboardPage />;
      case "wallet":        return <WalletPage />;
      case "notifications": return <NotificationsPage />;
      case "admin":         return isAdmin ? <AdminPanel /> : <HomePage />;
      case "games":         return <GamesPage onNavigate={setCurrentPage} />;
      case "tower":         return <TowerClimbPage />;
      case "luckybox":      return <LuckyBoxPage />;
      case "dice":          return <DiceRollPage />;
      case "cardflip":      return <CardFlipPage />;
      case "numberguess":   return <NumberGuessPage />;
      default:              return <HomePage />;
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        background: "radial-gradient(ellipse at top left, hsl(220 40% 8%) 0%, hsl(220 30% 3%) 60%)",
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 80% 10%, hsl(265 80% 65% / 0.05) 0%, transparent 50%), radial-gradient(circle at 20% 80%, hsl(190 100% 55% / 0.05) 0%, transparent 50%)",
          maxWidth: 480,
          zIndex: 0,
        }}
      />
      <div className="relative z-10">
        <Header />
        {currentPage !== "leaderboard" && (
          <nav className="px-4 mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage("leaderboard")}
                className="px-3 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: "hsl(220 25% 10%)",
                  border: "1px solid hsl(220 20% 15%)",
                  color: "hsl(220 15% 60%)",
                }}
              >
                🏆 Leaderboard
              </button>
            </div>
          </nav>
        )}
        <main className="pt-1 pb-2">{renderPage()}</main>
        <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <AppContent />
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;