import Link from "next/link";
import { getProgramsList } from "@/lib/programs";

export default async function ProgramsIndexPage() {
  const programs = await getProgramsList();

  return (
    <main>
      <div className="container grid">
        <h1>Programs</h1>
        <div className="hide-print">
          <Link className="button-link" href="/programs/new">
            Create New Program
          </Link>
        </div>

        {programs.length === 0 ? (
          <section className="card">No programs yet.</section>
        ) : (
          <section className="grid" style={{ gap: "0.75rem" }}>
            {programs.map((program) => (
              <article key={program.id} className="card" style={{ display: "grid", gap: "0.5rem" }}>
                <strong>{program.title}</strong>
                <div>{program.show_dates}</div>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <Link href={`/programs/${program.slug}`}>Open</Link>
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
