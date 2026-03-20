import Link from "next/link";
import { redirect } from "next/navigation";
import { ContributorMagicLinkForm } from "@/components/auth/contributor-magic-link-form";
import { LoginOptionsForm } from "@/components/auth/login-options-form";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { getContributorTaskLoginSummary, getSubmissionTypeLabel } from "@/lib/submissions";

function sanitizeNextPath(rawNext: string | undefined) {
  const next = String(rawNext ?? "").trim();
  if (!next.startsWith("/")) {
    return "";
  }
  if (next.startsWith("//")) {
    return "";
  }
  return next;
}

function matchContributorTaskPath(pathname: string) {
  const match = pathname.match(/^\/contribute\/shows\/([^/]+)\/tasks\/([^/?#]+)/);
  if (!match) {
    return null;
  }
  return { showId: match[1], taskId: match[2] };
}

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

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; code?: string; token_hash?: string; type?: string; next?: string; mode?: string }>;
}) {
  const { error, success, code, token_hash, type, next, mode } = await searchParams;
  const nextPath = sanitizeNextPath(next);
  const contributorPath = nextPath ? matchContributorTaskPath(nextPath) : null;
  const isContributorEntry = Boolean(contributorPath) && mode !== "full";

  if (code || (token_hash && type)) {
    const callbackTarget = new URLSearchParams();
    if (code) {
      callbackTarget.set("code", code);
    }
    if (token_hash && type) {
      callbackTarget.set("token_hash", token_hash);
      callbackTarget.set("type", type);
    }
    if (nextPath) {
      callbackTarget.set("next", nextPath);
    }
    redirect(`/auth/callback?${callbackTarget.toString()}`);
  }

  const current = await getCurrentUserWithProfile();

  if (current) {
    if (nextPath) {
      redirect(nextPath);
    }
    if (current.profile.platform_role === "contributor") {
      redirect("/contribute");
    }
    redirect("/app/shows");
  }

  const contributorTask =
    contributorPath ? await getContributorTaskLoginSummary(contributorPath.showId, contributorPath.taskId) : null;

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>{isContributorEntry ? "Your Submission" : "Login"}</h1>
        {error ? <div className="card card-error">{decodeURIComponent(error)}</div> : null}
        {success ? <div className="card card-success">{decodeURIComponent(success)}</div> : null}
        {isContributorEntry && contributorTask ? (
          <>
            <section className="card stack-sm contributor-entry-hero">
              <div className="contributor-task-eyebrow">Welcome</div>
              <h2 style={{ margin: 0 }}>{contributorTask.person_name}</h2>
              <div className="meta-text">
                {contributorTask.role_title} • {getSubmissionTypeLabel(contributorTask.submission_type)}
              </div>
              <div className="meta-text">
                Show: <strong>{contributorTask.show_title}</strong>
              </div>
              <div className="meta-text">
                Status: <span className="status-pill">{contributorTask.submission_status}</span>
                {" • "}
                Due: {formatDueDate(contributorTask.due_date)}
              </div>
              <p className="section-note">
                Enter the email associated with this submission and we&apos;ll send you a secure sign-in link that brings
                you directly to your task.
              </p>
            </section>
            <ContributorMagicLinkForm redirectTo={nextPath || "/contribute"} defaultEmail={contributorTask.email} />
            <div className="top-actions">
              <Link href={`/login?mode=full${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""}`}>Staff or admin sign in</Link>
              {contributorTask.show_is_published ? <Link href={`/p/${contributorTask.show_slug}`}>Preview Program</Link> : null}
            </div>
          </>
        ) : (
          <>
            <LoginOptionsForm redirectTo={nextPath || "/app/shows"} />
            <div className="top-actions">
              <Link href="/">Back Home</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
