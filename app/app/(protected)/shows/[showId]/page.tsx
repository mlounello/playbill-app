import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramPlanEditor } from "@/components/program-plan-editor";
import {
  archiveShow,
  deleteArchivedShow,
  getShowExports,
  getProgramTokensFromShowModules,
  getShowById,
  requestShowExport,
  restoreArchivedShow,
  setShowPublished,
  updateShowModules
} from "@/lib/shows";
import {
  addPeopleToShow,
  adminQuickStatus,
  adminReturnSubmission,
  bulkEditPeopleField,
  getShowSubmissionPeople
} from "@/lib/submissions";
import {
  getShowReminderSummary,
  sendShowInvites,
  sendShowRemindersNow,
  setShowDueDate
} from "@/lib/reminders";

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
  searchParams: Promise<{
    tab?: string;
    error?: string;
    success?: string;
    submissionFilter?: string;
    submissionQuery?: string;
    submissionSort?: string;
  }>;
}) {
  const { showId } = await params;
  const { tab, error, success, submissionFilter, submissionQuery, submissionSort } = await searchParams;
  const show = await getShowById(showId);
  const activeTab = tab || "overview";

  if (!show) {
    notFound();
  }

  const savePlanAction = updateShowModules.bind(null, show.id);
  const mappedTokens = getProgramTokensFromShowModules(show.modules);
  const people =
    activeTab === "overview" || activeTab === "people-roles" || activeTab === "submissions"
      ? await getShowSubmissionPeople(show.id)
      : [];
  const addPeopleAction = addPeopleToShow.bind(null, show.id);
  const bulkEditPeopleAction = bulkEditPeopleField.bind(null, show.id);
  const archiveShowAction = archiveShow.bind(null, show.id);
  const restoreShowAction = restoreArchivedShow.bind(null, show.id);
  const deleteShowAction = deleteArchivedShow.bind(null, show.id);
  const requestExportAction = requestShowExport.bind(null, show.id);
  const setPublishAction = setShowPublished.bind(null, show.id);
  const setDueDateAction = setShowDueDate.bind(null, show.id);
  const sendInvitesAction = sendShowInvites.bind(null, show.id);
  const sendRemindersAction = sendShowRemindersNow.bind(null, show.id);
  const deletePhrase = `DELETE ${show.slug}`;
  const exportRows = activeTab === "export" ? await getShowExports(show.id) : [];
  const publicUrl = show.slug ? `/p/${show.slug}` : "";
  const activeSubmissionFilter = submissionFilter || "all";
  const activeSubmissionQuery = (submissionQuery || "").trim().toLowerCase();
  const activeSubmissionSort = submissionSort || "name_asc";
  const filteredSubmissions =
    activeTab === "submissions"
      ? people
          .filter((person) => {
            if (activeSubmissionFilter === "all") return true;
            if (activeSubmissionFilter === "needs_review") return person.submission_status === "submitted";
            if (activeSubmissionFilter === "bio_missing") return person.bio_char_count === 0;
            if (activeSubmissionFilter === "headshot_missing") return !person.headshot_url.trim();
            if (activeSubmissionFilter === "over_limit") return person.bio_char_count > 375;
            return person.submission_status === activeSubmissionFilter;
          })
          .filter((person) => {
            if (!activeSubmissionQuery) {
              return true;
            }
            const haystack = `${person.full_name} ${person.role_title} ${person.email}`.toLowerCase();
            return haystack.includes(activeSubmissionQuery);
          })
          .sort((a, b) => {
            if (activeSubmissionSort === "name_desc") {
              return b.full_name.localeCompare(a.full_name);
            }
            if (activeSubmissionSort === "status") {
              return a.submission_status.localeCompare(b.submission_status) || a.full_name.localeCompare(b.full_name);
            }
            if (activeSubmissionSort === "recent") {
              const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
              const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
              return bTime - aTime || a.full_name.localeCompare(b.full_name);
            }
            return a.full_name.localeCompare(b.full_name);
          })
      : [];
  const blockers =
    activeTab === "overview"
      ? {
          missingBios: people.filter((person) => person.bio_char_count === 0).length,
          missingHeadshots: people.filter((person) => !person.headshot_url.trim()).length,
          returnedForEdits: people.filter((person) => person.submission_status === "returned").length,
          overLimit: people.filter((person) => person.bio_char_count > 375).length,
          needsReview: people.filter((person) => person.submission_status === "submitted").length
        }
      : {
          missingBios: 0,
          missingHeadshots: 0,
          returnedForEdits: 0,
          overLimit: 0,
          needsReview: 0
        };
  const reminderSummary = activeTab === "overview" ? await getShowReminderSummary(show.id) : { missing: 0, overdue: 0, dueSoon: 0 };
  const blockerItems = [
    {
      key: "bio_missing",
      label: `${blockers.missingBios} bios missing`,
      count: blockers.missingBios
    },
    {
      key: "headshot_missing",
      label: `${blockers.missingHeadshots} headshots missing`,
      count: blockers.missingHeadshots
    },
    {
      key: "returned",
      label: `${blockers.returnedForEdits} returned for edits`,
      count: blockers.returnedForEdits
    },
    {
      key: "needs_review",
      label: `${blockers.needsReview} pending review`,
      count: blockers.needsReview
    },
    {
      key: "over_limit",
      label: `${blockers.overLimit} over limit`,
      count: blockers.overLimit
    }
  ];
  const activeBlockers = blockerItems.filter((item) => item.count > 0);

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
            <section className="grid" style={{ gap: "0.75rem" }}>
              <article className="card grid">
                <div>Status: <span className="status-pill">{show.status}</span></div>
                <div>Submissions complete: {show.submission_submitted}/{show.submission_total}</div>
                <div>Outstanding submissions: {reminderSummary.missing}</div>
                <div>Overdue submissions: {reminderSummary.overdue}</div>
                <div>Due within 7 days: {reminderSummary.dueSoon}</div>
                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}/edit`}>Edit Program Data</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Preview</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition View</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}/submit`}>Contributor Form</Link> : null}
                </div>
                <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.2rem" }}>
                  <form action={setDueDateAction} style={{ display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap" }}>
                    <label>
                      Global bio due date
                      <input type="date" name="dueDate" required />
                    </label>
                    <button type="submit">Set Due Date</button>
                  </form>
                  <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                    <form action={sendInvitesAction}>
                      <button type="submit">Send Invites</button>
                    </form>
                    <form action={sendRemindersAction}>
                      <button type="submit">Send Reminders Now</button>
                    </form>
                  </div>
                </div>
              </article>

              <article className="card grid" style={{ borderColor: "#b12727" }}>
                <strong style={{ color: "#8f1f1f" }}>Big Red Blockers</strong>
                {activeBlockers.length === 0 ? (
                  <div style={{ color: "#055a47" }}>No blockers right now.</div>
                ) : (
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {activeBlockers.map((item) => (
                      <Link
                        key={item.key}
                        href={`/app/shows/${show.id}?tab=submissions&submissionFilter=${item.key}`}
                        style={{ color: item.count > 0 ? "#8f1f1f" : undefined, fontWeight: item.count > 0 ? 700 : 500 }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </article>

              <article className="card grid">
                <strong>Milestone 4 Tracker</strong>
                <div>1. Admin review panel: done</div>
                <div>2. Approve/return/lock workflow: done</div>
                <div>3. Audit history visibility: done</div>
                <div>4. Blockers + queue triage polish: done</div>
              </article>
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
                <p style={{ margin: 0, fontSize: "0.92rem" }}>
                  Paste either: <code>Name | Role | cast|production | email</code> per line, or a CSV/tabular paste with headers
                  <code> First Name, Last Name, Preferred Name, Pronouns, Project Role, Email</code>.
                </p>
                <form action={addPeopleAction} className="grid" style={{ gap: "0.55rem" }}>
                  <input type="hidden" name="mode" value="bulk" />
                  <textarea name="bulkLines" className="rich-textarea" placeholder={"Name | Role | cast | email@example.com"} />
                  <button type="submit">Import People</button>
                </form>
              </article>

              <article className="card grid">
                <strong>CSV Upload</strong>
                <p style={{ margin: 0, fontSize: "0.92rem" }}>
                  Supported headers: <code>First Name, Last Name, Preferred Name, Pronouns, Project Role, Email</code>
                </p>
                <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.85 }}>
                  Uses <code>Preferred Name</code> when available, maps <code>Project Role</code> to role title, and infers cast vs production.
                </p>
                <form action={addPeopleAction} className="grid" style={{ gap: "0.55rem" }}>
                  <input type="hidden" name="mode" value="csv" />
                  <input type="file" name="csvFile" accept=".csv,text/csv" required />
                  <button type="submit">Upload CSV</button>
                </form>
              </article>

              <article className="card grid">
                <strong>Bulk Edit One Field</strong>
                <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.9 }}>
                  Select one or more fields, then paste lines using <code>lookup | field=value | field=value</code>. Only selected fields are updated.
                </p>
                <form action={bulkEditPeopleAction} className="grid" style={{ gap: "0.55rem" }}>
                  <div className="grid" style={{ gap: "0.35rem" }}>
                    <strong style={{ fontSize: "0.95rem" }}>Fields to update</strong>
                    <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                      <input type="checkbox" name="targetFields" value="role_title" defaultChecked />
                      Role Title
                    </label>
                    <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                      <input type="checkbox" name="targetFields" value="team_type" />
                      Category (cast/production)
                    </label>
                    <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                      <input type="checkbox" name="targetFields" value="email" />
                      Email
                    </label>
                    <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                      <input type="checkbox" name="targetFields" value="full_name" />
                      Full Name
                    </label>
                  </div>
                  <label>
                    Lookup by
                    <select name="lookupField" defaultValue="email">
                      <option value="email">Email</option>
                      <option value="name">Full Name</option>
                    </select>
                  </label>
                  <label>
                    Edit lines
                    <textarea
                      name="editsText"
                      className="rich-textarea"
                      placeholder={
                        "lookup@example.com | role=Assistant Director | team_type=production\nanother@example.com | email=new@example.com\n\n(single selected field shortcut)\nlookup@example.com | New Value"
                      }
                      required
                    />
                  </label>
                  <button type="submit">Apply Bulk Edit</button>
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
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  {[
                    ["all", "All"],
                    ["pending", "Pending"],
                    ["needs_review", "Needs Review"],
                    ["bio_missing", "Bio Missing"],
                    ["headshot_missing", "Headshot Missing"],
                    ["over_limit", "Over Limit"],
                    ["returned", "Returned"],
                    ["approved", "Approved"],
                    ["locked", "Locked"]
                  ].map(([value, label]) => (
                    <Link
                      key={value}
                      href={`/app/shows/${show.id}?tab=submissions&submissionFilter=${value}&submissionSort=${activeSubmissionSort}&submissionQuery=${encodeURIComponent(activeSubmissionQuery)}`}
                      className="tab-chip"
                      style={activeSubmissionFilter === value ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
                <form method="get" className="grid" style={{ gap: "0.45rem" }}>
                  <input type="hidden" name="tab" value="submissions" />
                  <input type="hidden" name="submissionFilter" value={activeSubmissionFilter} />
                  <label>
                    Search
                    <input name="submissionQuery" defaultValue={activeSubmissionQuery} placeholder="Name, role, or email" />
                  </label>
                  <label>
                    Sort
                    <select name="submissionSort" defaultValue={activeSubmissionSort}>
                      <option value="name_asc">Name A-Z</option>
                      <option value="name_desc">Name Z-A</option>
                      <option value="status">Status</option>
                      <option value="recent">Most recently submitted</option>
                    </select>
                  </label>
                  <button type="submit">Apply</button>
                </form>
              </article>

              <article className="card grid">
                {filteredSubmissions.length === 0 ? (
                  <div>No submissions yet. Add people in People and Roles first.</div>
                ) : (
                  filteredSubmissions.map((person) => {
                    const approveAction = adminQuickStatus.bind(null, show.id, person.id, "approved");
                    const lockAction = adminQuickStatus.bind(null, show.id, person.id, "locked");
                    const returnAction = adminReturnSubmission.bind(null, show.id, person.id);
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
                          <form action={returnAction} style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
                            <input name="message" placeholder="Return message" required style={{ minWidth: "14rem" }} />
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

          {activeTab === "export" ? (
            <section className="grid" style={{ gap: "0.75rem" }}>
              <article className="card grid" style={{ gap: "0.6rem" }}>
                <strong>Generate Exports</strong>
                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                  <form action={requestExportAction}>
                    <input type="hidden" name="exportType" value="proof" />
                    <button type="submit">Generate Proof Export</button>
                  </form>
                  <form action={requestExportAction}>
                    <input type="hidden" name="exportType" value="print" />
                    <button type="submit">Generate Print Export</button>
                  </form>
                </div>
                <div style={{ fontSize: "0.88rem", opacity: 0.9 }}>
                  Print export assumes duplex short-edge booklet workflow and links to the imposition view.
                </div>
              </article>

              <article className="card grid" style={{ gap: "0.6rem" }}>
                <strong>Export History</strong>
                {exportRows.length === 0 ? (
                  <div>No exports yet.</div>
                ) : (
                  exportRows.map((row) => (
                    <div key={row.id} style={{ border: "1px solid #e5e5e5", borderRadius: "8px", padding: "0.55rem" }}>
                      <div>
                        <strong>{row.export_type}</strong> • <span className="status-pill">{row.status}</span>
                      </div>
                      <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                        Created: {new Date(row.created_at).toLocaleString("en-US")}
                        {row.completed_at ? ` • Completed: ${new Date(row.completed_at).toLocaleString("en-US")}` : ""}
                      </div>
                      {row.file_path ? <Link href={row.file_path}>Open Export</Link> : null}
                    </div>
                  ))
                )}
              </article>
            </section>
          ) : null}

          {activeTab === "publish" ? (
            <section className="grid" style={{ gap: "0.75rem" }}>
              <article className="card grid" style={{ gap: "0.6rem" }}>
                <strong>Public Program</strong>
                <div>
                  Publish status: <span className="status-pill">{show.is_published ? "published" : "unpublished"}</span>
                </div>
                <div style={{ fontSize: "0.88rem", opacity: 0.9 }}>
                  Show slug: <code>{show.slug}</code>
                  {show.program_slug ? (
                    <>
                      {" • "}Program slug: <code>{show.program_slug}</code>
                    </>
                  ) : null}
                </div>
                {show.published_at ? (
                  <div style={{ fontSize: "0.88rem", opacity: 0.85 }}>
                    Published at: {new Date(show.published_at).toLocaleString("en-US")}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                  <form action={setPublishAction}>
                    <input type="hidden" name="intent" value={show.is_published ? "unpublish" : "publish"} />
                    <button type="submit">{show.is_published ? "Unpublish" : "Publish"}</button>
                  </form>
                  {show.is_published ? <Link href={publicUrl}>Open Public URL</Link> : null}
                </div>
                <div style={{ fontSize: "0.88rem", opacity: 0.9 }}>
                  Public URL: <code>{publicUrl || "/p/{showSlug}"}</code>
                </div>
                {show.program_slug ? (
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <Link href={`/programs/${show.program_slug}`}>Program Preview</Link>
                    <Link href={`/p/${show.slug}`}>Public Page</Link>
                  </div>
                ) : null}
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

          {!["overview", "program-plan", "preview", "people-roles", "submissions", "export", "publish", "settings"].includes(activeTab) ? (
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
