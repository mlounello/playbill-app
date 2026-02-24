import Link from "next/link";
import { FlashToast } from "@/components/flash-toast";
import { getShowsForDashboard } from "@/lib/shows";

export default async function AdminShowsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const shows = await getShowsForDashboard();

  return (
    <main>
      <div className="container page-shell">
        <div className="title-row">
          <h1>Show Workspaces</h1>
          <div className="top-actions">
            <Link href="/app/roles">Role Library</Link>
            <Link href="/app/seasons">Season Builder</Link>
            <Link href="/app/producing-profiles">Producing Profiles</Link>
            <Link className="button-link" href="/app/shows/new">
              Create Show
            </Link>
          </div>
        </div>

        <FlashToast message={error} tone="error" />
        <FlashToast message={success} tone="success" />

        {shows.length === 0 ? (
          <section className="card">No shows yet.</section>
        ) : (
          <section className="program-grid">
            {shows.map((show) => (
              <article key={show.id} className="card stack-sm">
                <strong>{show.title}</strong>
                <div>
                  {show.start_date ?? "TBD"}
                  {show.end_date ? ` to ${show.end_date}` : ""}
                  {show.venue ? ` • ${show.venue}` : ""}
                </div>
                <div>
                  Status: <span className="status-pill">{show.status}</span>
                  {" • "}
                  Visibility: <span className="status-pill">{show.is_published ? "published" : "private"}</span>
                  {" • "}
                  Submissions: {show.submission_submitted}/{show.submission_total}
                </div>
                <div className="meta-text">
                  Show slug: <code>{show.slug}</code>
                  {show.program_slug ? (
                    <>
                      {" • "}Program slug: <code>{show.program_slug}</code>
                    </>
                  ) : null}
                </div>
                <div className="link-row">
                  <Link href={`/app/shows/${show.id}`}>Open Workspace</Link>
                  <Link href={`/app/shows/${show.id}?tab=settings`}>Show Settings</Link>
                  <Link href={`/app/shows/${show.id}?tab=program-plan`}>Program Plan</Link>
                  <Link href={`/app/shows/${show.id}?tab=publish`}>Publish Settings</Link>
                  <Link href={`/p/${show.slug}`}>Public Page</Link>
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Program</Link> : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
