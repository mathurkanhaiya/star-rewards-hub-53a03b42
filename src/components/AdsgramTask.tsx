import { useEffect, useRef } from "react";

interface AdsgramTaskProps {
  blockId: string;
}

export default function AdsgramTask({ blockId }: AdsgramTaskProps) {

  const taskRef = useRef<any>(null);

  useEffect(() => {

    const task = taskRef.current;
    if (!task) return;

    const onReward = (event:any)=>{
      console.log("Reward received:", event.detail);
      // Here you can add reward logic if needed
    };

    const onError = (event:any)=>{
      console.log("Adsgram error:", event.detail);
    };

    const onBannerNotFound = (event:any)=>{
      console.log("No ad available:", event.detail);
    };

    const onTooLongSession = ()=>{
      console.log("Adsgram session too long");
    };

    task.addEventListener("reward", onReward);
    task.addEventListener("onError", onError);
    task.addEventListener("onBannerNotFound", onBannerNotFound);
    task.addEventListener("onTooLongSession", onTooLongSession);

    return ()=>{
      task.removeEventListener("reward", onReward);
      task.removeEventListener("onError", onError);
      task.removeEventListener("onBannerNotFound", onBannerNotFound);
      task.removeEventListener("onTooLongSession", onTooLongSession);
    };

  }, []);

  return (

    <adsgram-task
      ref={taskRef}
      className="task"
      data-block-id={blockId}
      style={{
        display:"block",
        width:"100%",
        marginBottom:"14px"
      }}
    >

      <span slot="reward" style={{fontWeight:"bold"}}>
        10 coins
      </span>

      <div
        slot="button"
        style={{
          background:"#3b82f6",
          padding:"6px 12px",
          borderRadius:"8px",
          color:"#fff"
        }}
      >
        GO
      </div>

      <div
        slot="claim"
        style={{
          background:"#f59e0b",
          padding:"6px 12px",
          borderRadius:"8px",
          color:"#fff"
        }}
      >
        CLAIM
      </div>

      <div
        slot="done"
        style={{
          background:"#22c55e",
          padding:"6px 12px",
          borderRadius:"8px",
          color:"#fff"
        }}
      >
        DONE
      </div>

    </adsgram-task>

  );
}