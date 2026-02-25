import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildExportPageMap, generateExportBinary, toPageMapCsv } from "@/lib/export-runtime";
import { getProgramBySlug } from "@/lib/programs";
import { getSupabaseWriteClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ exportId: string }> }
) {
  const { exportId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = getSupabaseWriteClient();
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("platform_role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = String(profile?.platform_role ?? "contributor");
  if (!["owner", "admin", "editor"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: exportRow } = await adminClient
    .from("exports")
    .select("id, show_id, export_type")
    .eq("id", exportId)
    .maybeSingle();
  if (!exportRow) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const { data: show } = await adminClient
    .from("shows")
    .select("id, title, program_id")
    .eq("id", exportRow.show_id)
    .maybeSingle();
  if (!show?.program_id) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  const { data: programRow } = await adminClient
    .from("programs")
    .select("slug")
    .eq("id", show.program_id)
    .maybeSingle();
  if (!programRow?.slug) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const program = await getProgramBySlug(String(programRow.slug));
  if (!program) {
    return NextResponse.json({ error: "Program content not found" }, { status: 404 });
  }

  const diagnostics = {
    export_type: exportRow.export_type === "print" ? "print" : "proof",
    page_count: program.pageSequence.length,
    padded_page_count: program.paddedPages.length,
    booklet_spread_count: program.bookletSpreads.length,
    blank_padding_pages: program.paddingNeeded,
    preview_export_parity_ok: program.previewExportParityOk
  };
  const requestUrl = new URL(request.url);
  const debugMode = requestUrl.searchParams.get("debug") === "1";
  const artifact = String(requestUrl.searchParams.get("artifact") ?? "").trim().toLowerCase();
  const mapFormat = String(requestUrl.searchParams.get("format") ?? "json").trim().toLowerCase();
  if (artifact === "page-map") {
    const effectiveExportType = exportRow.export_type === "print" ? "print" : "proof";
    const pageMap = buildExportPageMap(program, effectiveExportType);
    if (mapFormat === "csv") {
      const csv = toPageMapCsv(pageMap);
      const safe = program.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safe}-${effectiveExportType}-page-map.csv"`
        }
      });
    }
    return NextResponse.json({ ok: true, diagnostics, page_map: pageMap });
  }
  if (debugMode) {
    return NextResponse.json({ ok: true, diagnostics });
  }

  const origin = new URL(request.url).origin;
  let bytes: Uint8Array;
  let renderer: "playwright" | "fallback" = "playwright";
  let fallbackReason = "";
  let cacheStatus = "miss";
  try {
    const effectiveExportType = exportRow.export_type === "print" ? "print" : "proof";
    const generated = await generateExportBinary({
      cacheKey: `admin:${String(show.id)}:${String(programRow.slug)}:${effectiveExportType}`,
      origin,
      programSlug: String(programRow.slug),
      exportType: effectiveExportType,
      program
    });
    bytes = generated.bytes;
    renderer = generated.renderer;
    fallbackReason = generated.fallbackReason;
    cacheStatus = generated.cacheHit ? "hit" : "miss";
  } catch (error) {
    return NextResponse.json(
      {
        error: "Export generation failed",
        stage: "pipeline",
        message: error instanceof Error ? error.message : "unknown"
      },
      { status: 500 }
    );
  }

  const filenameSafeTitle = program.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  const filename = `${filenameSafeTitle}-${exportRow.export_type}.pdf`;

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Playbill-Export-Renderer": renderer,
      "X-Playbill-Page-Count": String(diagnostics.page_count),
      "X-Playbill-Padded-Count": String(diagnostics.padded_page_count),
      "X-Playbill-Sheet-Count": String(diagnostics.booklet_spread_count),
      "X-Playbill-Blank-Pages": String(diagnostics.blank_padding_pages),
      "X-Playbill-Preview-Parity": diagnostics.preview_export_parity_ok ? "ok" : "mismatch",
      "X-Playbill-Fallback-Reason": fallbackReason.slice(0, 120),
      "X-Playbill-Cache": cacheStatus
    }
  });
}
