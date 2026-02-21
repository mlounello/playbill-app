import Link from "next/link";
import { getCurrentUserWithProfile } from "@/lib/auth";

export default async function ContributorHomePage() {
  const current = await getCurrentUserWithProfile();

  return (
    <main>
      <div className="container grid" style={{ maxWidth: 760 }}>
        <h1>Contributor Portal</h1>
        {current ? (
          <section className="card">
            Signed in as <strong>{current.profile.email}</strong> ({current.profile.platform_role})
          </section>
        ) : null}
        <section className="card grid">
          <p style={{ margin: 0 }}>
            Contributor task dashboard and auth gating are next milestone. Use show-specific submission links for now.
          </p>
          <Link href="/programs">Find a program submission link</Link>
        </section>
        <form action="/auth/signout" method="post" className="hide-print">
          <button type="submit">Sign Out</button>
        </form>
      </div>
    </main>
  );
}
