import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generatePrintImposedPdf, generateProofPdf, renderProgramPdfWithPlaywright } from "@/lib/export-pdf";
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

  const origin = new URL(request.url).origin;
  let bytes: Uint8Array;
  try {
    bytes = await renderProgramPdfWithPlaywright({
      origin,
      programSlug: String(programRow.slug),
      exportType: exportRow.export_type === "print" ? "print" : "proof"
    });
  } catch {
    // Fallback keeps export reliable if browser rendering is unavailable.
    bytes =
      exportRow.export_type === "print"
        ? await generatePrintImposedPdf({ title: program.title, spreads: program.bookletSpreads })
        : await generateProofPdf({ title: program.title, pages: program.pageSequence });
  }

  const filenameSafeTitle = program.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  const filename = `${filenameSafeTitle}-${exportRow.export_type}.pdf`;

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
