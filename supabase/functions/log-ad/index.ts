import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-supabase-client-platform, x-supabase-client-platform-version",
};

function validateInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    params.delete('hash');
    params.delete('signature');
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) return { valid: false };
    const authDate = parseInt(params.get('auth_date') || '0');
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return { valid: false };
    const userStr = params.get('user');
    return { valid: true, user: userStr ? JSON.parse(userStr) : null };
  } catch { return { valid: false }; }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DAILY_LIMIT = 50;
const REWARD = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const initData = req.headers.get('x-telegram-init-data') || '';
    const body = await req.json();
    const adType = body.adType || "ad_watch";

    const validation = validateInitData(initData, botToken);
    if (!validation.valid || !validation.user) {
      return json({ success: false, error: 'Invalid session' }, 401);
    }

    const { data: dbUser } = await supabase.from('users').select('id')
      .eq('telegram_id', validation.user.id).single();
    if (!dbUser) return json({ success: false, error: 'User not found' }, 404);

    const userId = dbUser.id;

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from("ad_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ad_type", adType)
      .gte("created_at", startOfDay.toISOString());

    if (countError) throw countError;

    if ((count || 0) >= DAILY_LIMIT) {
      return json({ success: false, error: "Daily ad limit reached", adsToday: count || 0 });
    }

    await supabase.from("ad_logs").insert({
      user_id: userId, ad_type: adType, reward_given: REWARD, provider: "adsgram",
    });

    await supabase.rpc('increment_points', { p_user_id: userId, p_points: REWARD });

    await supabase.from("transactions").insert({
      user_id: userId, type: "ad_reward", points: REWARD,
      description: `📺 Ad reward: ${adType}`,
    });

    const now = new Date().toISOString();
    const { data: contests } = await supabase
      .from("contests").select("id")
      .eq("contest_type", "ads_watch").eq("is_active", true)
      .lte("starts_at", now).gte("ends_at", now);

    if (contests?.length) {
      for (const c of contests) {
        const { data: existing } = await supabase
          .from("contest_entries").select("id, score")
          .eq("contest_id", c.id).eq("user_id", userId).maybeSingle();

        if (existing) {
          await supabase.from("contest_entries").update({
            score: existing.score + 1, updated_at: now,
          }).eq("id", existing.id);
        } else {
          await supabase.from("contest_entries").insert({
            contest_id: c.id, user_id: userId, score: 1,
          });
        }
      }
    }

    return json({ success: true, reward: REWARD, adsToday: (count || 0) + 1 });
  } catch (err) {
    console.error("log-ad error:", err);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});