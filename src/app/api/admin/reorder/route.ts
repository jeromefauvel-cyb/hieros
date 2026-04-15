import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isAdmin, unauthorized } from "@/lib/admin-check";

interface ReorderItem {
  id: string;
  parent_id: string | null;
  position: number;
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  const { table, items }: { table: string; items: ReorderItem[] } = await req.json();

  const allowedTables = ["menu_items", "submenu_items"];
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates = items.map((item) =>
    supabaseAdmin
      .from(table)
      .update({ parent_id: item.parent_id, position: item.position, sort_order: item.position, updated_at: now })
      .eq("id", item.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
