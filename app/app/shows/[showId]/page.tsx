import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramWorkspaceById } from "@/lib/programs";

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
  const show = await getProgramWorkspaceById(showId);

  if (!show) {
    notFound();
  }

  return (
    <main>
      <div className="container grid" style={{ gridTemplateColumns: "240px 1fr", alignItems: "start" }}>
        <aside className="card grid" style={{ gap: "0.45rem", position: "sticky", top: "4.6rem" }}>
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
              <Link href={`/programs/${show.slug}/edit`}>Edit Program Data</Link>
              <Link href={`/programs/${show.slug}`}>Open Preview</Link>
              <Link href={`/programs/${show.slug}?view=booklet`}>Open Print Imposition View</Link>
              <Link href={`/programs/${show.slug}/submit`}>Contributor Form</Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
