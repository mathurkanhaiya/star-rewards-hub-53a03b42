import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json();
    const userId = body.userId || "test_user";

    // 🕒 Start of day
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    // 📊 Count ads today
    const { count, error } = await supabase
      .from("ad_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString());

    if (error) throw error;

    // ✅ TEST RESPONSE
    return new Response(
      JSON.stringify({
        working: true,
        user: userId,
        adsToday: count || 0,
        startOfDay: startOfDay.toISOString(),
        serverTime: new Date().toISOString(),
        message: "✅ Code updated & running",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        working: false,
        error: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});