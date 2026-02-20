import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <main>
      <div className="container grid" style={{ maxWidth: 680 }}>
        <h1>Admin Login</h1>
        <section className="card grid">
          <p style={{ margin: 0 }}>Magic link auth wiring is the next milestone. For now, use existing admin routes.</p>
          <label>
            Email
            <input type="email" placeholder="name@siena.edu" />
          </label>
          <button type="button">Send Magic Link (Coming Next)</button>
          <Link href="/app/shows">Go to Shows</Link>
        </section>
      </div>
    </main>
  );
}
