import { useEffect } from "react";

declare global {
  interface Window {
    Adsgram: any;
  }
}

export default function AdsgramTask({ blockId }: { blockId: string }) {

  useEffect(() => {

    if (!window.Adsgram) return;

    window.Adsgram.init({
      blockId: blockId
    });

  }, [blockId]);

  return (
    <div
      id={blockId}
      className="w-full rounded-2xl bg-slate-800 p-4 border border-yellow-400/20"
    />
  );
}