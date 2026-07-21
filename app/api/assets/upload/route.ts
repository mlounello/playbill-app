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
      .select("id, email, program_id, submission_status")
      .eq("id", personId)
      .eq("program_id", show.program_id)
      .maybeSingle();
    if (!person) {
      return NextResponse.json({ ok: false, error: "Person not found." }, { status: 404 });
    }

    const isStaff = Boolean(role && ["owner", "admin", "editor"].includes(role));
    if (!isStaff) {
      if (String(person.email ?? "").toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
      if (["approved", "locked"].includes(String(person.submission_status ?? ""))) {
        return NextResponse.json({ ok: false, error: "This submission is read-only." }, { status: 403 });
      }

      const { data: roles } = await db
        .from("show_roles")
        .select("id")
        .eq("show_id", showId)
        .eq("person_id", personId);
      const roleIds = (roles ?? []).map((item) => String(item.id)).filter(Boolean);
      const { data: openBioRequest } = roleIds.length
        ? await db
            .from("submission_requests")
            .select("id")
            .in("show_role_id", roleIds)
            .eq("request_type", "bio")
            .not("status", "in", "(approved,locked)")
            .limit(1)
            .maybeSingle()
        : { data: null };
      if (!openBioRequest?.id) {
        return NextResponse.json({ ok: false, error: "No editable bio task is assigned to this account." }, { status: 403 });
      }
    }

    const bucket = getProgramAssetBucketName();
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

    const publicUrl = buildAssetProxyUrl(bucket, path);

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
