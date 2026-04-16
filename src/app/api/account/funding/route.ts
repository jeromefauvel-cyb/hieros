import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Save QR code URL to user metadata
export async function PUT(req: NextRequest) {
  try {
    const { user_id, qr_codes } = await req.json();
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { qr_codes },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Create payment request
export async function POST(req: NextRequest) {
  try {
    const { from_user_id, to_card_number, amount, currency, note } = await req.json();
    if (!from_user_id || !to_card_number || !amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("payment_requests").insert({
      from_user_id,
      to_card_number,
      amount,
      currency: currency || "USDT",
      note: note || "",
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify admin via Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (token && adminChatId) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(from_user_id);
      const username = userData?.user?.user_metadata?.telegram_username || userData?.user?.email || "Unknown";
      const cardFrom = userData?.user?.user_metadata?.card_number || "N/A";
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `DEMANDE DE PAIEMENT\nDE: @${username} (${cardFrom})\nVERS: ${to_card_number}\nMONTANT: ${amount} ${currency || "USDT"}\nNOTE: ${note || "-"}\nID: ${data.id}`,
        }),
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Get user's payment requests
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("payment_requests")
    .select("*")
    .eq("from_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
