import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

interface TelegramData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function verifyTelegramAuth(data: TelegramData, botToken: string): boolean {
  const { hash, ...rest } = data;

  // Build check string: alphabetically sorted key=value pairs
  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k as keyof typeof rest]}`)
    .join("\n");

  // Secret key = SHA256 of bot token
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // HMAC-SHA256 of check string with secret key
  const hmac = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  if (hmac !== hash) return false;

  // Reject if auth_date is older than 1 hour
  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > 3600) return false;

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const data: TelegramData = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN non configuré" },
        { status: 500 }
      );
    }

    // Verify Telegram signature
    if (!verifyTelegramAuth(data, botToken)) {
      return NextResponse.json(
        { error: "Signature Telegram invalide" },
        { status: 401 }
      );
    }

    const telegramId = String(data.id);
    const email = `tg_${telegramId}@telegram.hieros.app`;
    const displayName = [data.first_name, data.last_name]
      .filter(Boolean)
      .join(" ") || data.username || `Telegram ${telegramId}`;

    // Check if user already exists by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update metadata
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          telegram_id: telegramId,
          telegram_username: data.username,
          display_name: displayName,
          avatar_url: data.photo_url,
        },
      });
    } else {
      // Create new user
      const { data: newUser, error } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            telegram_id: telegramId,
            telegram_username: data.username,
            display_name: displayName,
            avatar_url: data.photo_url,
          },
        });
      if (error || !newUser.user) {
        return NextResponse.json(
          { error: "Erreur création utilisateur" },
          { status: 500 }
        );
      }
      userId = newUser.user.id;
    }

    // Generate a session token (store in cookie)
    const sessionToken = createHmac("sha256", botToken)
      .update(`${userId}:${Date.now()}`)
      .digest("hex");

    // Store session in Supabase (users table or a sessions table)
    // For simplicity, use a secure httpOnly cookie with user ID
    const response = NextResponse.json({ success: true, userId });
    response.cookies.set("hieros_session", `${userId}:${sessionToken}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
