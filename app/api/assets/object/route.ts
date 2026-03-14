import { NextResponse } from "next/server";
import { getSupabaseWriteClient } from "@/lib/supabase";

export const runtime = "nodejs";

function guessContentType(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
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

    const admin = getSupabaseWriteClient();
    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || "Asset not found." }, { status: 404 });
    }

    const bytes = await data.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": data.type || guessContentType(path),
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load asset." },
      { status: 500 }
    );
  }
}
