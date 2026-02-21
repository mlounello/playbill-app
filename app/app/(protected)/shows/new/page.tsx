import Link from "next/link";
import { createShow } from "@/lib/shows";

export default async function AdminCreateShowPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <div className="container grid" style={{ maxWidth: 760 }}>
        <div className="hide-print" style={{ display: "flex", gap: "0.8rem" }}>
          <Link href="/app/shows">Back to shows</Link>
        </div>

        <h1>Create Show</h1>
        {error ? (
          <div className="card" style={{ borderColor: "#b12727", color: "#8f1f1f" }}>
            {error}
          </div>
        ) : null}

        <form action={createShow} className="form-grid card">
          <label>
            Show title
            <input name="title" required placeholder="Rumors" />
          </label>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Start date
              <input name="startDate" type="date" />
            </label>
            <label>
              End date
              <input name="endDate" type="date" />
            </label>
          </div>

          <label>
            Venue
            <input name="venue" placeholder="J. Spencer and Patricia Standish Library Theatre" />
          </label>

          <label>
            Season tag
            <input name="seasonTag" placeholder="AY 2025-2026" />
          </label>

          <label>
            Slug (optional)
            <input name="slug" placeholder="rumors" />
          </label>

          <button type="submit">Create show workspace</button>
        </form>
      </div>
    </main>
  );
}
