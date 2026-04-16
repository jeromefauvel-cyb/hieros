import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isAdmin, unauthorized } from "@/lib/admin-check";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data, error } = await supabaseAdmin
    .from("payment_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("payment_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify user via Telegram
    if (data.from_user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(data.from_user_id);
      const telegramId = userData?.user?.user_metadata?.telegram_id;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token && telegramId) {
        const statusText = status === "approved" ? "APPROUVE" : status === "rejected" ? "REJETE" : status === "completed" ? "COMPLETE" : status.toUpperCase();
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            text: `PAIEMENT ${statusText}\nMONTANT: ${data.amount} ${data.currency}\nVERS: ${data.to_card_number}`,
          }),
        });
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
