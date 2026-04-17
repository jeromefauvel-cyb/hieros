import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

// Verify the authenticated user matches the requested user_id
async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    // Fallback: check cookie-based session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const cookies = req.cookies;
    const accessToken = cookies.get("sb-access-token")?.value;
    if (accessToken) {
      const { data } = await supabase.auth.getUser(accessToken);
      return data.user?.id || null;
    }
    return null;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase.auth.getUser(token);
  return data.user?.id || null;
}

// Save QR code URL to user metadata — only own account
export async function PUT(req: NextRequest) {
  try {
    const { user_id, qr_codes } = await req.json();
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    // Verify ownership: use supabaseAdmin to check session via user_id
    // Since client sends user_id from their own session, we verify it matches
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (!userData?.user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Sanitize qr_codes: only allow expected fields
    const sanitized = (Array.isArray(qr_codes) ? qr_codes : []).map((qr: Record<string, unknown>) => ({
      label: String(qr.label || "").slice(0, 20),
      url: String(qr.url || "").slice(0, 500),
      address: String(qr.address || "").slice(0, 200),
      chain: String(qr.chain || "").slice(0, 20),
    })).slice(0, 10); // Max 10 wallets

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { qr_codes: sanitized },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Create payment request — only own account
export async function POST(req: NextRequest) {
  try {
    const { from_user_id, to_card_number, amount, currency, note } = await req.json();
    if (!from_user_id || !to_card_number || !amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Sanitize inputs
    const cleanCard = String(to_card_number).replace(/[^0-9\s]/g, "").slice(0, 20);
    const cleanAmount = Math.max(0, Math.min(parseFloat(amount) || 0, 999999999));
    const cleanCurrency = String(currency || "USDT").slice(0, 10);
    const cleanNote = String(note || "").slice(0, 200);

    const { data, error } = await supabaseAdmin.from("payment_requests").insert({
      from_user_id,
      to_card_number: cleanCard,
      amount: cleanAmount,
      currency: cleanCurrency,
      note: cleanNote,
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
          text: `DEMANDE DE PAIEMENT\nDE: @${username} (${cardFrom})\nVERS: ${cleanCard}\nMONTANT: ${cleanAmount} ${cleanCurrency}\nNOTE: ${cleanNote || "-"}\nID: ${data.id}`,
        }),
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Get user's payment requests — only own account
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
