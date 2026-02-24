import { NextResponse } from "next/server";
import { generatePrintImposedPdf, generateProofPdf, renderProgramPdfWithPlaywright } from "@/lib/export-pdf";
import { getProgramBySlug } from "@/lib/programs";
import { getSupabaseReadClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ showSlug: string; exportType: string }> }
) {
  const { showSlug, exportType } = await params;
  if (!["proof", "print"].includes(exportType)) {
    return NextResponse.json({ error: "invalid_export_type" }, { status: 400 });
  }

  const client = getSupabaseReadClient();
  const { data: show } = await client
    .from("shows")
    .select("id, slug, is_published, program_id")
    .eq("slug", showSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!show?.program_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: programRow } = await client.from("programs").select("slug").eq("id", show.program_id).maybeSingle();
  if (!programRow?.slug) {
    return NextResponse.json({ error: "program_not_found" }, { status: 404 });
  }

  const program = await getProgramBySlug(String(programRow.slug));
  if (!program) {
    return NextResponse.json({ error: "program_content_not_found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  let bytes: Uint8Array;
  let renderer: "playwright" | "fallback" = "playwright";
  try {
    bytes = await renderProgramPdfWithPlaywright({
      origin,
      programSlug: String(programRow.slug),
      exportType: exportType === "print" ? "print" : "proof"
    });
  } catch {
    renderer = "fallback";
    bytes =
      exportType === "print"
        ? await generatePrintImposedPdf({ title: program.title, spreads: program.bookletSpreads })
        : await generateProofPdf({ title: program.title, pages: program.pageSequence });
  }

  const safe = program.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  const filename = `${safe}-${exportType}.pdf`;

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Playbill-Export-Renderer": renderer
    }
  });
}
