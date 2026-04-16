import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isAdmin, unauthorized } from "@/lib/admin-check";

const BUCKET = "content-media";
const FOLDER = "uploads";
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(FOLDER, {
      limit: 500,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const files = (data || []).map((f) => {
      const path = `${FOLDER}/${f.name}`;
      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      return {
        name: f.name,
        path,
        url: urlData.publicUrl,
        size: f.metadata?.size ?? 0,
        type: f.metadata?.mimetype ?? "",
        created_at: f.created_at,
      };
    });
    return NextResponse.json(files);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { path } = await req.json();
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    // Ensure bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "bin";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `uploads/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[UPLOAD] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("[UPLOAD] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
