import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramPlanEditor } from "@/components/program-plan-editor";
import { getProgramTokensFromShowModules, getShowById, updateShowModules } from "@/lib/shows";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "program-plan", label: "Program Plan" },
  { id: "people-roles", label: "People and Roles" },
  { id: "submissions", label: "Submissions" },
  { id: "preview", label: "Preview" },
  { id: "export", label: "Export" },
  { id: "publish", label: "Publish" },
  { id: "settings", label: "Settings" }
];

export default async function ShowWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ showId: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { showId } = await params;
  const { tab, error } = await searchParams;
  const show = await getShowById(showId);
  const activeTab = tab || "overview";

  if (!show) {
    notFound();
  }

  const savePlanAction = updateShowModules.bind(null, show.id);
  const mappedTokens = getProgramTokensFromShowModules(show.modules);

  return (
    <main>
      <div className="container grid workspace-grid">
        <aside className="card grid workspace-sidebar" style={{ gap: "0.45rem" }}>
          {tabs.map((item) => (
            <Link
              key={item.id}
              href={`/app/shows/${show.id}?tab=${item.id}`}
              className="tab-chip"
              style={activeTab === item.id ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
            >
              {item.label}
            </Link>
          ))}
        </aside>

        <section className="grid" style={{ gap: "1rem" }}>
          <h1 style={{ marginBottom: 0 }}>{show.title}</h1>
          {error ? (
            <div className="card" style={{ borderColor: "#b12727", color: "#8f1f1f" }}>
              {error}
            </div>
          ) : null}

          {activeTab === "overview" ? (
            <section className="card grid">
              <div>Status: <span className="status-pill">{show.status}</span></div>
              <div>Submissions complete: {show.submission_submitted}/{show.submission_total}</div>
              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                {show.program_slug ? <Link href={`/programs/${show.program_slug}/edit`}>Edit Program Data</Link> : null}
                {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Preview</Link> : null}
                {show.program_slug ? <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition View</Link> : null}
                {show.program_slug ? <Link href={`/programs/${show.program_slug}/submit`}>Contributor Form</Link> : null}
              </div>
            </section>
          ) : null}

          {activeTab === "program-plan" ? (
            <section className="grid" style={{ gap: "0.75rem" }}>
              <div className="card">
                Configure module order, visibility, and behavior. This saves to `program_modules`.
              </div>
              <ProgramPlanEditor modules={show.modules} onSubmitAction={savePlanAction} />
            </section>
          ) : null}

          {activeTab === "preview" ? (
            <section className="grid" style={{ gap: "0.75rem" }}>
              <article className="card grid">
                <strong>Program Plan to Preview Mapping</strong>
                <div>
                  Active preview token order:{" "}
                  {mappedTokens.length > 0 ? (
                    <code>{mappedTokens.join(" -> ")}</code>
                  ) : (
                    "No mapped tokens. Enable visible modules in Program Plan."
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Reader Preview</Link> : null}
                  {show.program_slug ? (
                    <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition Preview</Link>
                  ) : null}
                </div>
              </article>

              <article className="card grid">
                <strong>Module Sequence</strong>
                {show.modules.map((module, index) => (
                  <div key={module.id}>
                    {index + 1}. {module.display_title || module.module_type}{" "}
                    {module.visible ? "" : "(hidden)"} {module.filler_eligible ? "• filler eligible" : ""}
                  </div>
                ))}
              </article>
            </section>
          ) : null}

          {!["overview", "program-plan", "preview"].includes(activeTab) ? (
            <section className="card">
              <strong>{tabs.find((item) => item.id === activeTab)?.label ?? "Tab"}</strong>
              <div style={{ marginTop: "0.5rem" }}>This tab is queued for the next milestone implementation.</div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
