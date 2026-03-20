import Link from "next/link";
import { notFound } from "next/navigation";
import { HeadshotUploadField } from "@/components/headshot-upload-field";
import { RichTextField } from "@/components/rich-text-field";
import {
  BIO_CHAR_LIMIT_DEFAULT,
  NO_BIO_PLACEHOLDER,
  SPECIAL_NOTE_WORD_LIMIT_DEFAULT,
  contributorSaveTask,
  countWordsFromRichText,
  getContributorTaskById,
  getSubmissionTypeLabel
} from "@/lib/submissions";
import { richTextHasContent } from "@/lib/rich-text";

function formatDueDate(value: string | null) {
  if (!value) {
    return "No due date set";
  }
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getContributorStatusHint(status: string) {
  if (status === "pending") return "This task has not been started yet.";
  if (status === "draft") return "Your draft is saved. Submit when you are ready for review.";
  if (status === "submitted") return "Your submission is with the production team for review.";
  if (status === "returned") return "A reviewer requested updates before approval.";
  if (status === "approved") return "This submission has been approved and is currently read-only.";
  if (status === "locked") return "This submission is finalized and locked.";
  return "";
}

function getContributorInstructions(submissionType: string) {
  if (submissionType === "bio") {
    return [
      "Write in third person if possible.",
      `Keep your bio concise. The print program target is ${BIO_CHAR_LIMIT_DEFAULT} characters.`,
      "You can save a draft first and come back later.",
      "If you do not want a bio included, check the no-bio option below."
    ];
  }

  return [
    "Use this page for your full note draft.",
    `The target length is ${SPECIAL_NOTE_WORD_LIMIT_DEFAULT} words.`,
    "You can format your note using the editor toolbar.",
    "Save a draft if you want to return later, or submit when it is ready for review."
  ];
}

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
  const noteWordCount = countWordsFromRichText(task.person.bio);
  const currentCountLabel = isBioTask
    ? `${task.person.bio_char_count} / ${BIO_CHAR_LIMIT_DEFAULT} characters`
    : `${noteWordCount} / ${SPECIAL_NOTE_WORD_LIMIT_DEFAULT} words`;
  const hasNoBio =
    isBioTask &&
    (task.person.bio.trim() === NO_BIO_PLACEHOLDER ||
      (!richTextHasContent(task.person.bio) && ["submitted", "approved", "locked"].includes(task.person.submission_status)));
  const instructions = getContributorInstructions(task.person.submission_type);

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <div className="hide-print top-actions">
          <Link href="/contribute">Back to tasks</Link>
          <Link href={`/p/${task.show_slug}`}>Program Preview</Link>
        </div>

        <section className="card stack-sm contributor-task-hero">
          <div className="contributor-task-eyebrow">Contributor Task</div>
          <h1 style={{ margin: 0 }}>{task.show_title}</h1>
          <div className="contributor-task-title-row">
            <div>
              <strong>{submissionLabel}</strong> for <strong>{task.person.full_name}</strong>
            </div>
            <span className="status-pill">{task.person.submission_status}</span>
          </div>
          <div className="meta-text">
            Role: {task.person.role_title} ({task.person.team_type})
          </div>
          <div className="meta-text">{getContributorStatusHint(task.person.submission_status)}</div>
        </section>

        <section className="stat-grid">
          <article className="stat-item">
            <div className="stat-label">Due</div>
            <div className="stat-value">{formatDueDate(task.due_date)}</div>
          </article>
          <article className="stat-item">
            <div className="stat-label">Current Length</div>
            <div className="stat-value">{currentCountLabel}</div>
          </article>
          <article className="stat-item">
            <div className="stat-label">Program Preview</div>
            <div className="stat-value">
              <Link href={`/p/${task.show_slug}`}>Open Program</Link>
            </div>
          </article>
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

        <section className="card contributor-task-layout">
          <article className="card card-soft stack-sm contributor-task-guide">
            <strong>What To Do</strong>
            <p className="section-note">
              Complete this {submissionLabel.toLowerCase()} here. Everything you need for this request is on this page.
            </p>
            <ul className="contributor-task-list">
              {instructions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="card card-soft stack-sm contributor-task-guide">
            <strong>Before You Submit</strong>
            <div className="meta-text">Current status: <span className="status-pill">{task.person.submission_status}</span></div>
            <div className="meta-text">Due: {formatDueDate(task.due_date)}</div>
            <div className="meta-text">Length target: {currentCountLabel}</div>
            <p className="section-note">
              Save Draft keeps your work here without sending it for approval. Submit for Review sends it to the production team.
            </p>
          </article>
        </section>

        <form action={saveAction} className="card stack-md">
          <div className="stack-sm">
            <strong>Edit Your {submissionLabel}</strong>
            <p className="section-note">
              Use the editor below, then save a draft or submit when you are ready.
            </p>
          </div>
          <RichTextField
            name="bio"
            label={submissionLabel}
            required={false}
            initialValue={hasNoBio ? "" : task.person.bio}
            placeholder={isBioTask ? "Share your short bio." : `Share your ${submissionLabel.toLowerCase()}.`}
          />
          {isBioTask ? (
            <label className="checkbox-inline">
              <input type="checkbox" name="skipBio" defaultChecked={hasNoBio} disabled={isReadOnly} />
              <span>I prefer not to include a bio.</span>
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
