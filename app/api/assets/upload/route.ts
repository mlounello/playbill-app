import { NextResponse } from "next/server";
import { resolvePlatformRoleForUser } from "@/lib/auth";
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
  const { data: buckets } = await client.storage.listBuckets();
  if ((buckets ?? []).some((item) => item.name === bucket)) {
    return;
  }
  await client.storage.createBucket(bucket, { public: true, fileSizeLimit: "10MB" });
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
    const showId = String(formData.get("showId") ?? "");
    const personId = String(formData.get("personId") ?? "");
    const assetType = String(formData.get("assetType") ?? "headshot");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
    }
    if (!showId || !personId) {
      return NextResponse.json({ ok: false, error: "Missing show/person context." }, { status: 400 });
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

    const { data: show } = await db.from("shows").select("id, program_id").eq("id", showId).maybeSingle();
    if (!show?.program_id) {
      return NextResponse.json({ ok: false, error: "Show not found." }, { status: 404 });
    }

    const { data: person } = await db
      .from("people")
      .select("id, email, program_id")
      .eq("id", personId)
      .eq("program_id", show.program_id)
      .maybeSingle();
    if (!person) {
      return NextResponse.json({ ok: false, error: "Person not found." }, { status: 404 });
    }

    if (!["owner", "admin", "editor"].includes(role)) {
      if (String(person.email ?? "").toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const bucket = "program-assets";
    await ensureBucket(admin, bucket);

    const ext = file.name.includes(".") ? file.name.split(".").pop() ?? "jpg" : "jpg";
    const fileName = sanitizeFilename(file.name || `upload.${ext}`);
    const path = `shows/${showId}/people/${personId}/${Date.now()}-${fileName}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: file.type,
      upsert: true
    });
    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from(bucket).getPublicUrl(path);
    const publicUrl = String(publicUrlData.publicUrl ?? "");

    const { error: peopleError } = await db.from("people").update({ headshot_url: publicUrl }).eq("id", personId);
    if (peopleError) {
      return NextResponse.json({ ok: false, error: peopleError.message }, { status: 500 });
    }

    await db.from("assets").insert({
      show_id: showId,
      person_id: personId,
      asset_type: assetType,
      storage_path: path,
      metadata: { file_name: file.name, content_type: file.type, size: file.size, public_url: publicUrl },
      created_by: user.id
    });

    return NextResponse.json({ ok: true, url: publicUrl, path });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected upload failure." },
      { status: 500 }
    );
  }
}
