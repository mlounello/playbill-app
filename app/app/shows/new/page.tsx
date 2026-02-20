import Link from "next/link";

export default function AdminCreateShowPage() {
  return (
    <main>
      <div className="container grid">
        <h1>Create Show</h1>
        <section className="card grid">
          <p style={{ margin: 0 }}>
            Wizard phases are planned. Use the current builder now, then reopen in workspace tabs.
          </p>
          <Link className="button-link" href="/programs/new">
            Open Current Builder
          </Link>
        </section>
      </div>
    </main>
  );
}
