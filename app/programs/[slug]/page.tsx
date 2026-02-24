import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getProgramBySlug } from "@/lib/programs";
import { sanitizeRichText } from "@/lib/rich-text";
import { getSupabaseReadClient } from "@/lib/supabase";
import type { ProgramPage } from "@/lib/programs";

function RenderPageContent({ page }: { page: ProgramPage }) {
  if (page.type === "poster") {
    return (
        <article className="booklet-page poster-page">
        <img src={page.imageUrl} alt={page.title} className="poster-image" />
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
        <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(page.body) }} />
      </article>
    );
  }

  if (page.type === "image") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <img src={page.imageUrl} alt={page.title} className="full-page-image" />
      </article>
    );
  }

  if (page.type === "photo_grid") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <div className="photo-grid">
          {page.photos.map((photo, index) => (
            <img key={`${photo}-${index}`} src={photo} alt={`${page.title} ${index + 1}`} className="photo-grid-item" />
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
              {person.headshot_url ? <img src={person.headshot_url} alt={person.full_name} className="headshot" /> : null}
              <div>
                <div className="bio-name">{person.full_name}</div>
                <div className="bio-role">{person.role_title}</div>
                <div className="page-body rich-render bio-body" dangerouslySetInnerHTML={{ __html: sanitizeRichText(person.bio) }} />
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  if (page.type === "filler") {
    return (
      <article className="booklet-page blank-padding-page" aria-label="Blank padding page">
        <div className="blank-padding-label hide-print">Blank padding page</div>
      </article>
    );
  }

  return null;
}

export default async function ProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; export?: string }>;
}) {
  const { slug } = await params;
  const { view, export: exportMode } = await searchParams;
  const program = await getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const isBookletView = view === "booklet";
  const isExportMode = exportMode === "1";
  const totalRoster = program.castPeople.length + program.productionPeople.length;
  const submittedRoster = [...program.castPeople, ...program.productionPeople].filter(
    (person) => person.submission_status === "submitted"
  ).length;
  const client = getSupabaseReadClient();
  const { data: showRow } = await client.from("shows").select("id").eq("program_id", program.id).maybeSingle();
  const workspaceHref = showRow?.id ? `/app/shows/${showRow.id}` : null;

  return (
    <main className={isBookletView ? "print-booklet" : "print-proof"}>
      <div className={`container${isExportMode ? " export-mode" : ""}`}>
        {!isExportMode ? (
          <>
            <div className="hide-print top-actions" style={{ marginBottom: "1rem" }}>
              <Link href="/programs">All Programs</Link>
              {workspaceHref ? <Link href={`${workspaceHref}?tab=settings`}>Show Settings</Link> : null}
              {workspaceHref ? <Link href={`${workspaceHref}?tab=program-plan`}>Program Plan</Link> : null}
              <Link href={`/programs/${program.slug}/submit`}>Share Bio Submission Form</Link>
              <Link href={`/programs/${program.slug}`}>Program order view</Link>
              <Link href={`/programs/${program.slug}?view=booklet`}>Booklet imposition view</Link>
              <PrintButton />
            </div>

            <section className="card hide-print" style={{ marginBottom: "1rem" }}>
              <strong>Booklet Summary:</strong> {program.pageSequence.length} designed pages, padded to {program.paddedPages.length} for saddle-stitch (multiple of 4), {program.paddedPages.length / 4} sheets total.
              <br />
              <strong>Density used:</strong> {program.appliedDensityMode}
              {program.fillerModulesUsed.length > 0 ? (
                <>
                  <br />
                  <strong>Auto-filled with modules:</strong> {program.fillerModulesUsed.join(", ")}
                </>
              ) : null}
              {program.paddingNeeded > 0 ? (
                <>
                  <br />
                  <strong style={{ color: "#8f1f1f" }}>Warning:</strong> {program.paddingNeeded} blank padding page{program.paddingNeeded === 1 ? "" : "s"} required for booklet printing. Add/adjust modules to fill this.
                </>
              ) : null}
              {program.optimizationSteps.length > 0 ? (
                <>
                  <br />
                  <strong>Auto-fit steps:</strong> {program.optimizationSteps.join(" ")}
                </>
              ) : null}
              <br />
              <strong>Bio Submission Progress:</strong> {submittedRoster}/{totalRoster} submitted.
            </section>
          </>
        ) : null}

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
              <div key={`${page.id}-${index}`} className={`sequence-item${isExportMode ? " export-sequence-item" : ""}`}>
                <RenderPageContent page={page} />
                <div className="folio">{page.type === "filler" ? `Blank Padding Page (${index + 1})` : `Program Page ${index + 1}`}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
