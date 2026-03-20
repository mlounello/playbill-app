import Link from "next/link";
import { notFound } from "next/navigation";
import { RichTextField } from "@/components/rich-text-field";
import { getProgramBySlug, submitBioForProgram } from "@/lib/programs";

export default async function BioSubmissionPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { slug } = await params;
  const { error, success } = await searchParams;
  const program = await getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const submitAction = submitBioForProgram.bind(null, slug);

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <div className="hide-print top-actions">
          <Link href="/">Home</Link>
        </div>

        <h1>Legacy Bio Submission Form</h1>
        <p>
          This generic form is a legacy fallback for bio-only submissions. The primary contributor experience uses
          personalized magic-link task pages.
        </p>
        <p>
          Submissions are automatically sorted alphabetically in the playbill by group (cast or production team).
        </p>
        {error ? (
          <div className="card alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="card alert-success">
            {success}
          </div>
        ) : null}

        <form action={submitAction} className="form-grid card">
          <label>
            Select Yourself
            <select name="personId" required defaultValue="">
              <option value="" disabled>
                Choose your name
              </option>
              {program.castPeople.map((person) => (
                <option key={`cast-${person.id}`} value={person.id}>
                  {person.full_name} - {person.role_title} (Cast)
                </option>
              ))}
              {program.productionPeople.map((person) => (
                <option key={`prod-${person.id}`} value={person.id}>
                  {person.full_name} - {person.role_title} (Production)
                </option>
              ))}
            </select>
          </label>

          <label>
            Email (must match roster)
            <input name="email" type="email" required placeholder="you@example.com" />
          </label>

          <RichTextField name="bio" label="Bio" required />

          <label>
            Headshot URL (optional)
            <input name="headshotUrl" placeholder="https://..." />
          </label>

          <button type="submit">Submit Bio</button>
        </form>
      </div>
    </main>
  );
}
