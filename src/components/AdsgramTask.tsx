import { useEffect, useRef, useCallback, useState } from "react";

interface AdsgramTaskProps {
  blockId: string;
  rewardAmount?: number;
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
  const [state, setState] = useState<"idle" | "done" | "error" | "no_banner">("idle");

  useEffect(() => {
    const task = taskRef.current;
    if (!task) return;

    const handleReward = (e: Event) => {
      setState("done");
      onReward?.((e as CustomEvent).detail);
    };

    const handleError = (e: Event) => {
      setState("error");
      onError?.((e as CustomEvent).detail);
      setTimeout(() => setState("idle"), 3000);
    };

    const handleNoBanner = () => {
      setState("no_banner");
      setTimeout(() => setState("idle"), 4000);
    };

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
    <>
      <style>{`
        .ags-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }

        /* Overlay header above the raw web component */
        .ags-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 0 16px;
        }

        .ags-left {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .ags-icon {
          width: 44px; height: 44px;
          border-radius: 13px;
          background: linear-gradient(45deg, #3b82f6, #60a5fa);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          box-shadow: 0 3px 10px rgba(59,130,246,0.35);
          flex-shrink: 0;
        }

        .ags-title {
          font-size: 14px;
          font-weight: 700;
          color: #f3f4f6;
        }

        .ags-sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        .ags-badge {
          font-size: 12px;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(251,191,36,0.15);
          border: 1px solid rgba(251,191,36,0.25);
          padding: 4px 10px;
          border-radius: 20px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Let Adsgram render its own UI below, but style the container */
        adsgram-task {
          display: block;
          padding: 10px 16px 14px 16px;
        }

        /* Override Adsgram's default "go" button styling */
        adsgram-task button,
        adsgram-task [slot="button"] {
          background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
          color: white !important;
          border: none !important;
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          padding: 9px 18px !important;
          cursor: pointer !important;
          box-shadow: 0 3px 10px rgba(59,130,246,0.35) !important;
        }

        /* Done state overlay */
        .ags-done-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #052e16cc, #0f172acc);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          backdrop-filter: blur(4px);
          animation: agsFadeIn 0.3s ease;
        }

        .ags-done-overlay span:first-child {
          font-size: 32px;
        }

        .ags-done-overlay span:last-child {
          font-size: 13px;
          font-weight: 700;
          color: #4ade80;
        }

        .ags-error-bar {
          margin: 0 16px 12px;
          padding: 9px 14px;
          background: rgba(220,38,38,0.15);
          border: 1px solid rgba(220,38,38,0.3);
          border-radius: 12px;
          font-size: 12px;
          color: #f87171;
          font-weight: 600;
          text-align: center;
        }

        .ags-nobanner-bar {
          margin: 0 16px 12px;
          padding: 9px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
          text-align: center;
        }

        @keyframes agsFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div className="ags-wrap">
        {/* Custom header — always visible */}
        <div className="ags-header">
          <div className="ags-left">
            <div className="ags-icon">🎬</div>
            <div>
              <div className="ags-title">Watch Sponsored Video</div>
              <div className="ags-sub">Short ad • Instant reward</div>
            </div>
          </div>
          <div className="ags-badge">+{rewardAmount} pts</div>
        </div>

        {/* Status bars */}
        {state === "error" && (
          <div className="ags-error-bar">❌ Ad unavailable — retrying shortly</div>
        )}
        {state === "no_banner" && (
          <div className="ags-nobanner-bar">😔 No ads right now — check back later</div>
        )}

        {/* Adsgram renders its own button/UI here — we just style the wrapper */}
        <adsgram-task
          ref={taskRef}
          data-block-id={blockId}
        />

        {/* Done overlay */}
        {state === "done" && (
          <div className="ags-done-overlay">
            <span>✅</span>
            <span>+{rewardAmount} pts claimed!</span>
          </div>
        )}
      </div>
    </>
  );
}
