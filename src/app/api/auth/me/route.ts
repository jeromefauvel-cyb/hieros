import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("hieros_session")?.value;
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const userId = session.split(":")[0];
  if (!userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: data.user });
}
