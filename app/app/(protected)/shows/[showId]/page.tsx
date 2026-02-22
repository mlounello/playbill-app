import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramPlanEditor } from "@/components/program-plan-editor";
import {
  archiveShow,
  deleteArchivedShow,
  getProgramTokensFromShowModules,
  getShowById,
  restoreArchivedShow,
  updateShowModules
} from "@/lib/shows";
import { addPeopleToShow, adminQuickStatus, getShowSubmissionPeople } from "@/lib/submissions";

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
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
}) {
  const { showId } = await params;
  const { tab, error, success } = await searchParams;
  const show = await getShowById(showId);
  const activeTab = tab || "overview";

  if (!show) {
    notFound();
  }

  const savePlanAction = updateShowModules.bind(null, show.id);
  const mappedTokens = getProgramTokensFromShowModules(show.modules);
  const people = activeTab === "people-roles" || activeTab === "submissions" ? await getShowSubmissionPeople(show.id) : [];
  const addPeopleAction = addPeopleToShow.bind(null, show.id);
  const archiveShowAction = archiveShow.bind(null, show.id);
  const restoreShowAction = restoreArchivedShow.bind(null, show.id);
  const deleteShowAction = deleteArchivedShow.bind(null, show.id);
  const deletePhrase = `DELETE ${show.slug}`;

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
          {success ? (
            <div className="card" style={{ borderColor: "#006b54", color: "#055a47" }}>
              {success}
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

          {activeTab === "people-roles" ? (
            <section className="grid" style={{ gap: "0.75rem" }}>
              <article className="card grid">
                <strong>Add Person</strong>
                <form action={addPeopleAction} className="grid" style={{ gap: "0.55rem" }}>
                  <input type="hidden" name="mode" value="manual" />
                  <label>
                    Full name
                    <input name="fullName" required placeholder="First Last" />
                  </label>
                  <label>
                    Role title
                    <input name="roleTitle" required placeholder="Stage Manager" />
                  </label>
                  <label>
                    Category
                    <select name="teamType" defaultValue="production">
                      <option value="cast">Cast</option>
                      <option value="production">Production</option>
                    </select>
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" required placeholder="name@example.com" />
                  </label>
                  <button type="submit">Add Person</button>
                </form>
              </article>

              <article className="card grid">
                <strong>Bulk Import</strong>
                <p style={{ margin: 0, fontSize: "0.92rem" }}>Format each line: <code>Name | Role | cast|production | email</code></p>
                <form action={addPeopleAction} className="grid" style={{ gap: "0.55rem" }}>
                  <input type="hidden" name="mode" value="bulk" />
                  <textarea name="bulkLines" className="rich-textarea" placeholder={"Name | Role | cast | email@example.com"} />
                  <button type="submit">Import People</button>
                </form>
              </article>

              <article className="card grid">
                <strong>Current People ({people.length})</strong>
                {people.length === 0 ? (
                  <div>No people yet.</div>
                ) : (
                  <div className="grid" style={{ gap: "0.45rem" }}>
                    {people.map((person, index) => (
                      <div key={person.id}>
                        {index + 1}. {person.full_name} - {person.role_title} ({person.team_type}) • {person.email}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>
          ) : null}

          {activeTab === "submissions" ? (
            <section className="grid" style={{ gap: "0.75rem" }}>
              <article className="card grid">
                <strong>Submission Tasks</strong>
                <div>
                  {people.filter((person) => person.submission_status === "submitted" || person.submission_status === "approved" || person.submission_status === "locked").length}
                  /{people.length} submitted or better
                </div>
              </article>

              <article className="card grid">
                {people.length === 0 ? (
                  <div>No submissions yet. Add people in People and Roles first.</div>
                ) : (
                  people.map((person) => {
                    const approveAction = adminQuickStatus.bind(null, show.id, person.id, "approved");
                    const returnAction = adminQuickStatus.bind(null, show.id, person.id, "returned");
                    const lockAction = adminQuickStatus.bind(null, show.id, person.id, "locked");
                    return (
                      <div
                        key={person.id}
                        style={{
                          border: "1px solid #e5e5e5",
                          borderRadius: "10px",
                          padding: "0.75rem",
                          display: "grid",
                          gap: "0.5rem"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                          <div>
                            <strong>{person.full_name}</strong> - {person.role_title}
                            <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                              {person.team_type} • {person.email}
                            </div>
                          </div>
                          <div>
                            Status: <span className="status-pill">{person.submission_status}</span> • {person.bio_char_count} chars
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                          <Link href={`/app/shows/${show.id}/submissions/${person.id}`}>Open Review</Link>
                          <form action={approveAction}>
                            <button type="submit">Approve</button>
                          </form>
                          <form action={returnAction}>
                            <button type="submit">Return</button>
                          </form>
                          <form action={lockAction}>
                            <button type="submit">Lock</button>
                          </form>
                        </div>
                      </div>
                    );
                  })
                )}
              </article>
            </section>
          ) : null}

          {activeTab === "settings" ? (
            <section className="grid" style={{ gap: "0.75rem" }}>
              <article className="card grid" style={{ gap: "0.6rem" }}>
                <strong>Lifecycle Controls</strong>
                <div>
                  Current status: <span className="status-pill">{show.status}</span>
                </div>
                {show.status !== "archived" ? (
                  <form action={archiveShowAction} className="grid" style={{ gap: "0.5rem" }}>
                    <p style={{ margin: 0 }}>
                      Archive this show first to disable active editing and unlock permanent deletion controls.
                    </p>
                    <button type="submit">Archive Show</button>
                  </form>
                ) : (
                  <form action={restoreShowAction} className="grid" style={{ gap: "0.5rem" }}>
                    <p style={{ margin: 0 }}>
                      This show is archived. You can restore it to draft if deletion was accidental.
                    </p>
                    <button type="submit">Restore to Draft</button>
                  </form>
                )}
              </article>

              <article className="card grid" style={{ gap: "0.6rem", borderColor: "#b12727" }}>
                <strong style={{ color: "#8f1f1f" }}>Danger Zone: Permanent Delete</strong>
                <p style={{ margin: 0 }}>
                  Deletion is permanent and removes the show, linked program data, people, roles, and submissions.
                </p>
                <p style={{ margin: 0 }}>
                  Required phrase: <code>{deletePhrase}</code>
                </p>
                <form action={deleteShowAction} className="grid" style={{ gap: "0.5rem" }}>
                  <label>
                    Type confirmation phrase
                    <input
                      name="confirmation"
                      placeholder={deletePhrase}
                      required
                      disabled={show.status !== "archived"}
                    />
                  </label>
                  <button type="submit" disabled={show.status !== "archived"}>
                    Delete Permanently
                  </button>
                </form>
                {show.status !== "archived" ? (
                  <div style={{ fontSize: "0.88rem", color: "#8f1f1f" }}>
                    Archive is required before deletion.
                  </div>
                ) : null}
              </article>
            </section>
          ) : null}

          {!["overview", "program-plan", "preview", "people-roles", "submissions", "settings"].includes(activeTab) ? (
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
