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
      alert(`Reward in block ${event.detail}`);
    };

    const onError = (event:any)=>{
      alert(`Error during loading or render for block ${event.detail}`);
    };

    const onBannerNotFound = (event:any)=>{
      alert(`Can't find banner for block ${event.detail}`);
    };

    const onTooLongSession = ()=>{
      alert("Session too long. Restart the app to get ads");
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
      class="task"
      data-block-id={blockId}
      style={{
        display:"block",
        width:"100%",
        marginBottom:"14px"
      }}
    >

      {/* Reward slot */}
      <span slot="reward" style={{fontWeight:"bold"}}>
        100 coins
      </span>

      {/* Button slot */}
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

      {/* Claim slot */}
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

      {/* Done slot */}
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