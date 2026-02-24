import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashToast } from "@/components/flash-toast";
import { PeopleBulkEditor } from "@/components/people-bulk-editor";
import { PerformanceInputs } from "@/components/performance-inputs";
import { ProgramPagePreviewCard } from "@/components/program-page-preview-card";
import { PreviewModuleReorder } from "@/components/preview-module-reorder";
import { ProgramPlanEditor } from "@/components/program-plan-editor";
import { ProgramImageUpload } from "@/components/program-image-upload";
import { RichTextField } from "@/components/rich-text-field";
import { SubmissionFilterPresets } from "@/components/submission-filter-presets";
import { SubmissionViewToggle } from "@/components/submission-view-toggle";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { getDepartmentRepository, getShowDepartmentSelection, updateShowDepartments } from "@/lib/departments";
import { getProgramBySlug } from "@/lib/programs";
import { getRoleLibraryData } from "@/lib/roles";
import { assignSeasonToShow, getSeasonModuleData } from "@/lib/seasons";
import {
  archiveShow,
  deleteArchivedShow,
  getShowExports,
  getProgramTokensFromShowModules,
  getShowById,
  requestShowExport,
  restoreArchivedShow,
  setShowPublished,
  reorderShowModules,
  updateShowActsAndSongs,
  updateShowAcknowledgements,
  updateShowPresentation,
  updateShowModules
} from "@/lib/shows";
import {
  BIO_CHAR_LIMIT_DEFAULT,
  SPECIAL_NOTE_WORD_LIMIT_DEFAULT,
  addRoleAssignmentToPerson,
  addPeopleToShow,
  adminQuickStatus,
  adminReturnSubmission,
  bulkEditPeopleField,
  bulkEditSelectedPeople,
  countWordsFromRichText,
  importBiosFromCsv,
  getShowRoleAssignments,
  getShowSpecialNoteAssignments,
  getShowSubmissionQueue,
  removeRoleAssignment,
  resyncShowSubmissionRequests,
  getShowSubmissionPeople,
  updateRoleAssignment,
  updatePersonProfile,
  updateSpecialNoteAssignments
} from "@/lib/submissions";
import {
  getShowReminderSummary,
  setShowRemindersPaused,
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
    personForRole?: string;
    roleQuery?: string;
    roleCategory?: string;
    roleSaved?: string;
    submissionFilter?: string;
    submissionQuery?: string;
    submissionSort?: string;
    submissionView?: string;
    paddingSim?: string;
    modulePreviewId?: string;
  }>;
}) {
  const { showId } = await params;
  const {
    tab,
    error,
    success,
    personForRole,
    roleQuery,
    roleCategory,
    roleSaved,
    submissionFilter,
    submissionQuery,
    submissionSort,
    submissionView,
    paddingSim,
    modulePreviewId
  } = await searchParams;
  const show = await getShowById(showId);
  const validTabIds = new Set(tabs.map((item) => item.id));
  const normalizedTab = String(tab ?? "overview").split("?")[0];
  const activeTab = validTabIds.has(normalizedTab) ? normalizedTab : "overview";

  if (!show) {
    notFound();
  }

  const savePlanAction = updateShowModules.bind(null, show.id);
  const mappedTokens = getProgramTokensFromShowModules(show.modules);
  const people =
    activeTab === "overview" || activeTab === "people-roles" || activeTab === "submissions"
      ? await getShowSubmissionPeople(show.id)
      : [];
  const specialNoteAssignments =
    activeTab === "people-roles"
      ? await getShowSpecialNoteAssignments(show.id)
      : { directorPersonId: "", dramaturgPersonId: "", musicDirectorPersonId: "" };
  const addPeopleAction = addPeopleToShow.bind(null, show.id);
  const bulkEditPeopleAction = bulkEditPeopleField.bind(null, show.id);
  const bulkEditSelectedPeopleAction = bulkEditSelectedPeople.bind(null, show.id);
  const updatePersonProfileAction = updatePersonProfile.bind(null, show.id);
  const updateSpecialNotesAction = updateSpecialNoteAssignments.bind(null, show.id);
  const resyncSubmissionRequestsAction = resyncShowSubmissionRequests.bind(null, show.id);
  const addRoleAssignmentAction = addRoleAssignmentToPerson.bind(null, show.id);
  const updateRoleAssignmentAction = updateRoleAssignment.bind(null, show.id);
  const removeRoleAssignmentAction = removeRoleAssignment.bind(null, show.id);
  const importBiosAction = importBiosFromCsv.bind(null, show.id);
  const archiveShowAction = archiveShow.bind(null, show.id);
  const restoreShowAction = restoreArchivedShow.bind(null, show.id);
  const deleteShowAction = deleteArchivedShow.bind(null, show.id);
  const requestExportAction = requestShowExport.bind(null, show.id);
  const setPublishAction = setShowPublished.bind(null, show.id);
  const updateActsAndSongsAction = updateShowActsAndSongs.bind(null, show.id);
  const updateAcknowledgementsAction = updateShowAcknowledgements.bind(null, show.id);
  const updateShowPresentationAction = updateShowPresentation.bind(null, show.id);
  const assignSeasonToShowAction = assignSeasonToShow.bind(null, show.id);
  const updateShowDepartmentsAction = updateShowDepartments.bind(null, show.id);
  const setReminderPausedAction = setShowRemindersPaused.bind(null, show.id);
  const setDueDateAction = setShowDueDate.bind(null, show.id);
  const sendInvitesAction = sendShowInvites.bind(null, show.id);
  const sendRemindersAction = sendShowRemindersNow.bind(null, show.id);
  const reorderShowModulesAction = reorderShowModules.bind(null, show.id);
  const deletePhrase = `DELETE ${show.slug}`;
  const hasDepartmentModuleVisible = show.modules.some((module) => module.module_type === "department_info" && module.visible);
  const departmentRepository = activeTab === "settings" ? await getDepartmentRepository() : [];
  const selectedDepartmentIds =
    activeTab === "settings" ? await getShowDepartmentSelection(show.id) : [];
  const seasonModuleData = activeTab === "settings"
    ? await getSeasonModuleData(show.id)
    : { seasons: [], selectedSeasonId: "", selectedSeasonName: "", events: [] };
  const exportRows = activeTab === "export" ? await getShowExports(show.id) : [];
  const publicUrl = show.slug ? `/p/${show.slug}` : "";
  const activeSubmissionFilter = submissionFilter || "all";
  const activeSubmissionQuery = (submissionQuery || "").trim().toLowerCase();
  const activeSubmissionSort = submissionSort || "name_asc";
  const activeSubmissionView = submissionView === "cards" ? "cards" : "table";
  const submissionViewProvided = typeof submissionView === "string";
  const submissionQueue = activeTab === "submissions" ? await getShowSubmissionQueue(show.id) : [];
  const filteredSubmissions =
    activeTab === "submissions"
      ? submissionQueue
          .filter((task) => {
            const isOverLimit = task.submission_type === "bio"
              ? task.bio_char_count > BIO_CHAR_LIMIT_DEFAULT
              : countWordsFromRichText(task.bio) > SPECIAL_NOTE_WORD_LIMIT_DEFAULT;
            if (activeSubmissionFilter === "all") return true;
            if (activeSubmissionFilter === "needs_review") return task.submission_status === "submitted";
            if (activeSubmissionFilter === "bio_missing")
              return task.submission_type === "bio" && task.bio_char_count === 0 && !task.no_bio;
            if (activeSubmissionFilter === "headshot_missing")
              return task.submission_type === "bio" && !task.headshot_url.trim();
            if (activeSubmissionFilter === "over_limit") return isOverLimit;
            return task.submission_status === activeSubmissionFilter;
          })
          .filter((task) => {
            if (!activeSubmissionQuery) {
              return true;
            }
            const haystack = `${task.full_name} ${task.role_title} ${task.email}`.toLowerCase();
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
          missingBios: people.filter((person) => person.submission_type === "bio" && person.bio_char_count === 0 && !person.no_bio).length,
          missingHeadshots: people.filter((person) => person.submission_type === "bio" && !person.headshot_url.trim()).length,
          returnedForEdits: people.filter((person) => person.submission_status === "returned").length,
          overLimit: people.filter((person) =>
            person.submission_type === "bio"
              ? person.bio_char_count > BIO_CHAR_LIMIT_DEFAULT
              : countWordsFromRichText(person.bio) > SPECIAL_NOTE_WORD_LIMIT_DEFAULT
          ).length,
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
      ? await getProgramBySlug(show.program_slug, {
          forceVisibleModuleIds: paddingSimIds,
          previewModuleId: modulePreviewId
        })
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
    if (modulePreviewId) {
      params.set("modulePreviewId", modulePreviewId);
    }
    if (ids.length > 0) {
      params.set("paddingSim", ids.join(","));
    }
    return `/app/shows/${show.id}?${params.toString()}`;
  };
  const makeModulePreviewHref = (moduleId: string) => {
    const params = new URLSearchParams();
    params.set("tab", "program-plan");
    params.set("modulePreviewId", moduleId);
    if (paddingSimIds.length > 0) {
      params.set("paddingSim", paddingSimIds.join(","));
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
  const specialNotePeople = people.filter((person) => person.role_category_display !== "cast");
  const currentDirectorNotePersonId = specialNoteAssignments.directorPersonId;
  const currentDramaturgNotePersonId = specialNoteAssignments.dramaturgPersonId;
  const currentMusicDirectorNotePersonId = specialNoteAssignments.musicDirectorPersonId;
  const roleAssignments = activeTab === "people-roles" ? await getShowRoleAssignments(show.id) : [];
  const roleLibrary =
    activeTab === "people-roles"
      ? await getRoleLibraryData(show.id)
      : { roles: [], shows: [], selectedShowId: "" };
  const availableRoleTemplates = roleLibrary.roles.filter((role) => !role.is_hidden);
  const activeRoleQuery = (roleQuery || "").trim().toLowerCase();
  const activeRoleCategory = roleCategory || "all";
  const filteredRoleAssignments =
    activeTab === "people-roles"
      ? roleAssignments.filter((assignment) => {
          if (activeRoleCategory !== "all" && assignment.category !== activeRoleCategory) {
            return false;
          }
          if (!activeRoleQuery) {
            return true;
          }
          const haystack = `${assignment.person_name} ${assignment.role_name} ${assignment.category}`.toLowerCase();
          return haystack.includes(activeRoleQuery);
        })
      : [];
  const roleAssignmentSummaryByPersonId = new Map<string, { count: number; summary: string }>();
  if (activeTab === "people-roles") {
    const grouped = new Map<string, string[]>();
    for (const assignment of roleAssignments) {
      const list = grouped.get(assignment.person_id) ?? [];
      list.push(assignment.role_name);
      grouped.set(assignment.person_id, list);
    }
    for (const [personId, roles] of grouped.entries()) {
      roleAssignmentSummaryByPersonId.set(personId, {
        count: roles.length,
        summary: roles.slice(0, 3).join(", ")
      });
    }
  }

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
                  <span className="kpi-badge">{show.reminders_paused ? "Reminders Paused" : "Reminders Active"}</span>
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
                  <Link href={`/app/shows/${show.id}?tab=settings`}>Show Settings</Link>
                  <Link href={`/app/shows/${show.id}?tab=program-plan`}>Program Plan</Link>
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Preview</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition View</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}/submit`}>Contributor Form</Link> : null}
                </div>
                <div className="stack-sm">
                  <form action={setDueDateAction} className="top-actions" data-pending-label="Saving due date...">
                    <label>
                      Global bio due date
                      <input type="date" name="dueDate" required />
                    </label>
                    <button type="submit">Set Due Date</button>
                  </form>
                  <div className="top-actions">
                    <form action={sendInvitesAction} data-pending-label="Sending invites...">
                      <button type="submit">Send Invites</button>
                    </form>
                    <form action={sendRemindersAction} data-pending-label="Sending reminders...">
                      <button type="submit" disabled={show.reminders_paused}>
                        {show.reminders_paused ? "Reminders Paused" : "Send Reminders Now"}
                      </button>
                    </form>
                    <form action={setReminderPausedAction} data-pending-label="Updating reminders setting...">
                      <input type="hidden" name="intent" value={show.reminders_paused ? "resume" : "pause"} />
                      <button type="submit">
                        {show.reminders_paused ? "Resume Reminders" : "Pause Reminders"}
                      </button>
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
                    <div>
                      Preview/export parity:{" "}
                      <strong style={{ color: paddingPlanProgram.previewExportParityOk ? undefined : "#8f1f1f" }}>
                        {paddingPlanProgram.previewExportParityOk ? "OK" : "Check needed"}
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
              <article className="card stack-sm">
                <strong>Live Module First-Page Preview</strong>
                <div className="chip-row">
                  {show.modules.map((module) => (
                    <Link
                      key={`preview-${module.id}`}
                      href={makeModulePreviewHref(module.id)}
                      className="tab-chip"
                      style={module.id === modulePreviewId ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
                    >
                      {module.display_title || module.module_type}
                    </Link>
                  ))}
                </div>
                <ProgramPagePreviewCard page={paddingPlanProgram?.modulePreviewPage ?? null} />
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
                <strong>Module Sequence (Quick Reorder)</strong>
                <div className="meta-text">
                  Drag modules to reorder, then save. This updates Program Plan order directly.
                </div>
                <PreviewModuleReorder
                  modules={show.modules.map((module) => ({
                    id: module.id,
                    label: module.display_title || module.module_type,
                    visible: module.visible,
                    fillerEligible: module.filler_eligible
                  }))}
                  onSubmitAction={reorderShowModulesAction}
                />
              </article>
            </section>
          ) : null}

          {activeTab === "people-roles" ? (
            <section className="panel-grid">
              <article className="card stack-sm">
                <strong>Special Note Assignments</strong>
                <p className="section-note">
                  Assign who should submit Director, Dramaturgical, and Music Director notes. This updates submission requirements automatically.
                </p>
                <form action={updateSpecialNotesAction} className="form-row-3" data-pending-label="Saving special note assignments...">
                  <label>
                    Director&apos;s Note
                    <select name="directorPersonId" defaultValue={currentDirectorNotePersonId}>
                      <option value="">Unassigned</option>
                      {specialNotePeople.map((person) => (
                        <option key={`director-${person.id}`} value={person.id}>
                          {person.full_name} - {person.role_title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dramaturgical Note
                    <select name="dramaturgPersonId" defaultValue={currentDramaturgNotePersonId}>
                      <option value="">Unassigned</option>
                      {specialNotePeople.map((person) => (
                        <option key={`dramaturg-${person.id}`} value={person.id}>
                          {person.full_name} - {person.role_title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Music Director&apos;s Note
                    <select name="musicDirectorPersonId" defaultValue={currentMusicDirectorNotePersonId}>
                      <option value="">Unassigned</option>
                      {specialNotePeople.map((person) => (
                        <option key={`music-${person.id}`} value={person.id}>
                          {person.full_name} - {person.role_title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">Save Special Note Assignments</button>
                </form>
                <form action={resyncSubmissionRequestsAction} className="top-actions" data-pending-label="Resyncing submission requests...">
                  <button type="submit">Resync Submission Requests</button>
                  <span className="section-note">
                    Repairs missing bio requests and role links for this show.
                  </span>
                </form>
              </article>

              <div className="people-forms-grid">
                <article className="card stack-sm">
                  <strong>Quick Add</strong>
                  <p className="section-note">
                    Add one person at a time. Use Import options for larger casts/crews.
                  </p>
                  <form action={addPeopleAction} className="grid" style={{ gap: "0.55rem" }} data-pending-label="Adding person...">
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
                      Role category
                      <select name="roleCategory" defaultValue="production">
                        <option value="cast">Cast</option>
                        <option value="creative">Creative Team</option>
                        <option value="production">Production</option>
                      </select>
                    </label>
                    <label>
                      Email
                      <input name="email" type="email" required placeholder="name@example.com" />
                    </label>
                    <label>
                      Submission requirement
                      <select name="submissionType" defaultValue="bio">
                        <option value="bio">Bio</option>
                        <option value="director_note">Director's Note</option>
                        <option value="dramaturgical_note">Dramaturgical Note</option>
                        <option value="music_director_note">Music Director's Note</option>
                      </select>
                    </label>
                    <button type="submit">Add Person</button>
                  </form>
                </article>

                <article className="card grid">
                  <strong>Paste Import</strong>
                  <p className="section-note">
                    Paste either: <code>Name | Role | cast|creative|production | email</code> per line, or a CSV/tabular paste with headers
                    <code> First Name, Last Name, Preferred Name, Pronouns, Project Role, Email</code>.
                  </p>
                  <form action={addPeopleAction} className="stack-sm" data-pending-label="Importing people...">
                    <input type="hidden" name="mode" value="bulk" />
                    <textarea name="bulkLines" className="rich-textarea" placeholder={"Name | Role | creative | email@example.com"} />
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
                  <form action={addPeopleAction} className="stack-sm" data-pending-label="Uploading people CSV...">
                    <input type="hidden" name="mode" value="csv" />
                    <input type="file" name="csvFile" accept=".csv,text/csv" required />
                    <button type="submit">Upload CSV</button>
                  </form>
                </article>
              </div>

              <article className="card stack-sm">
                <details>
                  <summary><strong>Advanced: Bulk Edit by Lookup</strong></summary>
                  <p className="section-note" style={{ marginTop: "0.45rem" }}>
                    Select one or more fields, then paste lines using <code>lookup | field=value | field=value</code>. Only selected fields are updated.
                  </p>
                  <form action={bulkEditPeopleAction} className="stack-sm" data-pending-label="Applying bulk edit..." style={{ marginTop: "0.45rem" }}>
                    <div className="stack-sm">
                      <strong>Fields to update</strong>
                      <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                        <input type="checkbox" name="targetFields" value="role_title" defaultChecked />
                        Role Title
                      </label>
                      <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                        <input type="checkbox" name="targetFields" value="team_type" />
                        Category (cast/creative/production)
                      </label>
                      <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                        <input type="checkbox" name="targetFields" value="email" />
                        Email
                      </label>
                      <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                        <input type="checkbox" name="targetFields" value="full_name" />
                        Full Name
                      </label>
                      <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                        <input type="checkbox" name="targetFields" value="submission_type" />
                        Submission Requirement
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
                          "lookup@example.com | role=Assistant Director | team_type=production | submission_type=director_note\nanother@example.com | email=new@example.com\n\n(single selected field shortcut)\nlookup@example.com | New Value"
                        }
                        required
                      />
                    </label>
                    <button type="submit">Apply Bulk Edit</button>
                  </form>
                </details>
              </article>

              <PeopleBulkEditor
                people={people.map((person) => ({
                  id: person.id,
                  full_name: person.full_name,
                  role_title: person.role_title,
                  team_type: person.role_category_display ?? person.team_type,
                  email: person.email,
                  role_count: roleAssignmentSummaryByPersonId.get(person.id)?.count ?? 1,
                  role_summary: roleAssignmentSummaryByPersonId.get(person.id)?.summary ?? person.role_title,
                  submission_type: person.submission_type
                }))}
                onSubmitAction={bulkEditSelectedPeopleAction}
                onEditAction={updatePersonProfileAction}
                onAddRoleAction={addRoleAssignmentAction}
                onRemoveRoleAction={removeRoleAssignmentAction}
                personRoles={roleAssignments}
                roleTemplates={availableRoleTemplates.map((template) => ({
                  id: template.id,
                  name: template.name,
                  category: template.category
                }))}
                getRoleManageHref={(personId) => `/app/shows/${show.id}?tab=people-roles&personForRole=${personId}#role-assignments`}
              />
              <p className="section-note">
                Tip: if someone has more than one role, click <strong>Manage Roles</strong> in their row. Role/category edits are handled in Role Assignments.
              </p>

              <article className="card stack-sm" id="role-assignments">
                <strong>Role Assignments</strong>
                <p className="section-note">
                  Use this section for role/category changes and multi-role setup. Use "Current People" above for person identity fields (name/email/submission type).
                </p>
                <form method="get" className="form-row-2">
                  <input type="hidden" name="tab" value="people-roles" />
                  {personForRole ? <input type="hidden" name="personForRole" value={personForRole} /> : null}
                  <label>
                    Search roles
                    <input name="roleQuery" defaultValue={activeRoleQuery} placeholder="Person or role name" />
                  </label>
                  <label>
                    Category
                    <select name="roleCategory" defaultValue={activeRoleCategory}>
                      <option value="all">All</option>
                      <option value="cast">cast</option>
                      <option value="creative">creative</option>
                      <option value="production">production</option>
                    </select>
                  </label>
                  <button type="submit">Apply Role Filters</button>
                </form>
                <form action={addRoleAssignmentAction} className="form-row-2" data-pending-label="Adding role assignment...">
                  <label>
                    Person
                    <select name="personId" required defaultValue={personForRole || ""}>
                      <option value="" disabled>
                        Select person
                      </option>
                      {people.map((person) => (
                        <option key={`role-person-${person.id}`} value={person.id}>
                          {person.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Role template (optional)
                    <select name="roleTemplateId" defaultValue="">
                      <option value="">None</option>
                      {availableRoleTemplates.map((template) => (
                        <option key={`template-${template.id}`} value={template.id}>
                          {template.name} ({template.category})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Custom role name
                    <input name="roleName" placeholder="Used when no template selected" />
                  </label>
                  <label>
                    Category fallback
                    <select name="roleCategory" defaultValue="production">
                      <option value="cast">cast</option>
                      <option value="creative">creative</option>
                      <option value="production">production</option>
                    </select>
                  </label>
                  <button type="submit">Add Role Assignment</button>
                </form>

                {filteredRoleAssignments.length === 0 ? (
                  <div className="meta-text">No role assignments yet.</div>
                ) : (
                  <div className="role-assignments-list">
                    {filteredRoleAssignments.map((assignment) => (
                      <form key={assignment.id} action={updateRoleAssignmentAction} className="role-assignment-row" data-pending-label="Saving role assignment...">
                        <input type="hidden" name="roleId" value={assignment.id} />
                        <label className="role-assign-person">
                          Person
                          <input value={assignment.person_name} readOnly />
                        </label>
                        <label>
                          Template
                          <select name="roleTemplateId" defaultValue={assignment.role_template_id ?? ""}>
                            <option value="">None</option>
                            {availableRoleTemplates.map((template) => (
                              <option key={`template-edit-${assignment.id}-${template.id}`} value={template.id}>
                                {template.name} ({template.category})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Role name
                          <input name="roleName" defaultValue={assignment.role_name} required />
                        </label>
                        <label>
                          Category
                          <select name="roleCategory" defaultValue={assignment.category}>
                            <option value="cast">cast</option>
                            <option value="creative">creative</option>
                            <option value="production">production</option>
                          </select>
                        </label>
                        <div className="stack-sm">
                          <button type="submit">Save</button>
                          {roleSaved === assignment.id ? <span className="meta-text">Saved</span> : null}
                        </div>
                      </form>
                    ))}
                  </div>
                )}
              </article>
            </section>
          ) : null}

          {activeTab === "submissions" ? (
            <section className="workspace-pane">
              <div className="pane-header">
                <strong>Submissions</strong>
                <div className="kpi-inline">
                  <span className="kpi-badge">
                    {submissionQueue.filter((task) => task.submission_status === "submitted" || task.submission_status === "approved" || task.submission_status === "locked").length}
                    /{submissionQueue.length} complete
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
                            <th scope="col">Requirement</th>
                            <th scope="col">Status</th>
                            <th scope="col">Count</th>
                            <th scope="col">Updated</th>
                            <th scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubmissions.map((task) => {
                            const approveAction = adminQuickStatus.bind(null, show.id, task.task_id, "approved");
                            const lockAction = adminQuickStatus.bind(null, show.id, task.task_id, "locked");
                            const returnAction = adminReturnSubmission.bind(null, show.id, task.task_id);
                            return (
                              <tr key={task.task_id}>
                                <td>
                                  <strong>{task.full_name}</strong>
                                  <div className="meta-text">{task.email}</div>
                                </td>
                                <td>{task.role_title}</td>
                                <td style={{ textTransform: "capitalize" }}>{task.role_category_display ?? task.team_type}</td>
                                <td>{task.submission_type.replace(/_/g, " ")}</td>
                                <td><span className="status-pill">{task.submission_status}</span></td>
                                <td>
                                  {task.submission_type === "bio"
                                    ? `${task.bio_char_count} chars`
                                    : `${countWordsFromRichText(task.bio)} words`}
                                </td>
                                <td>{task.submitted_at ? new Date(task.submitted_at).toLocaleDateString("en-US") : "No submission yet"}</td>
                                <td>
                                  <div className="submission-actions">
                                    <Link href={`/app/shows/${show.id}/submissions/${task.task_id}`}>Review</Link>
                                    <form action={approveAction} data-pending-label="Approving submission...">
                                      <button type="submit">Approve</button>
                                    </form>
                                    <form action={lockAction} data-pending-label="Locking submission...">
                                      <button type="submit">Lock</button>
                                    </form>
                                    <form action={returnAction} className="inline-form" data-pending-label="Returning submission...">
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
                      {filteredSubmissions.map((task) => {
                        const approveAction = adminQuickStatus.bind(null, show.id, task.task_id, "approved");
                        const lockAction = adminQuickStatus.bind(null, show.id, task.task_id, "locked");
                        const returnAction = adminReturnSubmission.bind(null, show.id, task.task_id);
                        return (
                          <div key={task.task_id} className="submission-row">
                            <div className="submission-row-top">
                              <div className="submission-identity">
                                <strong>{task.full_name}</strong> - {task.role_title}
                                <div className="submission-meta">
                                  {task.role_category_display ?? task.team_type} • {task.email}
                                </div>
                              </div>
                              <div className="submission-meta">
                                Requirement: {task.submission_type.replace(/_/g, " ")} • Status: <span className="status-pill">{task.submission_status}</span> • {task.submission_type === "bio"
                                  ? `${task.bio_char_count} chars`
                                  : `${countWordsFromRichText(task.bio)} words`}
                              </div>
                              <div className="submission-meta">
                                Updated: {task.submitted_at ? new Date(task.submitted_at).toLocaleDateString("en-US") : "No submission yet"}
                              </div>
                            </div>
                            <div className="submission-actions">
                              <Link href={`/app/shows/${show.id}/submissions/${task.task_id}`}>Open Review</Link>
                              <form action={approveAction} data-pending-label="Approving submission...">
                                <button type="submit">Approve</button>
                              </form>
                              <form action={returnAction} className="inline-form" data-pending-label="Returning submission...">
                                <input name="message" placeholder="Return message" required />
                                <button type="submit">Return</button>
                              </form>
                              <form action={lockAction} data-pending-label="Locking submission...">
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
                  <form action={requestExportAction} data-pending-label="Generating proof export...">
                    <input type="hidden" name="exportType" value="proof" />
                    <button type="submit">Generate Proof Export</button>
                  </form>
                  <form action={requestExportAction} data-pending-label="Generating print export...">
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
                  <form action={setPublishAction} data-pending-label="Updating publish status...">
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
                <strong>Show Setup: Poster + Performance Schedule</strong>
                <div className="meta-text">
                  This is the source for cover poster and program performance date/time text.
                </div>
                <form action={updateShowPresentationAction} className="stack-sm" data-pending-label="Saving poster and schedule...">
                  <PerformanceInputs
                    initialPerformances={show.performance_schedule}
                    initialShowDatesOverride={show.show_dates}
                    draftNamespace={`show-presentation:${show.id}`}
                  />
                  <label>
                    Poster Image URL
                    <input id="showPosterImageUrlInput" name="posterImageUrl" defaultValue={show.poster_image_url} />
                  </label>
                  {show.program_slug ? (
                    <ProgramImageUpload
                      programSlug={show.program_slug}
                      showId={show.id}
                      assetType="poster"
                      targetInputId="showPosterImageUrlInput"
                      label="Upload Poster Image (optional)"
                    />
                  ) : null}
                  <button type="submit">Save Poster + Schedule</button>
                </form>
              </article>

              <article className="card stack-sm">
                <strong>Show Setup: Acts & Songs</strong>
                <div className="meta-text">
                  This is the source for the Acts & Songs section in previews and exports.
                </div>
                <form action={updateActsAndSongsAction} className="stack-sm" data-pending-label="Saving acts and songs...">
                  <RichTextField
                    name="actsAndSongs"
                    label="Acts & Songs"
                    initialValue={show.acts_and_songs}
                    draftNamespace={`show-settings:${show.id}`}
                  />
                  <button type="submit">Save Acts & Songs</button>
                </form>
              </article>

              <article className="card stack-sm">
                <strong>Show Setup: Acknowledgements + Special Thanks</strong>
                <div className="meta-text">
                  These feed separate modules in Program Plan.
                </div>
                <form action={updateAcknowledgementsAction} className="stack-sm" data-pending-label="Saving acknowledgements and thanks...">
                  <RichTextField
                    name="acknowledgements"
                    label="Acknowledgements"
                    initialValue={show.acknowledgements}
                    draftNamespace={`show-acknowledgements:${show.id}`}
                  />
                  <RichTextField
                    name="specialThanks"
                    label="Special Thanks"
                    initialValue={show.special_thanks}
                    draftNamespace={`show-special-thanks:${show.id}`}
                  />
                  <button type="submit">Save Acknowledgements + Special Thanks</button>
                </form>
              </article>
              <article className="card stack-sm">
                <strong>Season Calendar Module</strong>
                <div className="meta-text">
                  Choose the season for this show. Manage seasons and season events in the global Season Builder.
                </div>
                <form action={assignSeasonToShowAction} className="top-actions" data-pending-label="Applying season...">
                  <label>
                    Applied season
                    <select name="seasonId" defaultValue={seasonModuleData.selectedSeasonId}>
                      <option value="">None</option>
                      {seasonModuleData.seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">Apply Season</button>
                </form>
                <div className="top-actions">
                  <Link href={seasonModuleData.selectedSeasonId ? `/app/seasons?seasonId=${seasonModuleData.selectedSeasonId}` : "/app/seasons"}>
                    Open Season Builder
                  </Link>
                </div>
              </article>
              <article className="card stack-sm">
                <strong>Producing Department / Company Module</strong>
                <div className="meta-text">
                  Select profiles for this show. Manage the profile library in the Producing Profiles module.
                </div>
                {!hasDepartmentModuleVisible ? (
                  <div className="meta-text" style={{ color: "#8f1f1f" }}>
                    Department module is currently hidden in Program Plan. Enable <code>department_info</code> to render this section.
                  </div>
                ) : null}
                <div className="top-actions">
                  <Link href="/app/producing-profiles">Open Producing Profiles</Link>
                  {!hasDepartmentModuleVisible ? <Link href={`/app/shows/${show.id}?tab=program-plan`}>Open Program Plan</Link> : null}
                </div>
                {departmentRepository.length === 0 ? (
                  <div className="meta-text">No profiles yet. Use Producing Profiles to create one.</div>
                ) : (
                  <form action={updateShowDepartmentsAction} className="stack-sm" data-pending-label="Saving department bindings...">
                    <div className="stack-sm">
                      {departmentRepository.map((department) => (
                        <label key={department.id} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                          <input
                            type="checkbox"
                            name="departmentIds"
                            value={department.id}
                            defaultChecked={selectedDepartmentIds.includes(department.id)}
                          />
                          <span>
                            <strong>{department.name}</strong>
                            {department.description ? <span className="meta-text"> - {department.description.replace(/<[^>]+>/g, " ").trim()}</span> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button type="submit">Save Show Departments</button>
                  </form>
                )}
              </article>

              <article className="card stack-sm">
                <strong>Lifecycle Controls</strong>
                <div>
                  Current status: <span className="status-pill">{show.status}</span>
                </div>
                {show.status !== "archived" ? (
                  <form action={archiveShowAction} className="stack-sm" data-pending-label="Archiving show...">
                    <p className="section-note">
                      Archive this show first to disable active editing and unlock permanent deletion controls.
                    </p>
                    <button type="submit">Archive Show</button>
                  </form>
                ) : (
                  <form action={restoreShowAction} className="stack-sm" data-pending-label="Restoring show...">
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
                <form action={deleteShowAction} className="stack-sm" data-pending-label="Deleting show...">
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

        </section>
      </div>
    </main>
  );
}
