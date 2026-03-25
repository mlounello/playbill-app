import Link from "next/link";
import { notFound } from "next/navigation";
import { RichTextField } from "@/components/rich-text-field";
import { BIO_CHAR_LIMIT_DEFAULT } from "@/lib/submissions";
import { getProgramBySlug, submitBioForProgram } from "@/lib/programs";
import { richTextHasContent } from "@/lib/rich-text";

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

  const eligibleCastPeople = program.castPeople.filter(
    (person) => person.submission_status === "pending" && !richTextHasContent(person.bio)
  );
  const eligibleProductionPeople = program.productionPeople.filter(
    (person) => person.submission_status === "pending" && !richTextHasContent(person.bio)
  );
  const hasEligiblePeople = eligibleCastPeople.length > 0 || eligibleProductionPeople.length > 0;

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
            <select name="personId" required defaultValue="" disabled={!hasEligiblePeople}>
              <option value="" disabled>
                {hasEligiblePeople ? "Choose your name" : "No pending bios available"}
              </option>
              {eligibleCastPeople.map((person) => (
                <option key={`cast-${person.id}`} value={person.id}>
                  {person.full_name} - {person.role_title} (Cast)
                </option>
              ))}
              {eligibleProductionPeople.map((person) => (
                <option key={`prod-${person.id}`} value={person.id}>
                  {person.full_name} - {person.role_title} (Production)
                </option>
              ))}
            </select>
          </label>

          <label>
            Email (must match roster)
            <input name="email" type="email" required placeholder="you@example.com" disabled={!hasEligiblePeople} />
          </label>

          <RichTextField
            name="bio"
            label="Bio"
            required
            counter={{ mode: "characters", limit: BIO_CHAR_LIMIT_DEFAULT }}
          />

          <label>
            Headshot URL (optional)
            <input name="headshotUrl" placeholder="https://..." disabled={!hasEligiblePeople} />
          </label>

          {!hasEligiblePeople ? (
            <div className="section-note">Everyone on this roster already has a submitted or in-progress bio.</div>
          ) : null}

          <button type="submit" disabled={!hasEligiblePeople}>Submit Bio</button>
        </form>
      </div>
    </main>
  );
}
