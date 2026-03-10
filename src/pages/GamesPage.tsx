import React from 'react';

type Page = 'home' | 'tasks' | 'spin' | 'referral' | 'leaderboard' | 'wallet' | 'notifications' | 'admin' | 'games' | 'tower' | 'dice' | 'cardflip' | 'numberguess' | 'luckybox';

interface GamesMenuProps {
  onNavigate: (page: Page) => void;
}

const games = [
  {
    id: 'tower' as Page,
    icon: '🏗️',
    name: 'Tower Climb',
    desc: 'Tap at the right time to climb infinite floors. How high can you go?',
    color: 'gold',
  },
  {
    id: 'luckybox' as Page,
    icon: '🎁',
    name: 'Lucky Box',
    desc: 'Watch an ad, pick a mystery box, win big prizes!',
    color: 'gold',
  },
  {
    id: 'dice' as Page,
    icon: '🎲',
    name: 'Dice Roll',
    desc: 'Watch an ad, roll two dice, earn 10–100 points!',
    color: 'cyan',
  },
  {
    id: 'cardflip' as Page,
    icon: '🃏',
    name: 'Card Flip',
    desc: 'Watch an ad, flip 3 cards — match them for big rewards!',
    color: 'purple',
  },
  {
    id: 'numberguess' as Page,
    icon: '🎯',
    name: 'Number Guess',
    desc: 'Watch an ad, guess the hidden number, closer = more points!',
    color: 'cyan',
  },
];

function GamesMenu({ onNavigate }: GamesMenuProps) {
  return (
    <div className="px-4 pb-28">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2 animate-float">🎮</div>
        <h2 className="text-2xl font-bold shimmer-text">Games</h2>
        <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Play games, earn points & climb leaderboards!
        </p>
      </div>

      <PromoSection />

      <div className="space-y-3">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => onNavigate(game.id)}
            className="w-full glass-card rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
            style={{ border: `1px solid hsl(var(--${game.color}) / 0.3)` }}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">{game.icon}</div>
              <div className="flex-1">
                <div className="font-bold text-lg">{game.name}</div>
                <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {game.desc}
                </div>
              </div>
              <div style={{ color: `hsl(var(--${game.color}))` }}>→</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default GamesMenu;
export type { Page };
