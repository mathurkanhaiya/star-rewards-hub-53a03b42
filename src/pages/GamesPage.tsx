import React, { useEffect, useState } from 'react';

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
  | 'luckybox'
  | 'specialad';

interface GamesMenuProps {
  onNavigate: (page: Page) => void;
}

const ALLOWED_COUNTRIES = ['US', 'MX', 'FR', 'DE', 'GB'];

// 🌍 Fetch country
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
  const [country, setCountry] = useState<string | null>(null);
  const [coins, setCoins] = useState<number>(0);

  useEffect(() => {
    fetchCountry().then(setCountry);

    // load balance
    const savedCoins = parseInt(localStorage.getItem("coins") || "0");
    setCoins(savedCoins);
  }, []);

  const isAllowed = country && ALLOWED_COUNTRIES.includes(country);

  // 💰 Reward + UI update
  const rewardUser = () => {
    const newCoins = coins + 30;
    setCoins(newCoins);
    localStorage.setItem("coins", newCoins.toString());
  };

  // 🎯 Special Ad Handler
  const handleSpecialAd = async () => {
    if (!isAllowed) {
      alert("❌ Not available in your country.\nUse VPN (USA, UK, etc).");
      return;
    }

    try {
      await show_10742752();
      rewardUser();
      alert("🎉 +30 coins added to your balance!");
    } catch {
      alert("Ad not completed.");
    }
  };

  const games = [
    {
      id: 'tower' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236274906-2cbfc5e2.gif',
      name: 'Tower Climb',
      desc: 'Tap at the right time to climb infinite floors.',
      color: 'gold',
    },
    {
      id: 'luckybox' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236074591-d9f8b5e0.gif',
      name: 'Lucky Box',
      desc: 'Watch an ad, pick a mystery box.',
      color: 'gold',
    },
    {
      id: 'dice' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236388452-80bcfe97.gif',
      name: 'Dice Roll',
      desc: 'Watch an ad, roll dice.',
      color: 'cyan',
    },
    {
      id: 'cardflip' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236194044-d5413577.gif',
      name: 'Card Flip',
      desc: 'Watch an ad, flip cards.',
      color: 'purple',
    },
    {
      id: 'numberguess' as Page,
      icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236312067-54b2669f.gif',
      name: 'Number Guess',
      desc: 'Watch an ad, guess number.',
      color: 'cyan',
    },
  ];

  return (
    <div className="px-4 pb-28">

      {/* 💰 BALANCE */}
      <div className="text-center mb-4">
        <div className="inline-block px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold border border-yellow-500/30">
          💰 Balance: {coins} coins
        </div>
      </div>

      {/* 🌟 SPECIAL AD CARD (TOP FEATURED) */}
      <div
        onClick={handleSpecialAd}
        className={`mb-6 p-5 rounded-2xl cursor-pointer transition-all
        ${isAllowed 
          ? 'bg-green-500/10 border border-green-500/30 hover:scale-[1.02]' 
          : 'bg-red-500/10 border border-red-500/30'
        }`}
      >
        <div className="flex items-center gap-4">

          <img
            src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
            className="w-14 h-14"
          />

          <div className="flex-1">
            <div className="font-bold text-lg">🔥 Special Ad Task</div>
            <div className="text-xs text-gray-400 mt-1">
              Watch easy ad & earn 30 coins
            </div>

            <div className="text-xs mt-2">
              🌍 {country || "Detecting..."} • {isAllowed ? "Eligible" : "Not Eligible"}
            </div>
          </div>

          <div className="text-yellow-400 font-bold">
            +30
          </div>

        </div>
      </div>

      {/* 🎮 HEADER */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold shimmer-text">Games</h2>
        <p className="text-sm mt-1 text-gray-400">
          Play games, earn points & climb leaderboards!
        </p>
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

              <img src={game.icon} className="w-14 h-14" />

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