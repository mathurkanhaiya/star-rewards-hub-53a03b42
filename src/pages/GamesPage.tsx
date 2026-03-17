import React, { useEffect, useState } from 'react';
import { useApp } from "@/context/AppContext";
import { logAdWatch } from "@/lib/api";

type Page =
  | 'home'
  | 'tasks'
  | 'spin'
  | 'referral'
  | 'leaderboard'
  | 'wallet'
  | 'notifications'
  | 'admin'
  | 'games'
  | 'tower'
  | 'dice'
  | 'cardflip'
  | 'numberguess'
  | 'luckybox';

interface GamesMenuProps {
  onNavigate: (page: Page) => void;
}

const ALLOWED_COUNTRIES = ['US', 'MX', 'FR', 'DE', 'GB', 'CA', 'AU'];

async function fetchCountry(): Promise<string | null> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return data.country_code;
  } catch {
    return null;
  }
}

function GamesMenu({ onNavigate }: GamesMenuProps) {
  const { user, balance, refreshBalance } = useApp();

  const [country, setCountry] = useState<string | null>(null);
  const [loadingAd, setLoadingAd] = useState(false);
  const [lastAdTime, setLastAdTime] = useState(0);

  const COOLDOWN = 8000;

  useEffect(() => {
    fetchCountry().then(setCountry);
  }, []);

  const isAllowed = country && ALLOWED_COUNTRIES.includes(country);

  /* ===============================
     🎬 MAIN AD (+30)
  ================================ */
  const handleMainAd = async () => {
    if (!user) return;

    if (!isAllowed) {
      alert("❌ Use VPN (USA/UK/DE/FR/CA/AU)");
      return;
    }

    const now = Date.now();
    if (now - lastAdTime < COOLDOWN) {
      alert("⏳ Wait before next ad");
      return;
    }

    setLastAdTime(now);

    try {
      setLoadingAd(true);

      await (window as any).show_10742752();

      await logAdWatch(user.id, "special_ad_easy", 30);
      await refreshBalance();

      alert("🎉 +30 coins!");

    } catch {
      alert("Ad not completed.");
    }

    setLoadingAd(false);
  };

  /* ===============================
     ⚡ POPUP AD (+20)
  ================================ */
  const handlePopupAd = async () => {
    if (!user) return;

    if (!isAllowed) {
      alert("❌ Use VPN (USA/UK/DE/FR/CA/AU)");
      return;
    }

    const now = Date.now();
    if (now - lastAdTime < COOLDOWN) {
      alert("⏳ Wait before next ad");
      return;
    }

    setLastAdTime(now);

    try {
      setLoadingAd(true);

      await (window as any).show_10742752('pop');

      await logAdWatch(user.id, "popup_ad", 20);
      await refreshBalance();

      alert("⚡ +20 coins!");

    } catch {
      alert("Popup ad failed.");
    }

    setLoadingAd(false);
  };

  /* ===============================
     🎮 GAMES (GIF ICONS)
  ================================ */
  const games = [
    {
      id: 'tower' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236274906-2cbfc5e2.gif',
      name: 'Tower Climb',
      desc: 'Tap at the right time to climb infinite floors.',
    },
    {
      id: 'luckybox' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236074591-d9f8b5e0.gif',
      name: 'Lucky Box',
      desc: 'Watch an ad, pick a mystery box.',
    },
    {
      id: 'dice' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236388452-80bcfe97.gif',
      name: 'Dice Roll',
      desc: 'Watch an ad, roll dice.',
    },
    {
      id: 'cardflip' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236194044-d5413577.gif',
      name: 'Card Flip',
      desc: 'Watch an ad, flip cards.',
    },
    {
      id: 'numberguess' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236312067-54b2669f.gif',
      name: 'Number Guess',
      desc: 'Watch an ad, guess number.',
    },
  ];

  return (
    <div className="px-4 pb-28 text-white">

      {/* 💰 BALANCE */}
      <div className="text-center mb-4">
        <div className="inline-block px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold border border-yellow-500/30">
          💰 Balance: {balance?.points || 0}
        </div>
      </div>

      {/* 🌍 COUNTRY */}
      <div className="text-center mb-4 text-sm">
        🌍 {country || "Detecting..."} • {isAllowed ? "Eligible" : "Not Eligible"}
      </div>

      {/* 🎬 MAIN AD */}
      <div
        onClick={handleMainAd}
        className={`mb-4 p-5 rounded-2xl cursor-pointer transition-all
        ${isAllowed 
          ? 'bg-green-500/10 border border-green-400/30 hover:scale-[1.02]' 
          : 'bg-red-500/10 border border-red-400/30'
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <div className="font-bold text-lg">🎬 Easy Ad</div>
            <div className="text-xs text-gray-400">Earn 30 coins</div>
          </div>
          <div className="text-green-400 font-bold">
            {loadingAd ? "..." : "+30"}
          </div>
        </div>
      </div>

      {/* ⚡ POPUP AD */}
      <div
        onClick={handlePopupAd}
        className={`mb-6 p-5 rounded-2xl cursor-pointer transition-all
        ${isAllowed 
          ? 'bg-blue-500/10 border border-blue-400/30 hover:scale-[1.02]' 
          : 'bg-red-500/10 border border-red-400/30'
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <div className="font-bold text-lg">⚡ Popup Ad</div>
            <div className="text-xs text-gray-400">Earn 20 coins</div>
          </div>
          <div className="text-blue-400 font-bold">
            {loadingAd ? "..." : "+20"}
          </div>
        </div>
      </div>

      {/* 🎮 GAMES */}
      <div className="space-y-3">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => onNavigate(game.id)}
            className="game-card w-full rounded-2xl p-5 text-left"
          >
            <div className="flex items-center gap-4">

              <img
                src={game.icon}
                alt={game.name}
                className="w-14 h-14 object-contain"
              />

              <div className="flex-1">
                <div className="font-bold text-lg">{game.name}</div>
                <div className="text-xs mt-1 text-gray-400">
                  {game.desc}
                </div>
              </div>

              <div>→</div>

            </div>
          </button>
        ))}
      </div>

    </div>
  );
}

export default GamesMenu;
export type { Page };