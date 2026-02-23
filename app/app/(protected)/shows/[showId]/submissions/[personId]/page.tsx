import Link from "next/link";
import { notFound } from "next/navigation";
import { HeadshotUploadField } from "@/components/headshot-upload-field";
import { RichTextField } from "@/components/rich-text-field";
import { BIO_CHAR_LIMIT_DEFAULT, adminSaveSubmission, getShowSubmissionByPerson } from "@/lib/submissions";

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
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { showId, personId } = await params;
  const { error, saved } = await searchParams;
  const review = await getShowSubmissionByPerson(showId, personId);

  if (!review) {
    notFound();
  }

  const saveAction = adminSaveSubmission.bind(null, showId, personId);

  return (
    <main>
      <div className="container grid" style={{ maxWidth: 900 }}>
        <div className="hide-print" style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <Link href={`/app/shows/${showId}?tab=submissions`}>Back to submissions</Link>
          <Link href={`/programs/${review.show.program_slug}`}>Open program preview</Link>
        </div>

        <h1 style={{ marginBottom: 0 }}>Submission Review</h1>
        <section className="card">
          <strong>{review.person.full_name}</strong> - {review.person.role_title} ({review.person.team_type})
          <div style={{ marginTop: "0.35rem" }}>
            Status: <span className="status-pill">{review.person.submission_status}</span>
          </div>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "0.35rem" }}>
            Bio chars: {review.person.bio_char_count}/{BIO_CHAR_LIMIT_DEFAULT}
          </div>
        </section>

        {error ? (
          <div className="card" style={{ borderColor: "#b12727", color: "#8f1f1f" }}>
            {error}
          </div>
        ) : null}
        {saved ? <div className="card" style={{ borderColor: "#006b54" }}>Review update saved.</div> : null}

        <form action={saveAction} className="card grid" style={{ gap: "0.8rem" }}>
          <RichTextField name="bio" label="Bio (admin editable)" required initialValue={review.person.bio} />

          <HeadshotUploadField
            showId={showId}
            personId={personId}
            initialUrl={review.person.headshot_url}
          />

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

          <label>
            Reason / reviewer note
            <input name="reason" placeholder="Optional audit reason" />
          </label>

          <button type="submit">Save Review</button>
        </form>

        <section className="card grid" style={{ gap: "0.5rem" }}>
          <strong>Recent History</strong>
          {review.history.length === 0 ? (
            <div>No audit records yet.</div>
          ) : (
            review.history.map((entry) => {
              const textDiff = formatTextDiff(entry.before_value, entry.after_value);
              return (
                <div key={entry.id} style={{ border: "1px solid #e5e5e5", borderRadius: "8px", padding: "0.6rem" }}>
                  <div>
                    <strong>{entry.field}</strong> • {new Date(entry.changed_at).toLocaleString("en-US")}
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
