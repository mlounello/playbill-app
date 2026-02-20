import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramBySlug } from "@/lib/programs";

export default async function PublicProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ showSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { showSlug } = await params;
  const { view } = await searchParams;
  const program = await getProgramBySlug(showSlug);

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
          <Link href={`/programs/${program.slug}`}>Legacy viewer</Link>
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
          <section className="card">
            <p style={{ margin: 0 }}>
              Flipbook UI shell is active. Next step is replacing this panel with the final page-flip renderer.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
