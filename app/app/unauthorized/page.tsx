import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>Unauthorized</h1>
        <section className="card stack-sm">
          <p className="section-note">Your account does not have access to this area yet.</p>
          <Link href="/contribute">Open Contributor Portal</Link>
          <Link href="/">Go Home</Link>
        </section>
      </div>
    </main>
  );
}
