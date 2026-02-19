import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramBySlug, submitBioForProgram } from "@/lib/programs";

export default async function BioSubmissionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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

        <form action={submitAction} className="form-grid card">
          <label>
            Full Name
            <input name="fullName" required />
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

          <label>
            Bio
            <textarea name="bio" required />
          </label>

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
