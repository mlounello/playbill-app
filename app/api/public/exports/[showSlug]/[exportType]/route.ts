import { NextResponse } from "next/server";
import { buildExportPageMap, generateExportBinary, toPageMapCsv } from "@/lib/export-runtime";
import { getProgramBySlug } from "@/lib/programs";
import { APP_SCHEMA, getSupabaseReadClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ showSlug: string; exportType: string }> }
) {
  const { showSlug, exportType } = await params;
  if (!["proof", "print"].includes(exportType)) {
    return NextResponse.json({ error: "invalid_export_type" }, { status: 400 });
  }

  const supabase = getSupabaseReadClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data: show } = await db
    .from("shows")
    .select("id, slug, is_published, program_id")
    .eq("slug", showSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!show?.program_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: programRow } = await db.from("programs").select("slug").eq("id", show.program_id).maybeSingle();
  if (!programRow?.slug) {
    return NextResponse.json({ error: "program_not_found" }, { status: 404 });
  }

  const program = await getProgramBySlug(String(programRow.slug));
  if (!program) {
    return NextResponse.json({ error: "program_content_not_found" }, { status: 404 });
  }

  const diagnostics = {
    export_type: exportType,
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
    const pageMap = buildExportPageMap(program, exportType === "print" ? "print" : "proof");
    if (mapFormat === "csv") {
      const csv = toPageMapCsv(pageMap);
      const safe = program.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safe}-${exportType}-page-map.csv"`
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
    const generated = await generateExportBinary({
      cacheKey: `public:${showSlug}:${String(programRow.slug)}:${exportType}`,
      origin,
      programSlug: String(programRow.slug),
      exportType: exportType === "print" ? "print" : "proof",
      program
    });
    bytes = generated.bytes;
    renderer = generated.renderer;
    fallbackReason = generated.fallbackReason;
    cacheStatus = generated.cacheHit ? "hit" : "miss";
  } catch (error) {
    return NextResponse.json(
      {
        error: "export_generation_failed",
        stage: "pipeline",
        message: error instanceof Error ? error.message : "unknown"
      },
      { status: 500 }
    );
  }

  const safe = program.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  const filename = `${safe}-${exportType}.pdf`;

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
      "X-Playbill-Fallback-Reason": fallbackReason.slice(0, 240),
      "X-Playbill-Render-Target": `/programs/${String(programRow.slug)}${exportType === "print" ? "?view=booklet&export=1" : "?export=1"}`,
      "X-Playbill-Cache": cacheStatus
    }
  });
}
