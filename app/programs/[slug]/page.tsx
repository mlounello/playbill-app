import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getProgramBySlug } from "@/lib/programs";

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  return (
    <main>
      <div className="container">
        <div className="hide-print" style={{ display: "flex", gap: "0.8rem", marginBottom: "1rem" }}>
          <Link href="/">Home</Link>
          <Link href="/programs/new">Create another</Link>
          <PrintButton />
        </div>

        <section className="banner">
          <h1>{program.title}</h1>
          <p style={{ margin: "0 0 0.25rem" }}>{program.theatre_name}</p>
          <p style={{ margin: 0 }}>{program.show_dates}</p>
        </section>

        <section>
          <h2 className="section-title">Director&apos;s Note</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{program.director_notes}</p>
        </section>

        <section>
          <h2 className="section-title">Cast & Crew</h2>
          <div className="columns">
            {program.people.map((person) => (
              <article className="person-block" key={person.id}>
                <strong>{person.full_name}</strong>
                <div>{person.role_title}</div>
                <p>{person.bio}</p>
              </article>
            ))}
          </div>
        </section>

        {program.acknowledgements ? (
          <section>
            <h2 className="section-title">Acknowledgements</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{program.acknowledgements}</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
