import Link from "next/link";
import { notFound } from "next/navigation";
import { RichTextField } from "@/components/rich-text-field";
import { BIO_CHAR_LIMIT_DEFAULT, contributorSaveTask, getContributorTaskById } from "@/lib/submissions";

export default async function ContributorTaskPage({
  params,
  searchParams
}: {
  params: Promise<{ showId: string; personId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { showId, personId } = await params;
  const { error, saved } = await searchParams;
  const task = await getContributorTaskById(showId, personId);
  if (!task) {
    notFound();
  }

  const saveAction = contributorSaveTask.bind(null, showId, personId);
  const isReadOnly = task.person.submission_status === "approved" || task.person.submission_status === "locked";

  return (
    <main>
      <div className="container grid" style={{ maxWidth: 820 }}>
        <div className="hide-print" style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <Link href="/contribute">Back to tasks</Link>
          <Link href={`/programs/${task.program_slug}`}>Program Preview</Link>
        </div>

        <h1 style={{ marginBottom: 0 }}>{task.show_title}</h1>
        <section className="card">
          <strong>{task.person.full_name}</strong> - {task.person.role_title} ({task.person.team_type})
          <div style={{ marginTop: "0.35rem" }}>
            Status: <span className="status-pill">{task.person.submission_status}</span>
          </div>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "0.35rem" }}>
            Bio limit: {BIO_CHAR_LIMIT_DEFAULT} chars. Current plain-text count: {task.person.bio_char_count}
          </div>
        </section>

        {error ? (
          <div className="card" style={{ borderColor: "#b12727", color: "#8f1f1f" }}>
            {error}
          </div>
        ) : null}
        {saved ? <div className="card" style={{ borderColor: "#006b54" }}>Saved successfully.</div> : null}

        <form action={saveAction} className="card grid" style={{ gap: "0.8rem" }}>
          <RichTextField
            name="bio"
            label="Bio"
            required={!isReadOnly}
            initialValue={task.person.bio}
            placeholder="Share your short bio."
          />

          <label>
            Headshot URL
            <input
              name="headshotUrl"
              defaultValue={task.person.headshot_url}
              placeholder="https://..."
              readOnly={isReadOnly}
            />
          </label>

          {isReadOnly ? (
            <p style={{ margin: 0 }}>This task is read-only because it has been {task.person.submission_status}.</p>
          ) : (
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <button type="submit" name="intent" value="save">
                Save Draft
              </button>
              <button type="submit" name="intent" value="submit">
                Submit for Review
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
