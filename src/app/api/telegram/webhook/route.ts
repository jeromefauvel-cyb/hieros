import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text;

    // Find user by telegram_id
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users.find(
      (u) => u.user_metadata?.telegram_id === chatId
    );

    // Save incoming message
    await supabaseAdmin.from("messages").insert({
      user_id: user?.id || null,
      telegram_chat_id: chatId,
      content: text,
      direction: "out", // from bot/admin perspective, this is outgoing to user's chat view
    });

    // Auto-reply if no user found
    if (!user) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "BIENVENUE SUR HIEROS. CONNECTEZ-VOUS SUR LE SITE POUR LIER VOTRE COMPTE TELEGRAM.",
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TELEGRAM WEBHOOK] Error:", err);
    return NextResponse.json({ ok: true });
  }
}
