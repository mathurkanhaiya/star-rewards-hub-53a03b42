import { useEffect, useRef, useCallback } from "react";

interface AdsgramTaskProps {
  blockId: string;
  rewardAmount?: number;       // e.g. 10
  onReward?: (detail: any) => void;
  onError?: (detail: any) => void;
}

export default function AdsgramTask({
  blockId,
  rewardAmount = 10,
  onReward,
  onError,
}: AdsgramTaskProps) {
  const taskRef = useRef<HTMLElement & { show?: () => void }>(null);

  const showAd = useCallback(() => {
    if (taskRef.current?.show) {
      taskRef.current.show();
    } else {
      console.warn("No .show() method found on adsgram-task");
    }
  }, []);

  useEffect(() => {
    const task = taskRef.current;
    if (!task) return;

    const handleReward = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log("Reward:", detail);
      onReward?.(detail);
    };

    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log("Error:", detail);
      onError?.(detail);
    };

    const handleNoBanner = () => console.log("No banner available");

    task.addEventListener("reward", handleReward);
    task.addEventListener("error", handleError);
    task.addEventListener("bannerNotFound", handleNoBanner);

    return () => {
      task.removeEventListener("reward", handleReward);
      task.removeEventListener("error", handleError);
      task.removeEventListener("bannerNotFound", handleNoBanner);
    };
  }, [onReward, onError]);

  return (
    <adsgram-task
      ref={taskRef}
      data-block-id={blockId}
      style={{ display: "block", width: "100%", maxWidth: "420px", margin: "0 auto" }}
    >
      {/* Reward display – usually shown near title or as badge */}
      <div
        slot="reward"
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#fbbf24",
          background: "rgba(251,191,36,0.15)",
          padding: "4px 10px",
          borderRadius: "12px",
          whiteSpace: "nowrap",
        }}
      >
        +{rewardAmount} coins
      </div>

      {/* Optional: custom icon or title slot if supported, otherwise keep in main content */}

      {/* Main card content (not slotted – this is your custom UI wrapper) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #1e293b, #111827)",
          borderRadius: "16px",
          padding: "14px 16px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          transition: "transform 0.15s ease",
          cursor: "default",
        }}
      >
        {/* Left: icon + text */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(45deg, #3b82f6, #60a5fa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              boxShadow: "0 2px 8px rgba(59,130,246,0.4)",
            }}
          >
            🎥
          </div>

          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#f3f4f6" }}>
              Watch Sponsored Video
            </div>
            <div style={{ fontSize: "13px", color: "#9ca3af", marginTop: "2px" }}>
              Short ad • Instant reward
            </div>
          </div>
        </div>

        {/* Buttons – Adsgram shows/hides them automatically */}
        <div style={{ display: "flex", gap: "10px" }}>
          {/* GO button – user clicks this to start ad */}
          <button
            slot="button"
            onClick={showAd}
            style={{
              background: "#3b82f6",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "12px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 6px rgba(59,130,246,0.3)",
            }}
          >
            Watch & Earn
          </button>

          {/* CLAIM – shown after ad watched, before reward */}
          <button
            slot="claim"
            style={{
              background: "#f59e0b",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "12px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Claim Now
          </button>

          {/* DONE – shown after reward given */}
          <button
            slot="done"
            disabled
            style={{
              background: "#22c55e",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "12px",
              fontWeight: 600,
              fontSize: "14px",
              opacity: 0.9,
              cursor: "default",
            }}
          >
            ✓ Done
          </button>
        </div>
      </div>
    </adsgram-task>
  );
}