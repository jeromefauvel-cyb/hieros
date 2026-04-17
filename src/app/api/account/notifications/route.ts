import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

  // Get payment requests sent TO this user
  const { data, error } = await supabaseAdmin
    .from("payment_requests")
    .select("*")
    .eq("to_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with sender info
  const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
  const enriched = (data || []).map((p) => {
    const sender = allUsers?.users.find((u) => u.id === p.from_user_id);
    return {
      ...p,
      from_name: sender?.user_metadata?.display_name || sender?.email || "UNKNOWN",
      from_card: sender?.user_metadata?.card_number || "",
    };
  });

  return NextResponse.json(enriched);
}
