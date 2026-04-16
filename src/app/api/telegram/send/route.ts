import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { message, user_id } = await req.json();
    if (!message || !user_id) {
      return NextResponse.json({ error: "Missing message or user_id" }, { status: 400 });
    }

    // Get user's telegram_id
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const telegramChatId = userData.user.user_metadata?.telegram_id;

    // Save message to DB
    await supabaseAdmin.from("messages").insert({
      user_id,
      telegram_chat_id: telegramChatId || null,
      content: message,
      direction: "in",
    });

    // If user has telegram, also send via bot
    if (telegramChatId) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        // Send to admin/bot owner - the bot forwards the message
        const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
        if (adminChatId) {
          const username = userData.user.user_metadata?.telegram_username || userData.user.email || "Unknown";
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              text: `📩 ${username}:\n${message}`,
            }),
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TELEGRAM SEND] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
