import Link from "next/link";

export default function Home() {
  return (
    <main>
      <div className="container grid" style={{ gap: "2rem" }}>
        <section className="banner">
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: "0.4rem" }}>Playbill Builder</h1>
          <p style={{ margin: 0, maxWidth: "60ch" }}>
            Build polished theatre programs from cast bios, director&apos;s notes, photos, and credits. Publish online and print beautifully.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <Link className="button-link" href="/programs/new">
              Create a New Program
            </Link>
          </div>
        </section>

        <section className="card">
          <h2>What this MVP does</h2>
          <ul>
            <li>Capture title, theatre info, dates, director&apos;s notes, and acknowledgements.</li>
            <li>Add cast and crew bios in a fast line-based format.</li>
            <li>Generate a public URL and print-ready layout.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
