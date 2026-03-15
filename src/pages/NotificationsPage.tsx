import React, { useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') {
      tg?.HapticFeedback?.notificationOccurred('success');
    } else {
      tg?.HapticFeedback?.impactOccurred('light');
    }
  }
}

/* ===============================
   TYPE CONFIG
================================ */
const typeIcons: Record<string, string> = {
  info: '📢',
  reward: '🎁',
  withdrawal: '💸',
  referral: '👥',
};

const typeColors: Record<string, string> = {
  info: 'hsl(190 100% 55%)',
  reward: 'hsl(45 100% 55%)',
  withdrawal: 'hsl(140 70% 50%)',
  referral: 'hsl(265 80% 65%)',
};

/* ===============================
   TIME AGO FORMATTER
================================ */
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationsPage() {

  const { notifications, markRead } = useApp();

  const bannerAdRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  /* ===============================
     BANNER AD LOADER
  =================================*/
  useEffect(() => {

    if (!bannerAdRef.current) return;

    const config = document.createElement("script");
    config.innerHTML = `
      atOptions = {
        'key' : '51ed0e5213d1e44096de5736dd56a99e',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };
    `;

    const script = document.createElement("script");
    script.src = "https://www.highperformanceformat.com/51ed0e5213d1e44096de5736dd56a99e/invoke.js";
    script.async = true;

    bannerAdRef.current.appendChild(config);
    bannerAdRef.current.appendChild(script);

  }, []);

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Notifications</h2>
          <p className="text-xs text-gray-400">
            Stay updated on your activity
          </p>
        </div>

        {unreadCount > 0 && (
          <div className="text-xs px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-semibold">
            {unreadCount} new
          </div>
        )}
      </div>

      {/* BANNER AD */}
      <div
        ref={bannerAdRef}
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "16px"
        }}
      />

      {/* EMPTY STATE */}
      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 animate-bounce">🔔</div>
          <div className="text-sm text-gray-400">
            You're all caught up!
          </div>
        </div>
      ) : (
        <div className="space-y-3">

          {notifications.map(n => {
            const color = typeColors[n.type] || 'hsl(220 15% 50%)';
            const icon = typeIcons[n.type] || '🔔';

            return (
              <button
                key={n.id}
                onClick={() => {
                  triggerHaptic();
                  if (!n.is_read) {
                    markRead(n.id);
                    triggerHaptic('success');
                  }
                }}
                className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                style={{
                  background: n.is_read
                    ? 'rgba(17,24,39,0.6)'
                    : `linear-gradient(135deg, ${color}10, rgba(17,24,39,0.9))`,
                  border: `1px solid ${
                    n.is_read ? 'rgba(255,255,255,0.05)' : `${color}50`
                  }`,
                }}
              >
                <div className="flex items-start gap-3">

                  <div
                    className="text-xl flex-shrink-0 mt-1"
                    style={{
                      filter: n.is_read
                        ? 'none'
                        : `drop-shadow(0 0 8px ${color})`
                    }}
                  >
                    {icon}
                  </div>

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center justify-between mb-1">

                      <div className="text-sm font-semibold truncate">
                        {n.title}
                      </div>

                      {!n.is_read && (
                        <div
                          className="w-2.5 h-2.5 rounded-full animate-pulse"
                          style={{ background: color }}
                        />
                      )}
                    </div>

                    <div className="text-xs text-gray-400 leading-relaxed">
                      {n.message}
                    </div>

                    <div className="text-[11px] text-gray-500 mt-2">
                      {timeAgo(n.created_at)}
                    </div>

                  </div>
                </div>
              </button>
            );
          })}

        </div>
      )}
    </div>
  );
}