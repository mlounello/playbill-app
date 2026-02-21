import Link from "next/link";
import { getShowsForDashboard } from "@/lib/shows";

export default async function AdminShowsPage() {
  const shows = await getShowsForDashboard();

  return (
    <main>
      <div className="container grid">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <h1 style={{ marginBottom: 0 }}>Programs</h1>
          <Link className="button-link" href="/app/shows/new">
            Create Show
          </Link>
        </div>

        {shows.length === 0 ? (
          <section className="card">No shows yet.</section>
        ) : (
          <section className="grid" style={{ gap: "0.75rem" }}>
            {shows.map((show) => (
              <article key={show.id} className="card" style={{ display: "grid", gap: "0.4rem" }}>
                <strong>{show.title}</strong>
                <div>
                  {show.start_date ?? "TBD"}
                  {show.end_date ? ` to ${show.end_date}` : ""}
                  {show.venue ? ` • ${show.venue}` : ""}
                </div>
                <div>
                  Status: <span className="status-pill">{show.status}</span> • Submissions: {show.submission_submitted}/{show.submission_total}
                </div>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <Link href={`/app/shows/${show.id}`}>Open Workspace</Link>
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Program</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}/edit`}>Edit Program Data</Link> : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
