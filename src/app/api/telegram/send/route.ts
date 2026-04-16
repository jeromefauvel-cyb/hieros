import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { message, user_id } = await req.json();
    if (!message || !user_id) {
      return NextResponse.json({ error: "Missing message or user_id" }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const telegramChatId = userData.user.user_metadata?.telegram_id;
    const username = userData.user.user_metadata?.telegram_username || userData.user.email || "Unknown";

    // Save message to DB
    await supabaseAdmin.from("messages").insert({
      user_id,
      telegram_chat_id: telegramChatId || null,
      content: message,
      direction: "in",
      is_read: true,
    });

    // Forward to admin via Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (token && adminChatId) {
      console.log(`[SEND] Forwarding to admin: MESSAGE DE @${username}`);
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `MESSAGE DE @${username}:\n${message}`,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TELEGRAM SEND] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
