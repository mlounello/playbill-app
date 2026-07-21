import Link from "next/link";

export default function BioSubmissionPage() {
  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <div className="hide-print top-actions">
          <Link href="/">Home</Link>
        </div>

        <h1>Submission Link Retired</h1>
        <section className="card stack-sm">
          <p>
            This generic roster form has been retired. It no longer lists people or accepts submissions.
          </p>
          <p>
            Contributors should use the private, one-time link sent to the email address assigned to their Playbill task.
          </p>
          <p>If you need a new link, contact the production team.</p>
        </section>
      </div>
    </main>
  );
}
