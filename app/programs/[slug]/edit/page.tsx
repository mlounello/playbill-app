import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProgramBySlug } from "@/lib/programs";
import { APP_SCHEMA, getSupabaseReadClient } from "@/lib/supabase";

export default async function LegacyEditProgramPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) {
    notFound();
  }

  const supabase = getSupabaseReadClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data: showRow } = await db
    .from("shows")
    .select("id")
    .eq("program_id", program.id)
    .maybeSingle();

  if (showRow?.id) {
    redirect(`/app/shows/${showRow.id}?tab=settings&success=${encodeURIComponent("Program editing moved to Show Workspace.")}`);
  }

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>Program Editing Moved</h1>
        <div className="card stack-sm">
          <div>This program is not linked to a show workspace yet.</div>
          <Link href={`/programs/${slug}`}>Back to Program Preview</Link>
          <Link href="/app/shows">Open Show Workspaces</Link>
        </div>
      </div>
    </main>
  );
}
