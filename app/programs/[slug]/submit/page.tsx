import Link from "next/link";
import { notFound } from "next/navigation";
import { RichTextField } from "@/components/rich-text-field";
import { getProgramBySlug, submitBioForProgram } from "@/lib/programs";

export default async function BioSubmissionPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const program = await getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const submitAction = submitBioForProgram.bind(null, slug);

  return (
    <main>
      <div className="container grid">
        <div className="hide-print" style={{ display: "flex", gap: "0.8rem" }}>
          <Link href={`/programs/${slug}`}>Back to program</Link>
          <Link href="/">Home</Link>
        </div>

        <h1>Bio Submission Form</h1>
        <p>
          Submissions are automatically sorted alphabetically in the playbill by group (cast or production team).
        </p>
        {error ? (
          <div className="card" style={{ borderColor: "#b12727", color: "#8f1f1f" }}>
            {error}
          </div>
        ) : null}

        <form action={submitAction} className="form-grid card">
          <label>
            Full Name
            <input name="fullName" required list="known-names" />
          </label>

          <label>
            Role
            <input name="roleTitle" required placeholder="Actor, Director, Stage Manager..." />
          </label>

          <label>
            Group
            <select name="teamType" defaultValue="cast">
              <option value="cast">Cast</option>
              <option value="production">Production Team</option>
            </select>
          </label>

          <RichTextField name="bio" label="Bio" required />

          <label>
            Headshot URL (optional)
            <input name="headshotUrl" placeholder="https://..." />
          </label>

          <button type="submit">Submit Bio</button>
        </form>
        <datalist id="known-names">
          {program.castPeople.map((person) => (
            <option key={`cast-${person.id}`} value={person.full_name} />
          ))}
          {program.productionPeople.map((person) => (
            <option key={`prod-${person.id}`} value={person.full_name} />
          ))}
        </datalist>
      </div>
    </main>
  );
}
