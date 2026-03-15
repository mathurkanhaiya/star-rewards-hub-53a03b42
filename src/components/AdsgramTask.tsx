import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { logAdWatch } from "@/lib/api";

export default function AdsgramTask({ reward = 20 }: any) {

  const { user, refreshBalance } = useApp();
  const [loading,setLoading] = useState(false);

  async function watchAd(){

    if(!window.Adsgram || !user) return;

    setLoading(true);

    try{

      await window.Adsgram.show();

      await logAdWatch(user.id,"adsgram_native",reward);

      await refreshBalance();

    }catch(err){
      console.log(err);
    }

    setLoading(false);
  }

  return(

    <button
      onClick={watchAd}
      disabled={loading}
      className="w-full rounded-3xl p-5 font-bold text-lg bg-slate-800 border border-yellow-400/20 active:scale-95"
    >

      {loading ? "Loading Ad..." : `📺 Watch Ad +${reward}`}

    </button>

  );
}