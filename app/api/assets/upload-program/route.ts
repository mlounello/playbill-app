import { NextResponse } from "next/server";
import { resolvePlatformRoleForUser } from "@/lib/auth";
import { buildAssetProxyUrl, getProgramAssetBucketName } from "@/lib/storage-assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_SCHEMA, getSupabaseWriteClient } from "@/lib/supabase";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureBucket(client: ReturnType<typeof getSupabaseWriteClient>, bucket: string) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message);
  }
  if ((buckets ?? []).some((item) => item.name === bucket)) {
    return;
  }
  const { error: createError } = await client.storage.createBucket(bucket, { public: true, fileSizeLimit: "10MB" });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(createError.message);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const programSlug = String(formData.get("programSlug") ?? "");
    const showId = String(formData.get("showId") ?? "");
    const assetType = String(formData.get("assetType") ?? "program-image");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
    }
    if (!programSlug && !showId) {
      return NextResponse.json({ ok: false, error: "Missing program context." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Only image uploads are allowed." }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Image must be 4MB or smaller." }, { status: 400 });
    }

    const admin = getSupabaseWriteClient();
    const db = admin.schema(APP_SCHEMA);
    const role = await resolvePlatformRoleForUser({ supabase, userId: user.id, email: user.email });
    if (!["owner", "admin", "editor"].includes(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let programId = "";
    let resolvedProgramSlug = "";
    if (programSlug) {
      const { data: programBySlug } = await db
        .from("programs")
        .select("id, slug")
        .eq("slug", programSlug)
        .maybeSingle();
      if (programBySlug) {
        programId = String(programBySlug.id);
        resolvedProgramSlug = String(programBySlug.slug ?? "");
      }
    }

    if (!programId && showId) {
      const { data: show } = await db
        .from("shows")
        .select("program_id")
        .eq("id", showId)
        .maybeSingle();
      if (show?.program_id) {
        const { data: programById } = await db
          .from("programs")
          .select("id, slug")
          .eq("id", String(show.program_id))
          .maybeSingle();
        if (programById) {
          programId = String(programById.id);
          resolvedProgramSlug = String(programById.slug ?? "");
        }
      }
    }

    if (!programId) {
      return NextResponse.json({ ok: false, error: "Program not found for provided slug/show." }, { status: 404 });
    }

    const bucket = getProgramAssetBucketName();
    await ensureBucket(admin, bucket);

    const ext = file.name.includes(".") ? file.name.split(".").pop() ?? "jpg" : "jpg";
    const fileName = sanitizeFilename(file.name || `upload.${ext}`);
    const path = `programs/${programId}/${assetType}/${Date.now()}-${fileName}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: file.type,
      upsert: true
    });
    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const publicUrl = buildAssetProxyUrl(bucket, path);

    return NextResponse.json({ ok: true, url: publicUrl, path, programSlug: resolvedProgramSlug || programSlug });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected upload failure." },
      { status: 500 }
    );
  }
}
