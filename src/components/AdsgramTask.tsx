import { useEffect, useRef, useCallback, useState } from "react";

interface AdsgramTaskProps {
  blockId: string;
  rewardAmount?: number;
  onReward?: (detail: any) => void;
  onError?: (detail: any) => void;
}

type AdState = "idle" | "watching" | "claim" | "done" | "error" | "no_banner";

export default function AdsgramTask({
  blockId,
  rewardAmount = 10,
  onReward,
  onError,
}: AdsgramTaskProps) {
  const taskRef = useRef<HTMLElement & { show?: () => void }>(null);
  const [adState, setAdState] = useState<AdState>("idle");

  const showAd = useCallback(() => {
    if (adState === "done" || adState === "watching") return;
    if (taskRef.current?.show) {
      setAdState("watching");
      taskRef.current.show();
    } else {
      console.warn("No .show() on adsgram-task");
      setAdState("error");
      setTimeout(() => setAdState("idle"), 3000);
    }
  }, [adState]);

  useEffect(() => {
    const task = taskRef.current;
    if (!task) return;

    const handleReward = (e: Event) => {
      setAdState("claim");
      onReward?.((e as CustomEvent).detail);
    };

    const handleError = (e: Event) => {
      setAdState("error");
      onError?.((e as CustomEvent).detail);
      setTimeout(() => setAdState("idle"), 3000);
    };

    const handleNoBanner = () => {
      setAdState("no_banner");
      setTimeout(() => setAdState("idle"), 4000);
    };

    const handleDone = () => setAdState("done");

    task.addEventListener("reward", handleReward);
    task.addEventListener("error", handleError);
    task.addEventListener("bannerNotFound", handleNoBanner);
    task.addEventListener("done", handleDone);

    return () => {
      task.removeEventListener("reward", handleReward);
      task.removeEventListener("error", handleError);
      task.removeEventListener("bannerNotFound", handleNoBanner);
      task.removeEventListener("done", handleDone);
    };
  }, [onReward, onError]);

  /* ── derived UI values ── */
  const isIdle       = adState === "idle";
  const isWatching   = adState === "watching";
  const isClaim      = adState === "claim";
  const isDone       = adState === "done";
  const isError      = adState === "error";
  const isNoBanner   = adState === "no_banner";

  const iconEmoji =
    isWatching ? "▶️" :
    isClaim    ? "🎁" :
    isDone     ? "✅" :
    isError    ? "❌" :
    isNoBanner ? "😔" : "🎬";

  const title =
    isWatching ? "Ad Playing..." :
    isClaim    ? "Reward Ready!" :
    isDone     ? "Reward Claimed!" :
    isError    ? "Ad Unavailable" :
    isNoBanner ? "No Ads Right Now" :
                 "Watch Sponsored Video";

  const subtitle =
    isWatching ? "Watch till end to earn" :
    isClaim    ? "Tap Claim to collect your coins" :
    isDone     ? `+${rewardAmount} pts added to balance` :
    isError    ? "Retrying shortly..." :
    isNoBanner ? "Check back in a few minutes" :
                 "Short ad • Instant reward";

  const iconBg =
    isClaim  ? "linear-gradient(45deg,#f59e0b,#fbbf24)" :
    isDone   ? "linear-gradient(45deg,#16a34a,#22c55e)" :
    isError  ? "linear-gradient(45deg,#dc2626,#ef4444)" :
               "linear-gradient(45deg,#3b82f6,#60a5fa)";

  const cardBorder =
    isClaim    ? "rgba(245,158,11,0.45)" :
    isDone     ? "rgba(34,197,94,0.35)" :
    isError    ? "rgba(220,38,38,0.35)" :
    isWatching ? "rgba(59,130,246,0.35)" :
                 "rgba(255,255,255,0.08)";

  const cardGlow =
    isClaim  ? "0 0 24px rgba(245,158,11,0.18)" :
    isDone   ? "0 0 24px rgba(34,197,94,0.15)" :
               "0 4px 16px rgba(0,0,0,0.4)";

  return (
    <>
      <style>{`
        @keyframes adsWatchBar {
          from { width: 0% }
          to   { width: 100% }
        }
        @keyframes adsBtnPulse {
          0%,100% { transform:scale(1);   box-shadow:0 4px 14px rgba(245,158,11,0.4); }
          50%      { transform:scale(1.06); box-shadow:0 6px 22px rgba(245,158,11,0.7); }
        }
        @keyframes adsIconBounce {
          0%,100% { transform:scale(1); }
          50%      { transform:scale(1.12); }
        }
        @keyframes adsFadeIn {
          from { opacity:0; transform:translateY(4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .ads-card   { animation: adsFadeIn 0.25s ease; }
        .ads-icon-pulse { animation: adsIconBounce 1.4s ease-in-out infinite; }
        .ads-btn-pulse  { animation: adsBtnPulse   1.2s ease-in-out infinite; }
      `}</style>

      <adsgram-task
        ref={taskRef}
        data-block-id={blockId}
        style={{ display: "block", width: "100%" }}
      >
        {/* ── reward badge slot ── */}
        <div
          slot="reward"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#fbbf24",
            background: "rgba(251,191,36,0.15)",
            padding: "3px 10px",
            borderRadius: "20px",
            border: "1px solid rgba(251,191,36,0.25)",
            whiteSpace: "nowrap",
            letterSpacing: "0.3px",
          }}
        >
          +{rewardAmount} pts
        </div>

        {/* ── main card ── */}
        <div
          className="ads-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            background: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)",
            borderRadius: "20px",
            padding: "15px 16px",
            border: `1px solid ${cardBorder}`,
            boxShadow: cardGlow,
            transition: "border-color 0.35s ease, box-shadow 0.35s ease",
          }}
        >
          {/* icon */}
          <div
            className={isClaim ? "ads-icon-pulse" : ""}
            style={{
              width: "48px", height: "48px", minWidth: "48px",
              borderRadius: "14px",
              background: iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px",
              boxShadow: isClaim
                ? "0 4px 14px rgba(245,158,11,0.45)"
                : isDone
                ? "0 4px 14px rgba(34,197,94,0.35)"
                : "0 4px 12px rgba(59,130,246,0.3)",
              transition: "background 0.3s, box-shadow 0.3s",
              flexShrink: 0,
            }}
          >
            {iconEmoji}
          </div>

          {/* text + progress */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "14px", fontWeight: 700, color: "#f3f4f6",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              transition: "color 0.3s",
            }}>
              {title}
            </div>

            <div style={{
              fontSize: "12px",
              color: isClaim ? "#fbbf24" : isDone ? "#4ade80" : "#6b7280",
              marginTop: "3px",
              transition: "color 0.3s",
            }}>
              {subtitle}
            </div>

            {/* watching progress bar */}
            {isWatching && (
              <div style={{
                marginTop: "7px", height: "3px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: "999px", overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg,#3b82f6,#60a5fa)",
                  borderRadius: "999px",
                  animation: "adsWatchBar 20s linear forwards",
                }} />
              </div>
            )}
          </div>

          {/* ── buttons (Adsgram controls visibility via slot) ── */}
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>

            {/* WATCH button */}
            <button
              slot="button"
              onClick={showAd}
              disabled={isWatching || isDone}
              style={{
                background: isError || isNoBanner
                  ? "#374151"
                  : "linear-gradient(135deg,#3b82f6,#2563eb)",
                color: "white", border: "none",
                padding: "10px 18px", borderRadius: "14px",
                fontWeight: 700, fontSize: "13px",
                cursor: isWatching || isDone ? "not-allowed" : "pointer",
                boxShadow: isWatching || isDone
                  ? "none"
                  : "0 4px 12px rgba(59,130,246,0.4)",
                opacity: isWatching ? 0.55 : 1,
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {isWatching ? "Watching…" : isError ? "Retry" : isNoBanner ? "No Ads" : "Watch & Earn"}
            </button>

            {/* CLAIM button */}
            <button
              slot="claim"
              className={isClaim ? "ads-btn-pulse" : ""}
              style={{
                background: "linear-gradient(135deg,#f59e0b,#d97706)",
                color: "white", border: "none",
                padding: "10px 18px", borderRadius: "14px",
                fontWeight: 700, fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(245,158,11,0.45)",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              🎁 Claim
            </button>

            {/* DONE button */}
            <button
              slot="done"
              disabled
              style={{
                background: "linear-gradient(135deg,#16a34a,#15803d)",
                color: "white", border: "none",
                padding: "10px 18px", borderRadius: "14px",
                fontWeight: 700, fontSize: "13px",
                cursor: "default",
                boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
                whiteSpace: "nowrap",
              }}
            >
              ✓ Done
            </button>
          </div>
        </div>
      </adsgram-task>
    </>
  );
}
