import { notFound } from "next/navigation";
import { requestContributorFreshLink } from "@/lib/reminders";
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

export default async function ContributorFreshLinkPage({
  params,
  searchParams
}: {
  params: Promise<{ showId: string; taskId: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const { showId, taskId } = await params;
  const { success } = await searchParams;
  const summary = await getContributorTaskLoginSummary(showId, taskId);

  if (!summary) {
    notFound();
  }

  const requestAction = requestContributorFreshLink.bind(null, showId, taskId);

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>Request a Fresh Secure Link</h1>

        <section className="card stack-sm contributor-entry-hero">
          <div className="contributor-task-eyebrow">Submission Access</div>
          <h2 style={{ margin: 0 }}>{summary.person_name}</h2>
          <div className="meta-text">
            {summary.role_title} • {getSubmissionTypeLabel(summary.submission_type)}
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
            If your original Playbill task link has expired, enter the email address assigned to this submission and we&apos;ll
            send a fresh secure link if the request is still eligible.
          </p>
        </section>

        {success ? (
          <div className="card card-success">{decodeURIComponent(success)}</div>
        ) : null}

        <form action={requestAction} className="card stack-sm">
          <label>
            Assigned email
            <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />
          </label>
          <button type="submit">Send Fresh Secure Link</button>
          <p className="section-note">
            For security, we&apos;ll always show the same confirmation message whether or not the email matches this assignment.
          </p>
        </form>
      </div>
    </main>
  );
}
