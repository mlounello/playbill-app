import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashToast } from "@/components/flash-toast";
import { HeadshotUploadField } from "@/components/headshot-upload-field";
import { RichTextField } from "@/components/rich-text-field";
import { RestoreBioHistoryForm } from "@/components/restore-bio-history-form";
import {
  NO_BIO_PLACEHOLDER,
  SPECIAL_NOTE_WORD_LIMIT_DEFAULT,
  adminSaveSubmission,
  adminRestoreBioFromHistory,
  countWordsFromRichText,
  getShowSubmissionByPerson,
  getSubmissionTypeLabel
} from "@/lib/submissions";
import { richTextHasContent, sanitizeRichText } from "@/lib/rich-text";

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 240 ? `${text.slice(0, 240)}...` : text;
  } catch {
    return String(value);
  }
}

function formatAuditFieldLabel(field: string) {
  const map: Record<string, string> = {
    bio: "Submission Body",
    headshot_url: "Headshot URL",
    submission_status: "Status",
    no_bio: "No Bio Requested",
    director_notes: "Director's Note",
    dramaturgical_note: "Dramaturgical Note",
    music_director_note: "Music Director's Note",
    return_message: "Return Message"
  };
  return map[field] ?? field.replace(/_/g, " ");
}

function getStatusHint(status: string) {
  if (status === "pending") return "Next step: save draft or submit.";
  if (status === "draft") return "Next step: submit for review.";
  if (status === "submitted") return "Next step: approve, return, or lock.";
  if (status === "returned") return "Next step: contributor/admin edits then resubmit.";
  if (status === "approved") return "Next step: lock when finalized.";
  if (status === "locked") return "Locked submissions are read-only.";
  return "";
}

function formatTextDiff(before: unknown, after: unknown) {
  if (typeof before !== "string" || typeof after !== "string") {
    return null;
  }
  if (before === after) {
    return null;
  }

  let start = 0;
  const minLength = Math.min(before.length, after.length);
  while (start < minLength && before[start] === after[start]) {
    start += 1;
  }

  let beforeEnd = before.length - 1;
  let afterEnd = after.length - 1;
  while (beforeEnd >= start && afterEnd >= start && before[beforeEnd] === after[afterEnd]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  const beforeSlice = before.slice(Math.max(0, start - 24), beforeEnd + 1);
  const afterSlice = after.slice(Math.max(0, start - 24), afterEnd + 1);
  return {
    before: beforeSlice.length > 160 ? `${beforeSlice.slice(0, 160)}...` : beforeSlice,
    after: afterSlice.length > 160 ? `${afterSlice.slice(0, 160)}...` : afterSlice
  };
}

export default async function ShowSubmissionReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ showId: string; personId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; restored?: string }>;
}) {
  const { showId, personId } = await params;
  const { error, saved, restored } = await searchParams;
  const review = await getShowSubmissionByPerson(showId, personId);

  if (!review) {
    notFound();
  }

  const saveAction = adminSaveSubmission.bind(null, showId, personId);
  const restoreAction = adminRestoreBioFromHistory.bind(null, showId, personId);
  const submissionLabel = review.person.submission_label || getSubmissionTypeLabel(review.person.submission_type);
  const isBioTask = review.person.submission_type === "bio";
  const noteWordCount = countWordsFromRichText(review.person.bio);
  const hasNoBio =
    isBioTask &&
    (review.person.no_bio || review.person.bio.trim() === NO_BIO_PLACEHOLDER ||
      (!richTextHasContent(review.person.bio) && ["submitted", "approved", "locked"].includes(review.person.submission_status)));

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <div className="hide-print top-actions">
          <Link href={`/app/shows/${showId}?tab=submissions`}>Back to submissions</Link>
          <Link href={`/programs/${review.show.program_slug}`}>Open program preview</Link>
        </div>

        <h1>Submission Review</h1>
        <section className="card">
          <strong>{review.person.full_name}</strong> - {review.person.role_title} ({review.person.team_type})
          <div className="meta-text" style={{ marginTop: "0.35rem" }}>
            Status: <span className="status-pill">{review.person.submission_status}</span>
          </div>
          <div className="meta-text" style={{ marginTop: "0.35rem" }}>
            {isBioTask
              ? `${submissionLabel} chars: ${review.person.bio_char_count}/${review.person.bio_char_limit}`
              : `${submissionLabel} words: ${noteWordCount}/${SPECIAL_NOTE_WORD_LIMIT_DEFAULT}`}
          </div>
        </section>

        <FlashToast message={error} tone="error" />
        <FlashToast message={restored ? "Bio restored from history. No bio requested has been cleared." : saved ? "Review update saved." : undefined} tone="success" />

        <form action={saveAction} className="card stack-md">
          <RichTextField
            key={`${review.person.bio}:${review.person.no_bio}`}
            name="bio"
            label={`${submissionLabel} (admin editable)`}
            required={false}
            initialValue={hasNoBio ? "" : review.person.bio}
            previewTitle={isBioTask ? undefined : submissionLabel.replace(/\s+Submission$/i, "")}
            previewName={isBioTask ? review.person.full_name : undefined}
            previewRole={isBioTask ? review.person.role_title : undefined}
            counter={
              isBioTask
                ? { mode: "characters", limit: review.person.bio_char_limit }
                : { mode: "words", limit: SPECIAL_NOTE_WORD_LIMIT_DEFAULT }
            }
          />
          {isBioTask ? (
            <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <input type="checkbox" name="skipBio" defaultChecked={hasNoBio} />
              Mark as no bio requested.
            </label>
          ) : null}

          {isBioTask ? (
            <HeadshotUploadField
              showId={showId}
              personId={review.person.id}
              initialUrl={review.person.headshot_url}
            />
          ) : null}

          <label>
            Status
            <select name="status" defaultValue={review.person.submission_status}>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="returned">Returned</option>
              <option value="approved">Approved</option>
              <option value="locked">Locked</option>
            </select>
          </label>
          <div className="meta-text">{getStatusHint(review.person.submission_status)}</div>

          <label>
            Reason / reviewer note
            <input name="reason" placeholder="Optional audit reason" />
          </label>

          <button type="submit">Save Review</button>
        </form>

        <section className="card stack-sm">
          <strong>Recent History</strong>
          {isBioTask ? (
            <p className="section-note">Expand a bio version to read the complete text and restore it. Restoring records a new history entry and clears "no bio requested". Status and headshot stay the same.</p>
          ) : null}
          {isBioTask && review.person.submission_status === "locked" ? (
            <p className="section-note">This submission is locked. History is available to read; restoring is disabled.</p>
          ) : null}
          {review.history.length === 0 ? (
            <div>No audit records yet.</div>
          ) : (
            review.history.map((entry) => {
              const textDiff = formatTextDiff(entry.before_value, entry.after_value);
              return (
                <div key={entry.id} className="card card-soft">
                  <div>
                    <strong>{formatAuditFieldLabel(entry.field)}</strong> • {new Date(entry.changed_at).toLocaleString("en-US")}
                  </div>
                  <div style={{ fontSize: "0.88rem" }}>Reason: {entry.reason || "n/a"}</div>
                  <div style={{ fontSize: "0.82rem" }}>
                    Changed by: {entry.changed_by_email || entry.changed_by || "system"}
                  </div>
                  <div style={{ fontSize: "0.82rem", marginTop: "0.35rem", display: "grid", gap: "0.25rem" }}>
                    <div>
                      <strong>Before:</strong> {formatAuditValue(entry.before_value)}
                    </div>
                    <div>
                      <strong>After:</strong> {formatAuditValue(entry.after_value)}
                    </div>
                    {isBioTask && entry.field === "bio" ? (["before", "after"] as const).map((version) => {
                      const value = version === "before" ? entry.before_value : entry.after_value;
                      if (typeof value !== "string" || !richTextHasContent(value) || value.trim() === NO_BIO_PLACEHOLDER) return null;
                      const unchanged = value === review.person.bio && !review.person.no_bio;
                      return (
                        <details key={version} className="stack-sm">
                          <summary>View full {version === "before" ? "previous" : "saved"} bio</summary>
                          <div className="rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }} />
                          {unchanged ? <p className="meta-text">This is the current bio.</p> : review.person.submission_status !== "locked" ? (
                            <RestoreBioHistoryForm
                              action={restoreAction}
                              auditId={entry.id}
                              version={version}
                              expectedBio={review.person.bio}
                              expectedStatus={review.person.submission_status}
                              expectedNoBio={review.person.no_bio}
                            />
                          ) : null}
                        </details>
                      );
                    }) : null}
                    {textDiff ? (
                      <div>
                        <strong>Text change:</strong> <code>{textDiff.before} {"=>"} {textDiff.after}</code>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
