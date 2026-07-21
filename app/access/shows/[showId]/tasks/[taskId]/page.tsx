import Link from "next/link";
import { notFound } from "next/navigation";
import { getContributorTaskLoginSummary, getSubmissionTypeLabel } from "@/lib/submissions";

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

export default async function ContributorAccessPage({
  params,
  searchParams
}: {
  params: Promise<{ showId: string; taskId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { showId, taskId } = await params;
  const { error, success } = await searchParams;
  const summary = await getContributorTaskLoginSummary(showId, taskId);

  if (!summary) {
    notFound();
  }

  const requestLinkHref = `/request-link/shows/${showId}/tasks/${taskId}`;
  const continueAction = `/access/shows/${showId}/tasks/${taskId}/continue`;

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>Ready to Open Your Submission?</h1>

        <section className="card stack-sm contributor-entry-hero">
          <div className="contributor-task-eyebrow">Submission Access</div>
          <h2 style={{ margin: 0 }}>{summary.person_name}</h2>
          <div className="meta-text">
            {summary.role_title} • {summary.submission_label || getSubmissionTypeLabel(summary.submission_type)}
          </div>
          <div className="meta-text">
            Show: <strong>{summary.show_title}</strong>
          </div>
          <div className="meta-text">
            Status: <span className="status-pill">{summary.submission_status}</span>
            {" • "}
            Due: {formatDueDate(summary.due_date)}
          </div>
          <p className="section-note">
            Playbill will send a fresh one-time secure link to the email address assigned to this submission.
          </p>
        </section>

        {error ? <div className="card card-error">{decodeURIComponent(error)}</div> : null}
        {success ? <div className="card card-success">{decodeURIComponent(success)}</div> : null}

        <form action={continueAction} method="post" className="card stack-sm">
          <button type="submit">Email My One-Time Link</button>
          <p className="section-note">
            For your protection, this page cannot sign anyone in directly. The link is sent only to the assigned email.
          </p>
        </form>

        <section className="card stack-sm">
          <strong>Need a fresh email link instead?</strong>
          <p className="section-note">
            If you would rather have a new access email sent to the address assigned to this submission, you can request one
            here.
          </p>
          <div className="top-actions">
            <Link href={requestLinkHref}>Request a fresh secure link</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
