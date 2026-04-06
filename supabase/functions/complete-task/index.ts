import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-supabase-client-platform, x-supabase-client-platform-version',
};

function validateInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    params.delete('hash');
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
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function verifyTelegramMembership(botToken: string, chatId: string, telegramId: number): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${telegramId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) {
      const status = data.result?.status;
      return ['member', 'administrator', 'creator'].includes(status);
    }
    return false;
  } catch { return false; }
}

function extractChatId(link: string): string | null {
  if (!link) return null;
  const match = link.match(/t\.me\/([a-zA-Z0-9_]+)/);
  if (match) return `@${match[1]}`;
  return null;
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('TG send error:', e); }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate Telegram session
    const initData = req.headers.get('x-telegram-init-data') || '';
    const body = await req.json();
    const { taskId } = body;

    const validation = validateInitData(initData, botToken);
    if (!validation.valid || !validation.user) {
      return json({ success: false, message: 'Invalid session' }, 401);
    }

    // Get user from telegram_id
    const { data: dbUser } = await supabase.from('users').select('id, telegram_id, is_banned')
      .eq('telegram_id', validation.user.id).single();
    if (!dbUser) return json({ success: false, message: 'User not found' }, 404);
    if (dbUser.is_banned) return json({ success: false, message: 'Account suspended' }, 403);

    const userId = dbUser.id;
    if (!taskId) return json({ success: false, message: 'Missing taskId' }, 400);

    const { data: task } = await supabase
      .from('tasks').select('*').eq('id', taskId).eq('is_active', true).single();

    if (!task) return json({ success: false, message: 'Task not found or inactive' });

    // Check completion
    if (!task.is_repeatable) {
      const { data: existing } = await supabase
        .from('user_tasks').select('id').eq('user_id', userId).eq('task_id', taskId).single();
      if (existing) return json({ success: false, message: 'Task already completed!' });
    } else {
      const { data: lastCompletion } = await supabase
        .from('user_tasks').select('next_available_at')
        .eq('user_id', userId).eq('task_id', taskId)
        .order('completed_at', { ascending: false }).limit(1).single();
      if (lastCompletion?.next_available_at && new Date(lastCompletion.next_available_at) > new Date()) {
        return json({ success: false, message: 'Task cooldown not finished yet' });
      }
    }

    // Verify TG membership for social tasks
    if (task.task_type === 'social' && task.link && task.link.includes('t.me/')) {
      const chatId = extractChatId(task.link);
      if (chatId) {
        const isMember = await verifyTelegramMembership(botToken, chatId, dbUser.telegram_id);
        if (!isMember) {
          return json({ success: false, message: 'Please join the channel/group first, then try again!' });
        }
      }
    }

    const points = task.reward_points;
    const nextAvailable = task.is_repeatable
      ? new Date(Date.now() + (task.repeat_hours || 24) * 3600000).toISOString()
      : null;

    await supabase.from('user_tasks').insert({
      user_id: userId, task_id: taskId, points_earned: points, next_available_at: nextAvailable,
    });

    await supabase.rpc('increment_points', { p_user_id: userId, p_points: points });

    await supabase.from('transactions').insert({
      user_id: userId, type: 'earn', points,
      description: `✅ Task: ${task.title}`, reference_id: taskId,
    });

    await sendTelegramMessage(dbUser.telegram_id,
      `✅ <b>Task Completed!</b>\n\n${task.title}\n+${points} points earned! 🎉`
    );

    return json({ success: true, points });
  } catch (error) {
    console.error('complete-task error:', error);
    return json({ success: false, message: (error as Error).message }, 500);
  }
});