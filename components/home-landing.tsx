import Image from "next/image";
import Link from "next/link";

export function HomeLanding() {
  return (
    <>
      <div className="container page-shell">
        <section className="banner home-hero">
          <div className="home-hero-copy">
            <h1>Build Your Next Playbill</h1>
            <p className="section-note">
              Build polished theatre programs from cast bios, director&apos;s notes, photos, and credits. Publish online and print beautifully.
            </p>
            <div className="top-actions">
              <Link className="button-link" href="/app/shows/new">
                Create a New Show
              </Link>
              <Link className="tab-chip" href="/app/shows">
                Open Admin Workspace
              </Link>
            </div>
          </div>
          <div className="home-hero-mark" aria-hidden="true">
            <Image
              src="/brand/playbill-app-square.png"
              alt=""
              width={1200}
              height={1200}
              priority
            />
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
    </>
  );
}
