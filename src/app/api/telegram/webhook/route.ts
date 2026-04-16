import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

async function sendTelegram(token: string, chatId: number | string, text: string) {
  try {
    console.log(`[WEBHOOK] sendTelegram to chatId=${chatId} text=${text.slice(0, 50)}...`);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json();
    console.log(`[WEBHOOK] sendTelegram result: ok=${data.ok} ${data.description || ""}`);
    return data;
  } catch (err) {
    console.error(`[WEBHOOK] sendTelegram FAILED:`, err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log("[WEBHOOK] === START ===");

  // Check env vars
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  console.log(`[WEBHOOK] TOKEN present: ${!!token} (${token ? token.slice(0, 5) + "..." : "MISSING"})`);
  console.log(`[WEBHOOK] ADMIN_CHAT_ID: ${adminChatId || "MISSING"}`);

  if (!token) {
    console.error("[WEBHOOK] TELEGRAM_BOT_TOKEN is not set!");
    return NextResponse.json({ ok: true });
  }

  // Parse body
  let body;
  try {
    body = await req.json();
    console.log("[WEBHOOK] Body parsed:", JSON.stringify(body).slice(0, 500));
  } catch (err) {
    console.error("[WEBHOOK] Failed to parse body:", err);
    return NextResponse.json({ ok: true });
  }

  const message = body.message;
  if (!message?.text || !message?.chat?.id) {
    console.log("[WEBHOOK] No text or chat id, ignoring");
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text;
  const tgUsername = message.from?.username || "";
  const firstName = message.from?.first_name || "";
  console.log(`[WEBHOOK] chatId=${chatId} username=${tgUsername} firstName=${firstName} text=${text}`);

  // Find user
  let user;
  try {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    console.log(`[WEBHOOK] Listed ${users?.users?.length || 0} users`);

    user = users?.users.find((u) => u.user_metadata?.telegram_id === chatId);
    console.log(`[WEBHOOK] Found by telegram_id: ${!!user}`);

    // Auto-link by username
    if (!user && tgUsername) {
      user = users?.users.find(
        (u) => u.user_metadata?.telegram_username?.toLowerCase() === tgUsername.toLowerCase()
      );
      if (user) {
        console.log(`[WEBHOOK] Found by username, linking telegram_id=${chatId}`);
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: { telegram_id: chatId, telegram_username: tgUsername },
        });
        await sendTelegram(token, chatId, "COMPTE HIEROS LIE. VOUS POUVEZ MAINTENANT UTILISER LE CHAT SUR LE SITE.");
      }
    }

    // Handle /start
    if (text === "/start") {
      console.log(`[WEBHOOK] Processing /start`);
      const reply = user
        ? `BIENVENUE ${user.user_metadata?.display_name || user.email || firstName}. VOTRE COMPTE EST LIE.`
        : `BIENVENUE SUR HIEROS BOT.\n\nPOUR LIER VOTRE COMPTE :\n1. CONNECTEZ-VOUS SUR LE SITE\n2. ALLEZ DANS ACCOUNT\n3. ENTREZ VOTRE USERNAME TELEGRAM : @${tgUsername || "votre_username"}\n4. ENVOYEZ /start ICI A NOUVEAU`;
      await sendTelegram(token, chatId, reply);
      console.log("[WEBHOOK] === END /start ===");
      return NextResponse.json({ ok: true });
    }

    // Save message
    if (user) {
      console.log(`[WEBHOOK] Saving message for user=${user.id}`);
      const { error: insertError } = await supabaseAdmin.from("messages").insert({
        user_id: user.id,
        telegram_chat_id: chatId,
        content: text,
        direction: "out",
      });
      if (insertError) console.error(`[WEBHOOK] Insert error: ${insertError.message}`);
    }

    // Forward to admin
    if (adminChatId && String(chatId) !== adminChatId) {
      const username = tgUsername || user?.email || "Unknown";
      console.log(`[WEBHOOK] Forwarding to admin`);
      await sendTelegram(token, adminChatId, `${username}:\n${text}`);
    }

    // Admin reply routing
    if (adminChatId && String(chatId) === adminChatId) {
      const match = text.match(/^@(\S+)\s+([\s\S]+)/);
      if (match) {
        const targetUsername = match[1].toLowerCase();
        const replyText = match[2];
        const targetUser = users?.users.find(
          (u) => u.user_metadata?.telegram_username?.toLowerCase() === targetUsername
        );
        if (targetUser?.user_metadata?.telegram_id) {
          console.log(`[WEBHOOK] Admin reply to @${targetUsername}`);
          await sendTelegram(token, targetUser.user_metadata.telegram_id, replyText);
          await supabaseAdmin.from("messages").insert({
            user_id: targetUser.id,
            telegram_chat_id: targetUser.user_metadata.telegram_id,
            content: replyText,
            direction: "out",
          });
        }
      }
    }
  } catch (err) {
    console.error("[WEBHOOK] Supabase/logic error:", err);
  }

  console.log("[WEBHOOK] === END ===");
  return NextResponse.json({ ok: true });
}
