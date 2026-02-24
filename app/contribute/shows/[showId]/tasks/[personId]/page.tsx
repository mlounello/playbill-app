import Link from "next/link";
import { notFound } from "next/navigation";
import { HeadshotUploadField } from "@/components/headshot-upload-field";
import { RichTextField } from "@/components/rich-text-field";
import { BIO_CHAR_LIMIT_DEFAULT, NO_BIO_PLACEHOLDER, contributorSaveTask, getContributorTaskById, getSubmissionTypeLabel } from "@/lib/submissions";
import { richTextHasContent } from "@/lib/rich-text";

export default async function ContributorTaskPage({
  params,
  searchParams
}: {
  params: Promise<{ showId: string; personId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { showId, personId: taskId } = await params;
  const { error, saved } = await searchParams;
  const task = await getContributorTaskById(showId, taskId);
  if (!task) {
    notFound();
  }

  const saveAction = contributorSaveTask.bind(null, showId, taskId);
  const isReadOnly = task.person.submission_status === "approved" || task.person.submission_status === "locked";
  const submissionLabel = getSubmissionTypeLabel(task.person.submission_type);
  const isBioTask = task.person.submission_type === "bio";
  const hasNoBio =
    isBioTask &&
    (task.person.bio.trim() === NO_BIO_PLACEHOLDER ||
      (!richTextHasContent(task.person.bio) && ["submitted", "approved", "locked"].includes(task.person.submission_status)));

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <div className="hide-print top-actions">
          <Link href="/contribute">Back to tasks</Link>
          <Link href={`/programs/${task.program_slug}`}>Program Preview</Link>
        </div>

        <h1>{task.show_title}</h1>
        <section className="card">
          <strong>{task.person.full_name}</strong> - {task.person.role_title} ({task.person.team_type})
          <div className="meta-text" style={{ marginTop: "0.35rem" }}>
            Status: <span className="status-pill">{task.person.submission_status}</span>
          </div>
          <div className="meta-text" style={{ marginTop: "0.35rem" }}>
            {submissionLabel} limit: {BIO_CHAR_LIMIT_DEFAULT} chars. Current plain-text count: {task.person.bio_char_count}
          </div>
        </section>

        {error ? (
          <div className="card alert">
            {error}
          </div>
        ) : null}
        {saved ? <div className="card alert-success">Saved successfully.</div> : null}
        {task.person.submission_status === "returned" ? (
          <div className="card alert">
            <strong>Returned for edits.</strong>
            <div>
              {task.return_message?.reason
                ? task.return_message.reason
                : "A reviewer requested updates before approval."}
            </div>
          </div>
        ) : null}

        <form action={saveAction} className="card stack-md">
          <RichTextField
            name="bio"
            label={submissionLabel}
            required={false}
            initialValue={hasNoBio ? "" : task.person.bio}
            placeholder={isBioTask ? "Share your short bio." : `Share your ${submissionLabel.toLowerCase()}.`}
          />
          {isBioTask ? (
            <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <input type="checkbox" name="skipBio" defaultChecked={hasNoBio} disabled={isReadOnly} />
              I prefer not to include a bio.
            </label>
          ) : null}

          {isBioTask ? (
            <HeadshotUploadField
              showId={showId}
              personId={task.person.id}
              initialUrl={task.person.headshot_url}
              disabled={isReadOnly}
            />
          ) : null}

          {isReadOnly ? (
            <p className="section-note">This task is read-only because it has been {task.person.submission_status}.</p>
          ) : (
            <div className="top-actions">
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
