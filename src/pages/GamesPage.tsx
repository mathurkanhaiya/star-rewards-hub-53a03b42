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
  } catch (err) {
    console.error("Geo error:", err);
    return null;
  }
}

// 💰 Reward (UPDATED → 30 coins)
function rewardUser() {
  let coins = parseInt(localStorage.getItem("coins") || "0");
  coins += 30;
  localStorage.setItem("coins", coins);
}

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
  {
    id: 'specialad' as Page,
    icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    name: 'Special Ad Task',
    desc: 'Only for selected countries. Use VPN if needed.',
    color: 'gold',
  },
];

function GamesMenu({ onNavigate }: GamesMenuProps) {
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    fetchCountry().then(setCountry);
  }, []);

  const isAllowed = country && ALLOWED_COUNTRIES.includes(country);

  const handleSpecialAd = async () => {
    if (!isAllowed) {
      alert("❌ Not available in your country.\nUse VPN (USA, UK, etc).");
      return;
    }

    try {
      await show_10742752();
      rewardUser();
      alert(`🎉 You earned 30 coins!`);
    } catch {
      alert("Ad not completed.");
    }
  };

  return (
    <div className="px-4 pb-28">

      {/* 🌍 TOP COUNTRY STATUS (VERY VISIBLE) */}
      <div className="mb-4 text-center">
        {country ? (
          <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold
            ${isAllowed 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
            🌍 {country} {isAllowed ? '• Eligible for Special Ads' : '• Not Eligible'}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            🌍 Detecting your country...
          </div>
        )}
      </div>

      <div className="text-center mb-6">

        <img
          src="https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773233806742-9483b1e2.gif"
          alt="Games"
          className="w-20 h-20 mx-auto mb-2 object-contain animate-float drop-shadow-lg"
        />

        <h2 className="text-2xl font-bold shimmer-text">Games</h2>

        <p className="text-sm mt-1 text-gray-400">
          Play games, earn points & climb leaderboards!
        </p>

      </div>

      <div className="space-y-3">

        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => {
              if (game.id === 'specialad') {
                handleSpecialAd();
              } else {
                onNavigate(game.id);
              }
            }}
            className="game-card w-full rounded-2xl p-5 text-left"
            style={{ border: `1px solid hsl(var(--${game.color}) / 0.3)` }}
          >

            <div className="flex items-center gap-4">

              <div className="game-icon">
                <img
                  src={game.icon}
                  alt={game.name}
                  className="w-14 h-14 object-contain"
                />
              </div>

              <div className="flex-1">

                <div className="font-bold text-lg">
                  {game.name}
                </div>

                <div className="text-xs mt-1 text-gray-400">
                  {game.desc}
                </div>

              </div>

              <div className="game-arrow">→</div>

            </div>

          </button>
        ))}

      </div>

    </div>
  );
}

export default GamesMenu;
export type { Page };