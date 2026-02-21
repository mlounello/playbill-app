import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main>
      <div className="container grid" style={{ maxWidth: 680 }}>
        <h1>Unauthorized</h1>
        <section className="card grid">
          <p style={{ margin: 0 }}>Your account does not have access to this area yet.</p>
          <Link href="/contribute">Open Contributor Portal</Link>
          <Link href="/">Go Home</Link>
        </section>
      </div>
    </main>
  );
}
