import Link from "next/link";
import { FlashToast } from "@/components/flash-toast";
import { createShow } from "@/lib/shows";

export default async function AdminCreateShowPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <div className="hide-print top-actions">
          <Link href="/app/shows">Back to shows</Link>
        </div>

        <h1>Create Show</h1>
        <FlashToast message={error} tone="error" />

        <form action={createShow} className="form-grid card stack-sm">
          <label>
            Show title
            <input name="title" required placeholder="Rumors" />
          </label>

          <div className="form-row-2">
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
            Acts & Songs (optional)
            <textarea
              name="actsAndSongs"
              placeholder={"ACT I\n1. Opening Number\n2. ...\n\nACT II\n1. ..."}
            />
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
