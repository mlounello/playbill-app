"use client";

export function ContributorMagicLinkForm({
  redirectTo: _redirectTo,
  defaultEmail = ""
}: {
  redirectTo: string;
  defaultEmail?: string;
}) {
  return (
    <section className="card stack-sm auth-login-card contributor-entry-card">
      <h2 className="auth-login-title">Continue To Your Submission</h2>
      <p className="section-note">
        Contributors no longer request sign-in links from this page.
      </p>
      {defaultEmail ? <p className="section-note">Assigned email: <strong>{defaultEmail}</strong></p> : null}
      <p className="section-note">
        Use the one-click link from your invite or reminder email to open your task directly. If you need a new link, contact
        the production team.
      </p>
    </section>
  );
}
