import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isAdmin, unauthorized } from "@/lib/admin-check";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data, error } = await supabaseAdmin.from("site_settings").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const body = await req.json();
    const { key, value } = body;
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select()
      .maybeSingle();
    if (error) {
      console.error("[PUT /api/admin/site-settings] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[PUT /api/admin/site-settings] Unhandled error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
