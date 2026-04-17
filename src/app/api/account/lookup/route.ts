import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const cardNumber = req.nextUrl.searchParams.get("card");
  if (!cardNumber) return NextResponse.json({ error: "Missing card" }, { status: 400 });

  // Sanitize: only digits
  const clean = cardNumber.replace(/\D/g, "");
  if (clean.length !== 9) return NextResponse.json({ qr_codes: [] });

  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const user = users?.users.find((u) => {
    const userCard = (u.user_metadata?.card_number || "").replace(/\D/g, "");
    if (userCard && userCard === clean) return true;
    const autoCard = parseInt(u.id.replace(/[^a-f0-9]/g, "").slice(0, 8), 16).toString().padStart(9, "0").slice(0, 9);
    return autoCard === clean;
  });

  if (!user) return NextResponse.json({ qr_codes: [] });

  // Only expose necessary fields — no email, no user ID, no internal data
  const qrCodes = (user.user_metadata?.qr_codes || []).map((qr: Record<string, string>) => ({
    label: qr.label || "",
    url: qr.url || "",       // QR image needed for payment
    address: qr.address || "",
    chain: qr.chain || "",
  }));

  return NextResponse.json({
    qr_codes: qrCodes,
    display_name: user.user_metadata?.display_name || "USER",
  });
}
