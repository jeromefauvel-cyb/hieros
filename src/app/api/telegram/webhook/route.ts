import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[WEBHOOK] Received:", JSON.stringify(body).slice(0, 500));

    const message = body.message;
    if (!message?.text || !message?.chat?.id) {
      console.log("[WEBHOOK] No text or chat id, ignoring");
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text;
    const tgUsername = message.from?.username || "";
    const firstName = message.from?.first_name || "";
    const token = process.env.TELEGRAM_BOT_TOKEN;

    console.log(`[WEBHOOK] chatId=${chatId} username=${tgUsername} text=${text}`);

    // Find user by telegram_id or telegram_username
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    let user = users?.users.find(
      (u) => u.user_metadata?.telegram_id === chatId
    );
    console.log(`[WEBHOOK] Found by telegram_id: ${!!user}`);

    // If not found by ID, try by username and link the telegram_id
    if (!user && tgUsername) {
      user = users?.users.find(
        (u) => u.user_metadata?.telegram_username?.toLowerCase() === tgUsername.toLowerCase()
      );
      if (user) {
        console.log(`[WEBHOOK] Found by username, linking telegram_id=${chatId}`);
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: { telegram_id: chatId, telegram_username: tgUsername },
        });

        if (token) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "COMPTE HIEROS LIE. VOUS POUVEZ MAINTENANT UTILISER LE CHAT SUR LE SITE.",
            }),
          });
        }
      }
    }

    // Handle /start command
    if (text === "/start") {
      console.log(`[WEBHOOK] /start command from chatId=${chatId}`);

      // If user not found, try to create link with username
      if (!user && tgUsername) {
        console.log(`[WEBHOOK] No user found for /start, sending instructions`);
      }

      if (token) {
        const reply = user
          ? `BIENVENUE ${user.user_metadata?.display_name || user.email || firstName}. VOTRE COMPTE EST LIE.`
          : `BIENVENUE SUR HIEROS BOT.\n\nPOUR LIER VOTRE COMPTE :\n1. CONNECTEZ-VOUS SUR LE SITE\n2. ALLEZ DANS ACCOUNT\n3. ENTREZ VOTRE USERNAME TELEGRAM : @${tgUsername || "votre_username"}\n4. ENVOYEZ /start ICI A NOUVEAU`;

        console.log(`[WEBHOOK] Sending /start reply to chatId=${chatId}`);
        const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: reply }),
        });
        const sendData = await sendRes.json();
        console.log(`[WEBHOOK] /start reply result: ${JSON.stringify(sendData).slice(0, 200)}`);
      } else {
        console.log("[WEBHOOK] No TELEGRAM_BOT_TOKEN configured");
      }

      return NextResponse.json({ ok: true });
    }

    // Save incoming message
    if (user) {
      console.log(`[WEBHOOK] Saving message for user=${user.id}`);
      const { error: insertError } = await supabaseAdmin.from("messages").insert({
        user_id: user.id,
        telegram_chat_id: chatId,
        content: text,
        direction: "out",
      });
      if (insertError) console.log(`[WEBHOOK] Insert error: ${insertError.message}`);
    } else {
      console.log(`[WEBHOOK] No user found, message not saved`);
    }

    // Forward to admin
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (token && adminChatId && String(chatId) !== adminChatId) {
      const username = tgUsername || user?.email || "Unknown";
      console.log(`[WEBHOOK] Forwarding to admin chatId=${adminChatId}`);
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `${username}:\n${text}`,
        }),
      });
    }

    // If admin replies, route to user (format: @username message)
    if (token && adminChatId && String(chatId) === adminChatId) {
      const match = text.match(/^@(\S+)\s+([\s\S]+)/);
      if (match) {
        const targetUsername = match[1].toLowerCase();
        const replyText = match[2];
        const targetUser = users?.users.find(
          (u) => u.user_metadata?.telegram_username?.toLowerCase() === targetUsername
        );
        if (targetUser?.user_metadata?.telegram_id) {
          console.log(`[WEBHOOK] Admin reply to @${targetUsername}`);
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetUser.user_metadata.telegram_id, text: replyText }),
          });
          await supabaseAdmin.from("messages").insert({
            user_id: targetUser.id,
            telegram_chat_id: targetUser.user_metadata.telegram_id,
            content: replyText,
            direction: "out",
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    return NextResponse.json({ ok: true });
  }
}
