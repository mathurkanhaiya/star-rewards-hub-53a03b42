import React, { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';

export default function NumberGuessPage() {
  const { user, refreshBalance } = useApp();
  const [phase, setPhase] = useState<'locked' | 'loading' | 'guessing' | 'result'>('locked');
  const [target, setTarget] = useState(1);
  const [guess, setGuess] = useState<number | null>(null);
  const [reward, setReward] = useState(0);

  const onAdWatched = useCallback(() => {
    setTarget(Math.floor(Math.random() * 10) + 1);
    setGuess(null);
    setPhase('guessing');
  }, []);

  const { showAd } = useRewardedAd(onAdWatched);

  const handleUnlock = async () => {
    setPhase('loading');
    const ok = await showAd();
    if (!ok) setPhase('locked');
  };

  const handleGuess = async (n: number) => {
    if (!user) return;
    setGuess(n);
    const diff = Math.abs(n - target);
    let pts = 10;
    if (diff === 0) pts = 100;
    else if (diff === 1) pts = 60;
    else if (diff === 2) pts = 35;
    else if (diff <= 4) pts = 20;

    setReward(pts);
    setPhase('result');

    await supabase.functions.invoke('log-ad', {
      body: { userId: user.id, adType: 'number_guess', rewardGiven: pts },
    });
    refreshBalance();
  };

  return (
    <div className="px-4 pb-28 text-center">
      <div className="text-5xl mb-2 animate-float">🎯</div>
      <h2 className="text-2xl font-bold shimmer-text mb-1">Number Guess</h2>
      <p className="text-xs mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Watch an ad, guess the hidden number (1–10), closer = more points!
      </p>

      <div className="glass-card rounded-2xl p-6 mb-4" style={{ border: '1px solid hsl(var(--cyan) / 0.3)' }}>
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

        {phase === 'guessing' && (
          <div>
            <div className="text-6xl mb-3">❓</div>
            <div className="text-sm mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>Pick a number between 1 and 10</div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => handleGuess(n)}
                  className="py-3 rounded-xl font-bold text-lg transition-all active:scale-95"
                  style={{
                    background: 'hsl(var(--cyan) / 0.15)',
                    border: '1px solid hsl(var(--cyan) / 0.3)',
                    color: 'hsl(var(--cyan))',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div>
            <div className="flex justify-center gap-4 items-center mb-3">
              <div>
                <div className="text-xs mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Your Guess</div>
                <div className="text-4xl font-bold" style={{ color: 'hsl(var(--cyan))' }}>{guess}</div>
              </div>
              <div className="text-2xl">→</div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Answer</div>
                <div className="text-4xl font-bold" style={{ color: 'hsl(var(--gold))' }}>{target}</div>
              </div>
            </div>
            <div className="text-xs mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {guess === target ? '🎯 PERFECT GUESS!' : `Off by ${Math.abs(guess! - target)}`}
            </div>
            <div className="text-2xl font-bold" style={{ color: 'hsl(var(--gold))' }}>+{reward} Points!</div>
            <button
              onClick={() => setPhase('locked')}
              className="mt-4 w-full py-2 rounded-xl text-xs font-bold"
              style={{ background: 'hsl(var(--cyan) / 0.15)', color: 'hsl(var(--cyan))' }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
        <div className="font-bold mb-1">Rewards</div>
        <div>Exact → 100 pts | Off by 1 → 60 pts | Off by 2 → 35 pts</div>
        <div>Off by 3-4 → 20 pts | Off by 5+ → 10 pts</div>
      </div>
    </div>
  );
}
