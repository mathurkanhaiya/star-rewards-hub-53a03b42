import React, { useEffect, useState, useRef } from "react";
import {
  getLeaderboard,
  getActiveContests,
} from "@/lib/api";
import { LeaderboardEntry, Contest } from "@/types/telegram";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";

type LeaderboardTab = "points" | "ads";
type AdsSubTab = "alltime" | "today" | "yesterday" | "week" | "month";

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: "impact" | "success" = "impact") {
  if (typeof window !== "undefined" && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === "success") {
      tg?.HapticFeedback?.notificationOccurred("success");
    } else {
      tg?.HapticFeedback?.impactOccurred("medium");
    }
  }
}

/* ===============================
   ANIMATED POINTS
================================ */
function AnimatedPoints({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    let start = previous.current;
    const diff = value - start;
    const duration = 600;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += increment;

      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, duration / steps);

    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function formatCountdown(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";

  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff / (1000 * 60)) % 60);

  return `${h}h ${m}m`;
}

export default function LeaderboardPage() {
  const { user } = useApp();

  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Record<number, number>>({});
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<LeaderboardTab>("points");
  const [adsSubTab, setAdsSubTab] = useState<AdsSubTab>("alltime");

  const [adLeaders, setAdLeaders] = useState<any[]>([]);

  /* AUTO REFRESH */
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [tab, adsSubTab]);

  async function loadData() {
    setLoading(true);

    /* ================= POINTS ================= */
    if (tab === "points") {
      const data = await getLeaderboard();
      const newLeaders = data || [];

      const prev: Record<number, number> = {};
      leaders.forEach((l) => {
        prev[l.telegram_id] = l.rank;
      });

      setPreviousRanks(prev);
      setLeaders(newLeaders);
    }

    /* ================= ADS ================= */
    if (tab === "ads") {
      try {
        const activeContests = await getActiveContests();
        setContests(activeContests as Contest[]);

        let query = supabase
          .from("ad_logs")
          .select("user_id, created_at");

        const now = new Date();

        if (adsSubTab !== "alltime") {
          let startDate: Date;

          if (adsSubTab === "today") {
            startDate = new Date(Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate()
            ));
          } else if (adsSubTab === "yesterday") {
            startDate = new Date(Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate() - 1
            ));
          } else if (adsSubTab === "week") {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
          } else {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
          }

          query = query.gte("created_at", startDate.toISOString());

          if (adsSubTab === "yesterday") {
            const endDate = new Date(Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate()
            ));
            query = query.lt("created_at", endDate.toISOString());
          }
        }

        const { data: adLogs, error } = await query;

        if (error) throw error;

        const counts: Record<string, number> = {};

        for (const log of adLogs || []) {
          counts[log.user_id] = (counts[log.user_id] || 0) + 1;
        }

        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50);

        const userIds = sorted.map(([uid]) => uid);

        let usersMap: Record<string, any> = {};

        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from("users")
            .select("id, first_name, username, telegram_id, photo_url")
            .in("id", userIds);

          (users || []).forEach((u) => {
            usersMap[u.id] = u;
          });
        }

        const finalLeaders = sorted.map(([uid, score]) => ({
          user_id: uid,
          score,
          users: usersMap[uid] || {},
        }));

        setAdLeaders(finalLeaders);
      } catch (err) {
        console.error("Ads leaderboard error:", err);
        setAdLeaders([]);
      }
    }

    setLoading(false);
  }

  const activeContest =
    tab === "ads"
      ? contests.find((c) => c.contest_type === "ads_watch")
      : null;

  return (
    <div className="px-4 pb-28 text-white">
      <h2 className="text-lg font-bold mb-2">Leaderboard</h2>

      {/* MAIN TABS */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[#111827]">
        {[
          { id: "points", label: "Points" },
          { id: "ads", label: "Ads Watch" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              triggerHaptic();
              setTab(t.id as LeaderboardTab);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-bold"
            style={{
              background:
                tab === t.id
                  ? "linear-gradient(135deg,#facc15,#f97316)"
                  : "transparent",
              color: tab === t.id ? "#111" : "#9ca3af",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ADS SUB TABS */}
      {tab === "ads" && (
        <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[#0f172a] flex-wrap">
          {[
            { id: "alltime", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setAdsSubTab(st.id as AdsSubTab)}
              className="px-3 py-1 rounded-md text-xs font-bold"
              style={{
                background:
                  adsSubTab === st.id
                    ? "rgba(250,204,21,0.2)"
                    : "transparent",
                color:
                  adsSubTab === st.id ? "#facc15" : "#6b7280",
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="text-center py-6">Loading...</div>
      ) : tab === "points" ? (
        <div>
          {leaders.map((l) => (
            <div key={l.id} className="p-3 border-b">
              #{l.rank} - {l.first_name} ({l.total_points})
            </div>
          ))}
        </div>
      ) : (
        <div>
          {adLeaders.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              No data
            </div>
          )}

          {adLeaders.map((e, i) => (
            <div key={e.user_id} className="p-3 border-b">
              #{i + 1} - {e.users?.first_name || "User"} →{" "}
              {e.score} ads
            </div>
          ))}
        </div>
      )}
    </div>
  );
}