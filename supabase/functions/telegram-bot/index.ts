import { serve } from "https://deno.land/std/http/server.ts"

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")

serve(async (req) => {

  const update = await req.json()

  if (!update.message) {
    return new Response("ok")
  }

  const chatId = update.message.chat.id
  const text = update.message.text

  if (text === "/test") {

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Welcome to Ads Rewards Bot 🚀"
      })
    })

  }

  return new Response("ok")

})