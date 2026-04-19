import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicDigitalProgramViewer, PublicProgramViewer } from "@/components/public-program-viewer";
import { getProgramBySlug } from "@/lib/programs";
import { APP_SCHEMA, getSupabaseReadClient } from "@/lib/supabase";

export default async function PublicProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ showSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { showSlug } = await params;
  const { view } = await searchParams;
  const supabase = getSupabaseReadClient();
  const db = supabase.schema(APP_SCHEMA);

  let { data: show } = await db
    .from("shows")
    .select("program_id, slug, is_published")
    .eq("slug", showSlug)
    .eq("is_published", true)
    .maybeSingle();

  // Backward-compatibility: accept old links that use program slug instead of show slug.
  if (!show?.program_id) {
    const { data: programBySlug } = await db.from("programs").select("id").eq("slug", showSlug).maybeSingle();
    if (programBySlug?.id) {
      const { data: showByProgram } = await db
        .from("shows")
        .select("program_id, slug, is_published")
        .eq("program_id", programBySlug.id)
        .eq("is_published", true)
        .maybeSingle();
      show = showByProgram ?? null;
    }
  }

  if (!show?.program_id) {
    notFound();
  }

  const { data: programRow } = await db.from("programs").select("slug").eq("id", show.program_id).maybeSingle();
  const programSlug = String(programRow?.slug ?? "");
  const canonicalShowSlug = String(show.slug ?? showSlug);
  const program = programSlug ? await getProgramBySlug(programSlug) : null;

  if (!program) {
    notFound();
  }

  const flipView = view === "flip";

  return (
    <main className="public-playbill-main">
      <div className="public-playbill-shell">
        {flipView ? (
          <>
            <div className="card top-actions">
              <strong>{program.title}</strong>
              <Link href={`/p/${canonicalShowSlug}`}>Digital view</Link>
              <a href={`/api/public/exports/${canonicalShowSlug}/proof`} data-no-overlay="true">
                Proof PDF
              </a>
              <a href={`/api/public/exports/${canonicalShowSlug}/print`} data-no-overlay="true">
                Print PDF
              </a>
            </div>
            <PublicProgramViewer pages={program.paddedPages} showSlug={canonicalShowSlug} programSlug={program.slug} />
          </>
        ) : (
          <PublicDigitalProgramViewer pages={program.paddedPages} title={program.title} showSlug={canonicalShowSlug} />
        )}
      </div>
    </main>
  );
}
