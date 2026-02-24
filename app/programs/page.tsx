import Link from "next/link";
import { getProgramsList } from "@/lib/programs";

export const dynamic = "force-dynamic";

export default async function ProgramsIndexPage() {
  const programs = await getProgramsList();

  return (
    <main>
      <div className="container page-shell">
        <div className="title-row">
          <h1>Programs</h1>
          <Link className="button-link" href="/app/shows/new">
            Create New Show
          </Link>
        </div>

        {programs.length === 0 ? (
          <section className="card">No programs yet.</section>
        ) : (
          <section className="program-grid">
            {programs.map((program) => (
              <article key={program.id} className="card stack-sm">
                <strong>{program.title}</strong>
                <div>{program.show_dates}</div>
                <div className="meta-text">
                  Program slug: <code>{program.slug}</code>
                </div>
                <div className="link-row">
                  <Link href={`/programs/${program.slug}`}>Open</Link>
                  <Link href={`/p/${program.slug}`}>Public View</Link>
                  <Link href={`/programs/${program.slug}/edit`}>Edit</Link>
                  <Link href={`/programs/${program.slug}/submit`}>Submission Form</Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
