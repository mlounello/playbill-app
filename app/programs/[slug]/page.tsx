import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getProgramBySlug } from "@/lib/programs";
import type { ProgramPage } from "@/lib/programs";

function RenderPageContent({ page }: { page: ProgramPage }) {
  if (page.type === "poster") {
    return (
      <article className="booklet-page poster-page">
        <Image src={page.imageUrl} alt={page.title} width={1200} height={1800} className="poster-image" />
        <div className="poster-overlay">
          <h2 className="poster-title">{page.title}</h2>
          <p>{page.subtitle}</p>
        </div>
      </article>
    );
  }

  if (page.type === "text") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <div className="page-body" style={{ whiteSpace: "pre-wrap" }}>
          {page.body}
        </div>
      </article>
    );
  }

  if (page.type === "image") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <Image src={page.imageUrl} alt={page.title} width={1200} height={1800} className="full-page-image" />
      </article>
    );
  }

  if (page.type === "photo_grid") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <div className="photo-grid">
          {page.photos.map((photo, index) => (
            <Image key={`${photo}-${index}`} src={photo} alt={`${page.title} ${index + 1}`} width={600} height={420} className="photo-grid-item" />
          ))}
        </div>
      </article>
    );
  }

  if (page.type === "bios") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <div className="bios-list">
          {page.people.map((person) => (
            <section key={person.id} className="bio-row">
              {person.headshot_url ? <Image src={person.headshot_url} alt={person.full_name} width={140} height={140} className="headshot" /> : null}
              <div>
                <div className="bio-name">{person.full_name}</div>
                <div className="bio-role">{person.role_title}</div>
                <p className="page-body">{person.bio}</p>
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="booklet-page">
      <h2 className="section-title playbill-title">{page.title}</h2>
      <p className="page-body">{page.body}</p>
    </article>
  );
}

export default async function ProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { view } = await searchParams;
  const program = await getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const isBookletView = view === "booklet";

  return (
    <main>
      <div className="container">
        <div className="hide-print" style={{ display: "flex", gap: "0.8rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <Link href="/">Home</Link>
          <Link href="/programs/new">Create another</Link>
          <Link href={`/programs/${program.slug}/submit`}>Share Bio Submission Form</Link>
          <Link href={`/programs/${program.slug}`}>Program order view</Link>
          <Link href={`/programs/${program.slug}?view=booklet`}>Booklet imposition view</Link>
          <PrintButton />
        </div>

        <section className="card hide-print" style={{ marginBottom: "1rem" }}>
          <strong>Booklet Summary:</strong> {program.pageSequence.length} designed pages, padded to {program.paddedPages.length} for saddle-stitch (multiple of 4), {program.paddedPages.length / 4} sheets total.
        </section>

        {isBookletView ? (
          <section className="booklet-sheets">
            {program.bookletSpreads.map((spread) => (
              <div key={`${spread.sheet}-${spread.side}`} className="sheet">
                <div className="sheet-meta hide-print">Sheet {spread.sheet} {spread.side}</div>
                <div className="sheet-grid">
                  <div>
                    <RenderPageContent page={spread.left.content} />
                    <div className="folio">Page {spread.left.pageNumber}</div>
                  </div>
                  <div>
                    <RenderPageContent page={spread.right.content} />
                    <div className="folio">Page {spread.right.pageNumber}</div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section className="sequence-view">
            {program.paddedPages.map((page, index) => (
              <div key={`${page.id}-${index}`}>
                <RenderPageContent page={page} />
                <div className="folio">Program Page {index + 1}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
