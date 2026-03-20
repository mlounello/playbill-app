import { NextResponse } from "next/server";
import { resolvePlatformRoleForUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_SCHEMA, getSupabaseWriteClient } from "@/lib/supabase";
import { getProgramAssetBucketName } from "@/lib/storage-assets";

export const runtime = "nodejs";

type AssetTarget =
  | { kind: "program"; programId: string }
  | { kind: "person-headshot"; showId: string; personId: string };

function guessContentType(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

function parseAssetTarget(path: string): AssetTarget | null {
  const programMatch = path.match(/^programs\/([0-9a-f-]+)\/[^/]+\/[^/]+$/i);
  if (programMatch) {
    return { kind: "program", programId: String(programMatch[1]) };
  }

  const personMatch = path.match(/^shows\/([0-9a-f-]+)\/people\/([0-9a-f-]+)\/[^/]+$/i);
  if (personMatch) {
    return {
      kind: "person-headshot",
      showId: String(personMatch[1]),
      personId: String(personMatch[2])
    };
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const bucket = String(requestUrl.searchParams.get("bucket") ?? "").trim();
    const path = String(requestUrl.searchParams.get("path") ?? "")
      .replace(/^\/+/, "")
      .trim();

    if (!bucket || !path) {
      return NextResponse.json({ ok: false, error: "Missing asset bucket or path." }, { status: 400 });
    }

    const expectedBucket = getProgramAssetBucketName();
    if (bucket !== expectedBucket) {
      return NextResponse.json({ ok: false, error: "Asset bucket is not allowed." }, { status: 403 });
    }

    const target = parseAssetTarget(path);
    if (!target) {
      return NextResponse.json({ ok: false, error: "Asset path is not allowed." }, { status: 403 });
    }

    const admin = getSupabaseWriteClient();
    const db = admin.schema(APP_SCHEMA);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const currentEmail = String(user?.email ?? "").trim().toLowerCase();
    const currentRole =
      user && currentEmail
        ? await resolvePlatformRoleForUser({ supabase, userId: user.id, email: currentEmail })
        : null;
    const isPrivileged = currentRole === "owner" || currentRole === "admin" || currentRole === "editor";

    let allowPublic = false;
    let allowAuthenticated = false;

    if (target.kind === "program") {
      const { data: show } = await db
        .from("shows")
        .select("id, is_published")
        .eq("program_id", target.programId)
        .maybeSingle();

      if (!show?.id) {
        return NextResponse.json({ ok: false, error: "Asset owner not found." }, { status: 404 });
      }

      allowPublic = Boolean(show.is_published);
      allowAuthenticated = isPrivileged;
    } else {
      const { data: show } = await db
        .from("shows")
        .select("id, is_published, program_id")
        .eq("id", target.showId)
        .maybeSingle();
      if (!show?.program_id) {
        return NextResponse.json({ ok: false, error: "Show not found." }, { status: 404 });
      }

      const { data: person } = await db
        .from("people")
        .select("id, email, program_id")
        .eq("id", target.personId)
        .eq("program_id", String(show.program_id))
        .maybeSingle();
      if (!person?.id) {
        return NextResponse.json({ ok: false, error: "Person not found." }, { status: 404 });
      }

      allowPublic = Boolean(show.is_published);
      allowAuthenticated =
        isPrivileged || (Boolean(currentEmail) && String(person.email ?? "").trim().toLowerCase() === currentEmail);
    }

    if (!allowPublic && !allowAuthenticated) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || "Asset not found." }, { status: 404 });
    }

    const bytes = await data.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": data.type || guessContentType(path),
        "Cache-Control": allowPublic ? "public, max-age=3600" : "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load asset." },
      { status: 500 }
    );
  }
}
