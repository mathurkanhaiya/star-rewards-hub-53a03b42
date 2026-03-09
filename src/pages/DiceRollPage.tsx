import React, { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';

export default function DiceRollPage() {
  const { user, refreshBalance } = useApp();
  const [phase, setPhase] = useState<'locked' | 'loading' | 'rolling' | 'result'>('locked');
  const [dice, setDice] = useState<[number, number]>([1, 1]);
  const [reward, setReward] = useState(0);

  const calcReward = (d1: number, d2: number) => {
    const sum = d1 + d2;
    if (sum === 12) return 100;
    if (sum >= 10) return 60;
    if (sum >= 8) return 40;
    if (sum >= 6) return 25;
    return 10;
  };

  const onAdWatched = useCallback(() => {
    setPhase('rolling');
  }, []);

  const { showAd } = useRewardedAd(onAdWatched);

  const handleUnlock = async () => {
    setPhase('loading');
    const ok = await showAd();
    if (!ok) setPhase('locked');
  };

  const handleRoll = async () => {
    if (!user) return;
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setDice([d1, d2]);
    const pts = calcReward(d1, d2);
    setReward(pts);
    setPhase('result');

    // Log ad + give reward
    await supabase.functions.invoke('log-ad', {
      body: { userId: user.id, adType: 'dice_roll', rewardGiven: pts },
    });
    refreshBalance();
  };

  const diceEmoji = (n: number) => ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n - 1];

  return (
    <div className="px-4 pb-28 text-center">
      <div className="text-5xl mb-2 animate-float">🎲</div>
      <h2 className="text-2xl font-bold shimmer-text mb-1">Dice Roll</h2>
      <p className="text-xs mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Watch an ad, roll two dice, earn 10–100 points!
      </p>

      <div className="glass-card rounded-2xl p-6 mb-4" style={{ border: '1px solid hsl(var(--gold) / 0.3)' }}>
        {phase === 'locked' && (
          <button
            onClick={handleUnlock}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(35 100% 45%))', color: '#000' }}
          >
            📺 Watch Ad to Play
          </button>
        )}

        {phase === 'loading' && (
          <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading ad...</div>
        )}

        {phase === 'rolling' && (
          <div>
            <div className="text-6xl flex justify-center gap-4 mb-4">🎲🎲</div>
            <button
              onClick={handleRoll}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, hsl(var(--cyan)), hsl(190 100% 35%))', color: '#000' }}
            >
              🎲 Roll the Dice!
            </button>
          </div>
        )}

        {phase === 'result' && (
          <div>
            <div className="text-7xl flex justify-center gap-6 mb-4">
              {diceEmoji(dice[0])} {diceEmoji(dice[1])}
            </div>
            <div className="text-sm mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              You rolled {dice[0]} + {dice[1]} = {dice[0] + dice[1]}
            </div>
            <div className="text-2xl font-bold mt-2" style={{ color: 'hsl(var(--gold))' }}>
              +{reward} Points! 🎉
            </div>
            <button
              onClick={() => setPhase('locked')}
              className="mt-4 w-full py-2 rounded-xl text-xs font-bold"
              style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
        <div className="font-bold mb-1">Reward Table</div>
        <div className="space-y-0.5">
          <div>Sum 12 → 100 pts | Sum 10-11 → 60 pts</div>
          <div>Sum 8-9 → 40 pts | Sum 6-7 → 25 pts</div>
          <div>Sum 2-5 → 10 pts</div>
        </div>
      </div>
    </div>
  );
}
