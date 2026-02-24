import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashToast } from "@/components/flash-toast";
import { PeopleBulkEditor } from "@/components/people-bulk-editor";
import { ProgramPlanEditor } from "@/components/program-plan-editor";
import { SubmissionFilterPresets } from "@/components/submission-filter-presets";
import { SubmissionViewToggle } from "@/components/submission-view-toggle";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { getProgramBySlug } from "@/lib/programs";
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
  bulkEditSelectedPeople,
  importBiosFromCsv,
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
    submissionView?: string;
    paddingSim?: string;
  }>;
}) {
  const { showId } = await params;
  const { tab, error, success, submissionFilter, submissionQuery, submissionSort, submissionView, paddingSim } = await searchParams;
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
  const bulkEditSelectedPeopleAction = bulkEditSelectedPeople.bind(null, show.id);
  const importBiosAction = importBiosFromCsv.bind(null, show.id);
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
  const activeSubmissionView = submissionView === "cards" ? "cards" : "table";
  const submissionViewProvided = typeof submissionView === "string";
  const filteredSubmissions =
    activeTab === "submissions"
      ? people
          .filter((person) => {
            if (activeSubmissionFilter === "all") return true;
            if (activeSubmissionFilter === "needs_review") return person.submission_status === "submitted";
            if (activeSubmissionFilter === "bio_missing") return person.bio_char_count === 0 && !person.no_bio;
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
          missingBios: people.filter((person) => person.bio_char_count === 0 && !person.no_bio).length,
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
  const paddingSimIds =
    activeTab === "program-plan"
      ? (paddingSim ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const paddingPlanProgram =
    activeTab === "program-plan" && show.program_slug
      ? await getProgramBySlug(show.program_slug, { forceVisibleModuleIds: paddingSimIds })
      : null;
  const fillerCandidates =
    activeTab === "program-plan"
      ? show.modules
          .filter((module) => !module.visible && module.filler_eligible)
          .map((module) => ({
            id: module.id,
            label: module.display_title || module.module_type
          }))
      : [];
  const makePaddingSimHref = (ids: string[]) => {
    const params = new URLSearchParams();
    params.set("tab", "program-plan");
    if (ids.length > 0) {
      params.set("paddingSim", ids.join(","));
    }
    return `/app/shows/${show.id}?${params.toString()}`;
  };
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
        <aside className="card workspace-sidebar">
          <WorkspaceTabs tabs={tabs} showId={show.id} activeTab={activeTab} />
        </aside>

        <section className="page-shell">
          <h1>{show.title}</h1>
          <FlashToast message={error} tone="error" />
          <FlashToast message={success} tone="success" />

          {activeTab === "overview" ? (
            <section className="workspace-pane">
              <div className="pane-header">
                <strong>Overview</strong>
                <div className="kpi-inline">
                  <span className="kpi-badge">{show.submission_submitted}/{show.submission_total} submitted</span>
                  <span className="kpi-badge">{reminderSummary.missing} outstanding</span>
                </div>
              </div>
              <article className="card stack-sm submissions-filter">
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-label">Status</div>
                    <div className="stat-value"><span className="status-pill">{show.status}</span></div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Submissions Complete</div>
                    <div className="stat-value">{show.submission_submitted}/{show.submission_total}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Outstanding</div>
                    <div className="stat-value">{reminderSummary.missing}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Overdue</div>
                    <div className="stat-value">{reminderSummary.overdue}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Due in 7 days</div>
                    <div className="stat-value">{reminderSummary.dueSoon}</div>
                  </div>
                </div>
                <div className="link-row">
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}/edit`}>Edit Program Data</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Preview</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition View</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}/submit`}>Contributor Form</Link> : null}
                </div>
                <div className="stack-sm">
                  <form action={setDueDateAction} className="top-actions">
                    <label>
                      Global bio due date
                      <input type="date" name="dueDate" required />
                    </label>
                    <button type="submit">Set Due Date</button>
                  </form>
                  <div className="top-actions">
                    <form action={sendInvitesAction}>
                      <button type="submit">Send Invites</button>
                    </form>
                    <form action={sendRemindersAction}>
                      <button type="submit">Send Reminders Now</button>
                    </form>
                  </div>
                </div>
              </article>

              <article className="card stack-sm alert">
                <strong className="danger-title">Big Red Blockers</strong>
                {activeBlockers.length === 0 ? (
                  <div className="meta-text">No blockers right now.</div>
                ) : (
                  <div className="blocker-list">
                    {activeBlockers.map((item) => (
                      <Link
                        key={item.key}
                        href={`/app/shows/${show.id}?tab=submissions&submissionFilter=${item.key}`}
                        className="danger-title"
                        style={{ fontWeight: item.count > 0 ? 700 : 500 }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </article>

              <article className="card stack-sm">
                <strong>Milestone 4 Tracker</strong>
                <div>1. Admin review panel: done</div>
                <div>2. Approve/return/lock workflow: done</div>
                <div>3. Audit history visibility: done</div>
                <div>4. Blockers + queue triage polish: done</div>
              </article>
            </section>
          ) : null}

          {activeTab === "program-plan" ? (
            <section className="panel-grid">
              <div className="card">
                Configure module order, visibility, and behavior. This saves to `program_modules`.
              </div>
              <article className="card stack-sm">
                <strong>Padding Plan</strong>
                {paddingPlanProgram ? (
                  <>
                    <div>
                      Designed pages: <strong>{paddingPlanProgram.pageSequence.length}</strong>
                    </div>
                    <div>
                      Booklet pages (multiple of 4): <strong>{paddingPlanProgram.paddedPages.length}</strong>
                    </div>
                    <div>
                      Blank pages required:{" "}
                      <strong style={{ color: paddingPlanProgram.paddingNeeded > 0 ? "#8f1f1f" : undefined }}>
                        {paddingPlanProgram.paddingNeeded}
                      </strong>
                    </div>
                    <div>
                      Density used by optimizer: <strong>{paddingPlanProgram.appliedDensityMode}</strong>
                    </div>
                    <div>
                      Hidden filler candidates: <strong>{fillerCandidates.length}</strong>
                    </div>
                    <div>
                      Hidden filler used:{" "}
                      <strong>
                        {paddingPlanProgram.fillerModulesUsed.length > 0
                          ? paddingPlanProgram.fillerModulesUsed.join(", ")
                          : "None"}
                      </strong>
                    </div>
                    <div>
                      Optimizer steps:{" "}
                      <strong>
                        {paddingPlanProgram.optimizationSteps.length > 0
                          ? paddingPlanProgram.optimizationSteps.join(" ")
                          : "No optimization needed."}
                      </strong>
                    </div>
                    {fillerCandidates.length > 0 ? (
                      <div className="stack-sm">
                        <div className="meta-text">Simulate enabling hidden filler modules (without saving):</div>
                        <div className="chip-row">
                          {fillerCandidates.map((candidate) => {
                            const isActive = paddingSimIds.includes(candidate.id);
                            const nextIds = isActive
                              ? paddingSimIds.filter((id) => id !== candidate.id)
                              : [...paddingSimIds, candidate.id];
                            return (
                              <Link
                                key={candidate.id}
                                href={makePaddingSimHref(nextIds)}
                                className="tab-chip"
                                style={{
                                  fontWeight: isActive ? 700 : 500,
                                  background: isActive ? "#e8f4ef" : undefined,
                                  borderColor: isActive ? "#89b8a8" : undefined
                                }}
                              >
                                {isActive ? "Remove" : "Try"} {candidate.label}
                              </Link>
                            );
                          })}
                          {paddingSimIds.length > 0 ? (
                            <Link href={makePaddingSimHref([])} className="tab-chip">
                              Clear Simulation
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="meta-text">
                        No hidden filler-eligible modules available. Mark optional modules as hidden + filler eligible to give the optimizer options.
                      </div>
                    )}
                    <div className="meta-text">
                      Preview this in action:{" "}
                      <Link href={`/programs/${show.program_slug}?view=booklet`}>Open booklet preview</Link>
                    </div>
                  </>
                ) : (
                  <div className="meta-text">
                    Padding plan appears once this show is linked to a program.
                  </div>
                )}
              </article>
              <ProgramPlanEditor modules={show.modules} onSubmitAction={savePlanAction} />
            </section>
          ) : null}

          {activeTab === "preview" ? (
            <section className="panel-grid">
              <article className="card stack-sm">
                <strong>Program Plan to Preview Mapping</strong>
                <div>
                  Active preview token order:{" "}
                  {mappedTokens.length > 0 ? (
                    <code>{mappedTokens.join(" -> ")}</code>
                  ) : (
                    "No mapped tokens. Enable visible modules in Program Plan."
                  )}
                </div>
                <div className="link-row">
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Reader Preview</Link> : null}
                  {show.program_slug ? (
                    <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition Preview</Link>
                  ) : null}
                </div>
              </article>

              <article className="card stack-sm">
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
            <section className="panel-grid">
              <div className="people-forms-grid">
                <article className="card stack-sm">
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
                  <p className="section-note">
                    Paste either: <code>Name | Role | cast|production | email</code> per line, or a CSV/tabular paste with headers
                    <code> First Name, Last Name, Preferred Name, Pronouns, Project Role, Email</code>.
                  </p>
                  <form action={addPeopleAction} className="stack-sm">
                    <input type="hidden" name="mode" value="bulk" />
                    <textarea name="bulkLines" className="rich-textarea" placeholder={"Name | Role | cast | email@example.com"} />
                    <button type="submit">Import People</button>
                  </form>
                </article>

                <article className="card stack-sm">
                  <strong>CSV Upload</strong>
                  <p className="section-note">
                    Supported headers: <code>First Name, Last Name, Preferred Name, Pronouns, Project Role, Email</code>
                  </p>
                  <p className="section-note">
                    Uses <code>Preferred Name</code> when available, maps <code>Project Role</code> to role title, and infers cast vs production.
                  </p>
                  <form action={addPeopleAction} className="stack-sm">
                    <input type="hidden" name="mode" value="csv" />
                    <input type="file" name="csvFile" accept=".csv,text/csv" required />
                    <button type="submit">Upload CSV</button>
                  </form>
                </article>

                <article className="card stack-sm">
                  <strong>Bulk Edit by Lookup</strong>
                  <p className="section-note">
                    Select one or more fields, then paste lines using <code>lookup | field=value | field=value</code>. Only selected fields are updated.
                  </p>
                  <form action={bulkEditPeopleAction} className="stack-sm">
                    <div className="stack-sm">
                      <strong>Fields to update</strong>
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
              </div>

              <PeopleBulkEditor
                people={people.map((person) => ({
                  id: person.id,
                  full_name: person.full_name,
                  role_title: person.role_title,
                  team_type: person.team_type,
                  email: person.email
                }))}
                onSubmitAction={bulkEditSelectedPeopleAction}
              />
            </section>
          ) : null}

          {activeTab === "submissions" ? (
            <section className="workspace-pane">
              <div className="pane-header">
                <strong>Submissions</strong>
                <div className="kpi-inline">
                  <span className="kpi-badge">
                    {people.filter((person) => person.submission_status === "submitted" || person.submission_status === "approved" || person.submission_status === "locked").length}
                    /{people.length} complete
                  </span>
                </div>
              </div>
              <article className="card stack-sm">
                <strong>Filter Queue</strong>
                <details>
                  <summary>Import Bios from CSV</summary>
                  <p className="section-note">
                    Expected headers: <code>Email Address</code>, <code>Name (As you want listed in the program)</code>,{" "}
                    <code>Production Character or Role</code>, <code>Bio</code>.
                  </p>
                  <p className="section-note">Matching uses Email Address first, then Name + Role fallback.</p>
                  <form action={importBiosAction} className="top-actions" data-pending-label="Importing bios...">
                    <input type="file" name="bioCsvFile" accept=".csv,text/csv" required />
                    <button type="submit">Import Bios CSV</button>
                  </form>
                </details>
                <div className="chip-row">
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
                      href={`/app/shows/${show.id}?tab=submissions&submissionFilter=${value}&submissionSort=${activeSubmissionSort}&submissionQuery=${encodeURIComponent(activeSubmissionQuery)}&submissionView=${activeSubmissionView}`}
                      className="tab-chip"
                      style={activeSubmissionFilter === value ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
                <form method="get" className="form-row-2">
                  <input type="hidden" name="tab" value="submissions" />
                  <input type="hidden" name="submissionFilter" value={activeSubmissionFilter} />
                  <input type="hidden" name="submissionView" value={activeSubmissionView} />
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
                <SubmissionViewToggle
                  showId={show.id}
                  filter={activeSubmissionFilter}
                  sort={activeSubmissionSort}
                  query={activeSubmissionQuery}
                  activeView={activeSubmissionView}
                  submissionViewProvided={submissionViewProvided}
                />
                <SubmissionFilterPresets
                  filter={activeSubmissionFilter}
                  sort={activeSubmissionSort}
                  query={activeSubmissionQuery}
                  view={activeSubmissionView}
                />
              </article>

              <article className="card stack-sm">
                {filteredSubmissions.length === 0 ? (
                  <div>No submissions yet. Add people in People and Roles first.</div>
                ) : (
                  activeSubmissionView === "table" ? (
                    <div className="table-frame">
                      <table className="simple-table">
                        <caption className="sr-only">Submission review queue</caption>
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Role</th>
                            <th scope="col">Category</th>
                            <th scope="col">Status</th>
                            <th scope="col">Chars</th>
                            <th scope="col">Updated</th>
                            <th scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubmissions.map((person) => {
                            const approveAction = adminQuickStatus.bind(null, show.id, person.id, "approved");
                            const lockAction = adminQuickStatus.bind(null, show.id, person.id, "locked");
                            const returnAction = adminReturnSubmission.bind(null, show.id, person.id);
                            return (
                              <tr key={person.id}>
                                <td>
                                  <strong>{person.full_name}</strong>
                                  <div className="meta-text">{person.email}</div>
                                </td>
                                <td>{person.role_title}</td>
                                <td style={{ textTransform: "capitalize" }}>{person.team_type}</td>
                                <td><span className="status-pill">{person.submission_status}</span></td>
                                <td>{person.bio_char_count}</td>
                                <td>{person.submitted_at ? new Date(person.submitted_at).toLocaleDateString("en-US") : "No submission yet"}</td>
                                <td>
                                  <div className="submission-actions">
                                    <Link href={`/app/shows/${show.id}/submissions/${person.id}`}>Review</Link>
                                    <form action={approveAction}>
                                      <button type="submit">Approve</button>
                                    </form>
                                    <form action={lockAction}>
                                      <button type="submit">Lock</button>
                                    </form>
                                    <form action={returnAction} className="inline-form">
                                      <input name="message" placeholder="Return note" required />
                                      <button type="submit">Return</button>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="submissions-grid">
                      {filteredSubmissions.map((person) => {
                        const approveAction = adminQuickStatus.bind(null, show.id, person.id, "approved");
                        const lockAction = adminQuickStatus.bind(null, show.id, person.id, "locked");
                        const returnAction = adminReturnSubmission.bind(null, show.id, person.id);
                        return (
                          <div key={person.id} className="submission-row">
                            <div className="submission-row-top">
                              <div className="submission-identity">
                                <strong>{person.full_name}</strong> - {person.role_title}
                                <div className="submission-meta">
                                  {person.team_type} • {person.email}
                                </div>
                              </div>
                              <div className="submission-meta">
                                Status: <span className="status-pill">{person.submission_status}</span> • {person.bio_char_count} chars
                              </div>
                              <div className="submission-meta">
                                Updated: {person.submitted_at ? new Date(person.submitted_at).toLocaleDateString("en-US") : "No submission yet"}
                              </div>
                            </div>
                            <div className="submission-actions">
                              <Link href={`/app/shows/${show.id}/submissions/${person.id}`}>Open Review</Link>
                              <form action={approveAction}>
                                <button type="submit">Approve</button>
                              </form>
                              <form action={returnAction} className="inline-form">
                                <input name="message" placeholder="Return message" required />
                                <button type="submit">Return</button>
                              </form>
                              <form action={lockAction}>
                                <button type="submit">Lock</button>
                              </form>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </article>
            </section>
          ) : null}

          {activeTab === "export" ? (
            <section className="workspace-pane">
              <div className="pane-header">
                <strong>Export</strong>
              </div>
              <div className="export-cards">
              <article className="card stack-sm">
                <strong>Generate Exports</strong>
                <div className="top-actions">
                  <form action={requestExportAction}>
                    <input type="hidden" name="exportType" value="proof" />
                    <button type="submit">Generate Proof Export</button>
                  </form>
                  <form action={requestExportAction}>
                    <input type="hidden" name="exportType" value="print" />
                    <button type="submit">Generate Print Export</button>
                  </form>
                </div>
                <div className="meta-text">
                  Print export assumes duplex short-edge booklet workflow and links to the imposition view.
                </div>
              </article>

              <article className="card stack-sm">
                <strong>Export History</strong>
                {exportRows.length === 0 ? (
                  <div>No exports yet.</div>
                ) : (
                  exportRows.map((row) => (
                    <div key={row.id} className="card card-soft">
                      <div>
                        <strong>{row.export_type}</strong> • <span className="status-pill">{row.status}</span>
                      </div>
                      <div className="meta-text">
                        Created: {new Date(row.created_at).toLocaleString("en-US")}
                        {row.completed_at ? ` • Completed: ${new Date(row.completed_at).toLocaleString("en-US")}` : ""}
                      </div>
                      {row.file_path ? <Link href={row.file_path}>Open Export</Link> : null}
                    </div>
                  ))
                )}
              </article>
              </div>
            </section>
          ) : null}

          {activeTab === "publish" ? (
            <section className="workspace-pane">
              <div className="pane-header">
                <strong>Publish</strong>
              </div>
              <article className="card stack-sm">
                <strong>Public Program</strong>
                <div>
                  Publish status: <span className="status-pill">{show.is_published ? "published" : "unpublished"}</span>
                </div>
                <div className="meta-text">
                  Show slug: <code>{show.slug}</code>
                  {show.program_slug ? (
                    <>
                      {" • "}Program slug: <code>{show.program_slug}</code>
                    </>
                  ) : null}
                </div>
                {show.published_at ? (
                  <div className="meta-text">
                    Published at: {new Date(show.published_at).toLocaleString("en-US")}
                  </div>
                ) : null}
                <div className="top-actions">
                  <form action={setPublishAction}>
                    <input type="hidden" name="intent" value={show.is_published ? "unpublish" : "publish"} />
                    <button type="submit">{show.is_published ? "Unpublish" : "Publish"}</button>
                  </form>
                  {show.is_published ? <Link href={publicUrl}>Open Public URL</Link> : null}
                </div>
                <div className="meta-text">
                  Public URL: <code>{publicUrl || "/p/{showSlug}"}</code>
                </div>
                {show.program_slug ? (
                  <div className="link-row">
                    <Link href={`/programs/${show.program_slug}`}>Program Preview</Link>
                    <Link href={`/p/${show.slug}`}>Public Page</Link>
                  </div>
                ) : null}
              </article>
            </section>
          ) : null}

          {activeTab === "settings" ? (
            <section className="workspace-pane">
              <div className="pane-header">
                <strong>Settings</strong>
              </div>
              <article className="card stack-sm">
                <strong>Lifecycle Controls</strong>
                <div>
                  Current status: <span className="status-pill">{show.status}</span>
                </div>
                {show.status !== "archived" ? (
                  <form action={archiveShowAction} className="stack-sm">
                    <p className="section-note">
                      Archive this show first to disable active editing and unlock permanent deletion controls.
                    </p>
                    <button type="submit">Archive Show</button>
                  </form>
                ) : (
                  <form action={restoreShowAction} className="stack-sm">
                    <p className="section-note">
                      This show is archived. You can restore it to draft if deletion was accidental.
                    </p>
                    <button type="submit">Restore to Draft</button>
                  </form>
                )}
              </article>

              <article className="card stack-sm alert">
                <strong className="danger-title">Danger Zone: Permanent Delete</strong>
                <p className="section-note">
                  Deletion is permanent and removes the show, linked program data, people, roles, and submissions.
                </p>
                <p className="section-note">
                  Required phrase: <code>{deletePhrase}</code>
                </p>
                <form action={deleteShowAction} className="stack-sm">
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
                  <div className="meta-text danger-title">
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
