import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isAdmin, unauthorized } from "@/lib/admin-check";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data, error } = await supabaseAdmin.from("menu_items").select("*").order("position").order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json();
  const { data, error } = await supabaseAdmin.from("menu_items").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from("menu_items").update(updates).eq("id", id).select().maybeSingle();
    if (error) {
      console.error("[PUT /api/admin/menu-items] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[PUT /api/admin/menu-items] Unhandled error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from("menu_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
