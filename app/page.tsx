import Link from "next/link";

export default function Home() {
  return (
    <main>
      <div className="container page-shell">
        <section className="banner">
          <h1>Playbill Builder</h1>
          <p className="section-note">
            Build polished theatre programs from cast bios, director&apos;s notes, photos, and credits. Publish online and print beautifully.
          </p>
          <div className="top-actions">
            <Link className="button-link" href="/programs/new">
              Create a New Program
            </Link>
            <Link className="tab-chip" href="/app/shows">
              Open Admin Workspace
            </Link>
          </div>
        </section>

        <section className="card stack-sm">
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
