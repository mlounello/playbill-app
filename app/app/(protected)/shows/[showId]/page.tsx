import Link from "next/link";
import { notFound } from "next/navigation";
import { getShowById } from "@/lib/shows";

const tabs = [
  "Overview",
  "Program Plan",
  "People and Roles",
  "Submissions",
  "Preview",
  "Export",
  "Publish",
  "Settings"
];

export default async function ShowWorkspacePage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const show = await getShowById(showId);

  if (!show) {
    notFound();
  }

  return (
    <main>
      <div className="container grid workspace-grid">
        <aside className="card grid workspace-sidebar" style={{ gap: "0.45rem" }}>
          {tabs.map((tab) => (
            <div key={tab} className="tab-chip">
              {tab}
            </div>
          ))}
        </aside>

        <section className="grid" style={{ gap: "1rem" }}>
          <h1 style={{ marginBottom: 0 }}>{show.title}</h1>
          <section className="card grid">
            <div>Status: <span className="status-pill">{show.status}</span></div>
            <div>Submissions complete: {show.submission_submitted}/{show.submission_total}</div>
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              {show.program_slug ? <Link href={`/programs/${show.program_slug}/edit`}>Edit Program Data</Link> : null}
              {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Preview</Link> : null}
              {show.program_slug ? <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition View</Link> : null}
              {show.program_slug ? <Link href={`/programs/${show.program_slug}/submit`}>Contributor Form</Link> : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
