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
    };

    const onError = (event:any)=>{
      console.log("Adsgram error:", event.detail);
    };

    const onBannerNotFound = ()=>{
      console.log("No ad available");
    };

    task.addEventListener("reward", onReward);
    task.addEventListener("onError", onError);
    task.addEventListener("onBannerNotFound", onBannerNotFound);

    return ()=>{
      task.removeEventListener("reward", onReward);
      task.removeEventListener("onError", onError);
      task.removeEventListener("onBannerNotFound", onBannerNotFound);
    };

  }, []);

  return (

    <adsgram-task
      ref={taskRef}
      className="task"
      data-block-id={blockId}
      style={{
        display:"block",
        width:"100%"
      }}
    >

      {/* TASK CARD */}

      <div
        style={{
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          background:"#111827",
          borderRadius:"14px",
          padding:"12px 14px",
          border:"1px solid rgba(255,255,255,0.06)"
        }}
      >

        {/* LEFT */}
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>

          <div
            style={{
              width:"36px",
              height:"36px",
              borderRadius:"8px",
              background:"#1f2937",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              fontSize:"18px"
            }}
          >
            🎯
          </div>

          <div>

            <div style={{fontSize:"14px",fontWeight:"600"}}>
              Watch Sponsored Ad
            </div>

            <span
              slot="reward"
              style={{
                fontSize:"12px",
                color:"#9ca3af"
              }}
            >
              +10 coins
            </span>

          </div>

        </div>

        {/* BUTTONS */}

        <button
          slot="button"
          style={{
            background:"#3b82f6",
            color:"#fff",
            border:"none",
            padding:"6px 14px",
            borderRadius:"8px",
            fontWeight:"600"
          }}
        >
          GO
        </button>

        <button
          slot="claim"
          style={{
            background:"#f59e0b",
            color:"#fff",
            border:"none",
            padding:"6px 14px",
            borderRadius:"8px",
            fontWeight:"600"
          }}
        >
          CLAIM
        </button>

        <button
          slot="done"
          style={{
            background:"#22c55e",
            color:"#fff",
            border:"none",
            padding:"6px 14px",
            borderRadius:"8px",
            fontWeight:"600"
          }}
        >
          DONE
        </button>

      </div>

    </adsgram-task>

  );
}