import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("user_id") as string | null;
    const caption = formData.get("caption") as string || "";

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or user_id" }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    // Get user info
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const username = userData?.user?.user_metadata?.telegram_username || userData?.user?.email || "Unknown";

    // Determine file type
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const method = isVideo ? "sendVideo" : isImage ? "sendPhoto" : "sendDocument";
    const fieldName = isVideo ? "video" : isImage ? "photo" : "document";

    let fileUrl = "";

    // Send to admin via Telegram API
    if (token && adminChatId) {
      const tgForm = new FormData();
      tgForm.append("chat_id", adminChatId);
      tgForm.append(fieldName, file, file.name);
      tgForm.append("caption", `FICHIER DE @${username}${caption ? ": " + caption : ""}`);

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        body: tgForm,
      });
      const tgData = await tgRes.json();
      console.log(`[SEND-FILE] Telegram response: ok=${tgData.ok}`);

      // Extract file_id and get file URL
      if (tgData.ok) {
        let fileId = "";
        const result = tgData.result;
        if (result.photo) {
          // Photo returns array of sizes, get the largest
          fileId = result.photo[result.photo.length - 1].file_id;
        } else if (result.video) {
          fileId = result.video.file_id;
        } else if (result.document) {
          fileId = result.document.file_id;
        }

        if (fileId) {
          const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
          const fileData = await fileRes.json();
          if (fileData.ok) {
            fileUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
          }
        }
      }
    }

    // If no Telegram URL, upload to Supabase Storage as fallback
    if (!fileUrl) {
      const ext = file.name.split(".").pop() || "bin";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `uploads/${filename}`;
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("content-media")
        .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

      if (!uploadErr) {
        const { data: urlData } = supabaseAdmin.storage.from("content-media").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }
    }

    // Save message to DB
    const content = fileUrl
      ? `[${isVideo ? "VIDEO" : isImage ? "IMAGE" : "FILE"}]${fileUrl}${caption ? "\n" + caption : ""}`
      : caption || "[FICHIER]";

    await supabaseAdmin.from("messages").insert({
      user_id: userId,
      telegram_chat_id: userData?.user?.user_metadata?.telegram_id || null,
      content,
      direction: "in",
      is_read: true,
    });

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error("[SEND-FILE] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
