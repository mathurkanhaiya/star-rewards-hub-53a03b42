import { useEffect, useRef } from "react";

interface AdsgramTaskProps {
  blockId: string;
  debug?: boolean;
}

export default function AdsgramTask({ blockId, debug = false }: AdsgramTaskProps) {

  const taskRef = useRef<any>(null);

  useEffect(() => {

    const task = taskRef.current;
    if (!task) return;

    const rewardHandler = (event: CustomEvent) => {
      console.log("Reward received:", event.detail);
    };

    const errorHandler = (event: CustomEvent) => {
      console.error("Adsgram error:", event.detail);
    };

    const bannerHandler = (event: CustomEvent) => {
      console.warn("Banner not found:", event.detail);
    };

    const sessionHandler = () => {
      console.warn("Ads session too long. Restart app.");
    };

    task.addEventListener("reward", rewardHandler);
    task.addEventListener("onError", errorHandler);
    task.addEventListener("onBannerNotFound", bannerHandler);
    task.addEventListener("onTooLongSession", sessionHandler);

    return () => {
      task.removeEventListener("reward", rewardHandler);
      task.removeEventListener("onError", errorHandler);
      task.removeEventListener("onBannerNotFound", bannerHandler);
      task.removeEventListener("onTooLongSession", sessionHandler);
    };

  }, []);

  if (!customElements.get("adsgram-task")) {
    return null;
  }

  return (
    <adsgram-task
      ref={taskRef}
      data-block-id={blockId}
      data-debug={debug}
      className="w-full rounded-2xl bg-slate-800 p-4 border border-yellow-400/20"
    >
      <span slot="reward" className="text-yellow-400 font-bold">
        100 coins
      </span>

      <div slot="button" className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold">
        GO
      </div>

      <div slot="claim" className="bg-green-500 px-4 py-2 rounded-lg font-bold">
        CLAIM
      </div>

      <div slot="done" className="bg-gray-600 px-4 py-2 rounded-lg font-bold">
        DONE
      </div>
    </adsgram-task>
  );
}