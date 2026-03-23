"use client";

export function MagicLinkForm({ redirectTo }: { redirectTo: string }) {
  return (
    <section className="card stack-sm">
      <strong>Sign-In Link Required</strong>
      <p className="section-note">
        Public magic-link requests are disabled in Playbill. Use your emailed access link to continue to{" "}
        <code>{redirectTo}</code>.
      </p>
    </section>
  );
}
