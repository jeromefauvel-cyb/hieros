import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { user_id, telegram_username } = await req.json();
    if (!user_id || !telegram_username) {
      return NextResponse.json({ error: "Missing user_id or telegram_username" }, { status: 400 });
    }

    const username = telegram_username.replace(/^@/, "").trim();
    if (!username) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    // Try to resolve telegram_id by checking if the bot has seen this user
    // For now, save the username and the ID will be linked when they message the bot
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { telegram_username: username },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      telegram_username: data.user.user_metadata?.telegram_username,
      telegram_id: data.user.user_metadata?.telegram_id,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { telegram_username: null, telegram_id: null },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
