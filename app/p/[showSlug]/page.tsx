import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicProgramViewer } from "@/components/public-program-viewer";
import { getProgramBySlug } from "@/lib/programs";
import { getSupabaseReadClient } from "@/lib/supabase";

export default async function PublicProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ showSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { showSlug } = await params;
  const { view } = await searchParams;
  const client = getSupabaseReadClient();
  const { data: show } = await client
    .from("shows")
    .select("program_id, slug, is_published")
    .eq("slug", showSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!show?.program_id) {
    notFound();
  }

  const { data: programRow } = await client.from("programs").select("slug").eq("id", show.program_id).maybeSingle();
  const programSlug = String(programRow?.slug ?? "");
  const program = programSlug ? await getProgramBySlug(programSlug) : null;

  if (!program) {
    notFound();
  }

  const scrollView = view === "scroll";

  return (
    <main>
      <div className="container grid">
        <div className="card" style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          <strong>{program.title}</strong>
          <Link href={`/p/${program.slug}`}>Flip view</Link>
          <Link href={`/p/${program.slug}?view=scroll`}>Scroll view</Link>
          <a href={`/api/public/exports/${showSlug}/proof`}>Proof PDF</a>
          <a href={`/api/public/exports/${showSlug}/print`}>Print PDF</a>
        </div>

        {scrollView ? (
          <section className="grid" style={{ gap: "0.75rem" }}>
            {program.paddedPages.map((page, index) => (
              <article key={`${page.id}-${index}`} className="card">
                <strong>Page {index + 1}</strong>
                <div>{page.title}</div>
              </article>
            ))}
          </section>
        ) : (
          <PublicProgramViewer pages={program.paddedPages} showSlug={showSlug} programSlug={program.slug} />
        )}
      </div>
    </main>
  );
}
