import { NextRequest, NextResponse } from "next/server";

export function isAdmin(req: NextRequest): boolean {
  return req.cookies.get("hieros_admin")?.value === "authenticated";
}

export function unauthorized() {
  return NextResponse.json({ error: "NON AUTORISÉ" }, { status: 401 });
}
