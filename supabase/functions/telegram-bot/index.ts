import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  return new Response(
    JSON.stringify({ message: 'Telegram bot function is running!' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});