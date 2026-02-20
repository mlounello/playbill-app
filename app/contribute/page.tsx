import Link from "next/link";

export default function ContributorHomePage() {
  return (
    <main>
      <div className="container grid" style={{ maxWidth: 760 }}>
        <h1>Contributor Portal</h1>
        <section className="card grid">
          <p style={{ margin: 0 }}>
            Contributor task dashboard and auth gating are next milestone. Use show-specific submission links for now.
          </p>
          <Link href="/programs">Find a program submission link</Link>
        </section>
      </div>
    </main>
  );
}
