import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isAdmin, unauthorized } from "@/lib/admin-check";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.user_metadata?.display_name || "",
    card_number: u.user_metadata?.card_number || "",
    telegram_username: u.user_metadata?.telegram_username || "",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));
  return NextResponse.json(users);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: updates,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.user.id, card_number: data.user.user_metadata?.card_number });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
