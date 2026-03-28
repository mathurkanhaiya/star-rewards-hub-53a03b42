import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 50;
const REWARD = 50; // 🔒 FIXED (no frontend control)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const userId = body.userId;
    const adType = body.adType || "ad_watch";

    if (!userId) throw new Error("Missing userId");

    // ✅ Start of day (UTC)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    // ✅ Accurate count (IMPORTANT FIX)
    const { count, error: countError } = await supabase
      .from("ad_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ad_type", adType)
      .gte("created_at", startOfDay.toISOString());

    if (countError) throw countError;

    if ((count || 0) >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Daily ad limit reached",
          adsToday: count || 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ✅ Insert ad log FIRST (source of truth)
    const { error: logError } = await supabase.from("ad_logs").insert({
      user_id: userId,
      ad_type: adType,
      reward_given: REWARD,
      provider: "adsgram",
    });

    if (logError) throw logError;

    // ✅ SAFE balance update (NO race condition)
    const { error: balanceError } = await supabase.rpc("increment_balance", {
      user_id: userId,
      amount: REWARD,
    });

    if (balanceError) throw balanceError;

    // ✅ Insert transaction
    await supabase.from("transactions").insert({
      user_id: userId,
      type: "ad_reward",
      points: REWARD,
      description: `📺 Ad reward: ${adType}`,
    });

    // ✅ Contest tracking (safe)
    const now = new Date().toISOString();
    const { data: contests } = await supabase
      .from("contests")
      .select("id")
      .eq("contest_type", "ads_watch")
      .eq("is_active", true)
      .lte("starts_at", now)
      .gte("ends_at", now);

    if (contests?.length) {
      for (const c of contests) {
        const { data: existing } = await supabase
          .from("contest_entries")
          .select("id, score")
          .eq("contest_id", c.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("contest_entries")
            .update({
              score: existing.score + 1,
              updated_at: now,
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("contest_entries").insert({
            contest_id: c.id,
            user_id: userId,
            score: 1,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reward: REWARD,
        adsToday: (count || 0) + 1,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("ERROR:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});