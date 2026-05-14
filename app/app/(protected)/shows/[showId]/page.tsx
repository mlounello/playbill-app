import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashToast } from "@/components/flash-toast";
import { BulkReminderRunner } from "@/components/bulk-reminder-runner";
import { PeopleBulkEditor } from "@/components/people-bulk-editor";
import { PerformanceInputs } from "@/components/performance-inputs";
import { ProgramPagePreviewCard } from "@/components/program-page-preview-card";
import { ProgramPlanEditor } from "@/components/program-plan-editor";
import { ProgramImageUpload } from "@/components/program-image-upload";
import { RichTextField } from "@/components/rich-text-field";
import { RoleListOrderEditor } from "@/components/role-list-order-editor";
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
  updateShowActsAndSongs,
  updateShowAcknowledgements,
  updateShowReminderSettings,
  updateShowSubmissionSettings,
  updateShowSponsorships,
  updateShowPresentation,
  updateShowModules
} from "@/lib/shows";
import {
  SPECIAL_NOTE_WORD_LIMIT_DEFAULT,
  addRoleAssignmentToPerson,
  archiveSpecialNoteTemplate,
  addPeopleToShow,
  adminQuickStatus,
  adminReturnSubmission,
  bulkEditPeopleField,
  bulkEditSelectedPeople,
  countWordsFromRichText,
  bulkApproveBios,
  importBiosFromCsv,
  getShowRoleAssignments,
  getShowContributorNoteAssignments,
  getShowSpecialNoteAssignments,
  getShowSpecialNoteTemplates,
  getShowSubmissionQueue,
  getSubmissionTypeLabel,
  removePersonFromShow,
  removeRoleAssignment,
  reorderRoleListOrder,
  resyncShowSubmissionRequests,
  getShowSubmissionPeople,
  updateRoleAssignment,
  createSpecialNoteTemplate,
  updatePersonProfile,
  updateContributorNoteAssignments,
  updateSpecialNoteAssignments
} from "@/lib/submissions";
import {
  getReminderDeliveryMode,
  getShowReminderSummary,
  sendReminderPreviewEmail,
  sendSingleReminderNow,
  setShowRemindersPaused,
  sendReminderTestEmail,
  sendShowInvites,
  setShowDueDate
} from "@/lib/reminders";
import { richTextHasContent } from "@/lib/rich-text";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "program-plan", label: "Sections & Order" },
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
    roleError?: string;
    roleName?: string;
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
    roleError,
    roleName,
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
  const people = activeTab === "people-roles" ? await getShowSubmissionPeople(show.id) : [];
  const specialNoteAssignments =
    activeTab === "people-roles"
      ? await getShowSpecialNoteAssignments(show.id)
      : {
          directorPersonId: "",
          dramaturgPersonId: "",
          musicDirectorPersonId: "",
          directorTemplateId: "",
          dramaturgTemplateId: "",
          musicDirectorTemplateId: ""
        };
  const contributorNoteAssignments = activeTab === "people-roles" ? await getShowContributorNoteAssignments(show.id) : [];
  const specialNoteTemplates = activeTab === "people-roles" ? await getShowSpecialNoteTemplates(show.id) : [];
  const addPeopleAction = addPeopleToShow.bind(null, show.id);
  const bulkEditPeopleAction = bulkEditPeopleField.bind(null, show.id);
  const bulkEditSelectedPeopleAction = bulkEditSelectedPeople.bind(null, show.id);
  const updatePersonProfileAction = updatePersonProfile.bind(null, show.id);
  const removePersonFromShowAction = removePersonFromShow.bind(null, show.id);
  const updateSpecialNotesAction = updateSpecialNoteAssignments.bind(null, show.id);
  const updateContributorNotesAction = updateContributorNoteAssignments.bind(null, show.id);
  const reorderRoleListOrderAction = reorderRoleListOrder.bind(null, show.id);
  const createSpecialNoteTemplateAction = createSpecialNoteTemplate.bind(null, show.id);
  const archiveSpecialNoteTemplateAction = archiveSpecialNoteTemplate.bind(null, show.id);
  const resyncSubmissionRequestsAction = resyncShowSubmissionRequests.bind(null, show.id);
  const addRoleAssignmentAction = addRoleAssignmentToPerson.bind(null, show.id);
  const updateRoleAssignmentAction = updateRoleAssignment.bind(null, show.id);
  const removeRoleAssignmentAction = removeRoleAssignment.bind(null, show.id);
  const importBiosAction = importBiosFromCsv.bind(null, show.id);
  const bulkApproveBiosAction = bulkApproveBios.bind(null, show.id);
  const archiveShowAction = archiveShow.bind(null, show.id);
  const restoreShowAction = restoreArchivedShow.bind(null, show.id);
  const deleteShowAction = deleteArchivedShow.bind(null, show.id);
  const requestExportAction = requestShowExport.bind(null, show.id);
  const setPublishAction = setShowPublished.bind(null, show.id);
  const updateActsAndSongsAction = updateShowActsAndSongs.bind(null, show.id);
  const updateAcknowledgementsAction = updateShowAcknowledgements.bind(null, show.id);
  const updateSponsorshipsAction = updateShowSponsorships.bind(null, show.id);
  const updateShowPresentationAction = updateShowPresentation.bind(null, show.id);
  const assignSeasonToShowAction = assignSeasonToShow.bind(null, show.id);
  const updateShowDepartmentsAction = updateShowDepartments.bind(null, show.id);
  const updateShowReminderSettingsAction = updateShowReminderSettings.bind(null, show.id);
  const updateShowSubmissionSettingsAction = updateShowSubmissionSettings.bind(null, show.id);
  const setReminderPausedAction = setShowRemindersPaused.bind(null, show.id);
  const setDueDateAction = setShowDueDate.bind(null, show.id);
  const sendReminderPreviewEmailAction = sendReminderPreviewEmail.bind(null, show.id);
  const sendReminderTestEmailAction = sendReminderTestEmail.bind(null, show.id);
  const sendInvitesAction = sendShowInvites.bind(null, show.id);
  const deletePhrase = `DELETE ${show.slug}`;
  const hasDepartmentModuleVisible = show.modules.some((module) => module.module_type === "department_info" && module.visible);
  const departmentRepository = activeTab === "settings" ? await getDepartmentRepository() : [];
  const selectedDepartmentIds =
    activeTab === "settings" ? await getShowDepartmentSelection(show.id) : [];
  const seasonModuleData = activeTab === "settings"
    ? await getSeasonModuleData(show.id)
    : { seasons: [], selectedSeasonId: "", selectedSeasonName: "", events: [] };
  const exportRows = activeTab === "export" || activeTab === "overview" ? await getShowExports(show.id) : [];
  const exportProgramDiagnostics =
    (activeTab === "export" || activeTab === "overview") && show.program_slug ? await getProgramBySlug(show.program_slug) : null;
  const publicUrl = show.slug ? `/p/${show.slug}` : "";
  const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const genericSubmissionPath = show.program_slug ? `/programs/${show.program_slug}/submit` : "";
  const genericSubmissionUrl = genericSubmissionPath
    ? siteUrl
      ? `${siteUrl}${genericSubmissionPath}`
      : genericSubmissionPath
    : "";
  const activeSubmissionFilter = submissionFilter || "all";
  const activeSubmissionQuery = (submissionQuery || "").trim().toLowerCase();
  const activeSubmissionSort = submissionSort || "name_asc";
  const activeSubmissionView = submissionView === "cards" ? "cards" : "table";
  const submissionViewProvided = typeof submissionView === "string";
  const submissionQueue =
    activeTab === "submissions" || activeTab === "overview" ? await getShowSubmissionQueue(show.id) : [];
  const deliveryMode = activeTab === "overview" ? getReminderDeliveryMode() : null;
  const isTaskComplete = (task: (typeof submissionQueue)[number]) =>
    task.submission_status === "submitted" ||
    task.submission_status === "approved" ||
    task.submission_status === "locked" ||
    (task.submission_type === "bio" && task.no_bio);
  const completedSubmissionCount = submissionQueue.filter((task) => isTaskComplete(task)).length;
  const getTaskNextStep = (task: (typeof submissionQueue)[number]) => {
    if (task.submission_type === "bio" && task.no_bio) return "No bio requested";
    if (task.submission_status === "pending") return "Submit initial draft";
    if (task.submission_status === "draft") return "Submit for review";
    if (task.submission_status === "submitted") return "Admin review needed";
    if (task.submission_status === "returned") return "Needs edits and resubmission";
    if (task.submission_status === "approved") return "Ready to lock";
    if (task.submission_status === "locked") return "Done";
    return "";
  };
  const filteredSubmissions =
    activeTab === "submissions"
      ? submissionQueue
          .filter((task) => {
            const isOverLimit = task.submission_type === "bio"
              ? task.bio_char_count > task.bio_char_limit
              : countWordsFromRichText(task.bio) > SPECIAL_NOTE_WORD_LIMIT_DEFAULT;
            if (activeSubmissionFilter === "all") return true;
            if (activeSubmissionFilter === "needs_review") return task.submission_status === "submitted";
            if (activeSubmissionFilter === "bio_missing")
              return task.submission_type === "bio" && task.bio_char_count === 0 && !task.no_bio;
            if (activeSubmissionFilter === "no_bio") return task.submission_type === "bio" && task.no_bio;
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
          missingBios: submissionQueue.filter(
            (task) => task.submission_type === "bio" && task.bio_char_count === 0 && !task.no_bio
          ).length,
          missingHeadshots: submissionQueue.filter(
            (task) => task.submission_type === "bio" && !task.no_bio && !task.headshot_url.trim()
          ).length,
          missingNotes: submissionQueue.filter(
            (task) => task.submission_type !== "bio" && !richTextHasContent(task.bio)
          ).length,
          skippedBios: submissionQueue.filter((task) => task.submission_type === "bio" && task.no_bio).length,
          returnedForEdits: submissionQueue.filter((task) => task.submission_status === "returned").length,
          openDrafts: submissionQueue.filter((task) => task.submission_status === "pending" || task.submission_status === "draft").length,
          unlockedApproved: submissionQueue.filter((task) => task.submission_status === "approved").length,
          overLimit: submissionQueue.filter((task) =>
            task.submission_type === "bio"
              ? task.bio_char_count > task.bio_char_limit
              : countWordsFromRichText(task.bio) > SPECIAL_NOTE_WORD_LIMIT_DEFAULT
          ).length,
          needsReview: submissionQueue.filter((task) => task.submission_status === "submitted").length
        }
      : {
          missingBios: 0,
          missingHeadshots: 0,
          missingNotes: 0,
          skippedBios: 0,
          returnedForEdits: 0,
          openDrafts: 0,
          unlockedApproved: 0,
          overLimit: 0,
          needsReview: 0
        };
  const reminderSummary =
    activeTab === "overview"
      ? await getShowReminderSummary(show.id)
      : { missing: 0, overdue: 0, dueSoon: 0, currentDueDate: null, currentBioDueDate: null, currentNotesDueDate: null };
  const paddingSimIds =
    activeTab === "program-plan"
      ? (paddingSim ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  let paddingPlanProgram = null as Awaited<ReturnType<typeof getProgramBySlug>> | null;
  if (activeTab === "program-plan" && show.program_slug) {
    try {
      paddingPlanProgram = await getProgramBySlug(show.program_slug, {
        forceVisibleModuleIds: paddingSimIds,
        previewModuleId: modulePreviewId
      });
    } catch {
      paddingPlanProgram = null;
    }
  }
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
      key: "all",
      label: `${blockers.missingNotes} notes missing`,
      count: blockers.missingNotes
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
  const visibleModules = show.modules.filter((module) => module.visible);
  const hasSubmittedBodyForNoteTitle = (title: string) => {
    const normalizedTitle = title.trim().toLowerCase();
    return submissionQueue.some(
      (task) =>
        task.submission_type !== "bio" &&
        task.submission_label.toLowerCase().includes(normalizedTitle) &&
        richTextHasContent(task.bio)
    );
  };
  const sectionHasKnownContent = (module: (typeof show.modules)[number]) => {
    const moduleType = module.module_type;
    if (moduleType === "cover") return Boolean(show.poster_image_url.trim() || show.title.trim());
    if (moduleType === "production_info") return Boolean(show.venue.trim() || show.show_dates.trim() || show.performance_schedule.length > 0);
    if (moduleType === "bios") return submissionQueue.some((task) => task.submission_type === "bio" && (richTextHasContent(task.bio) || task.no_bio));
    if (moduleType === "contributor_note") return hasSubmittedBodyForNoteTitle(module.display_title || "Contributor Note");
    if (moduleType === "acts_scenes" || moduleType === "songs") return richTextHasContent(show.acts_and_songs);
    if (moduleType === "sponsors") return richTextHasContent(show.sponsorships) || Boolean(show.sponsorship_image_url.trim());
    if (moduleType === "actf_sponsorship") return richTextHasContent(String(module.settings.body ?? "")) || Boolean(String(module.settings.image_url ?? "").trim() || show.sponsorship_image_url.trim());
    if (moduleType === "acknowledgements") return richTextHasContent(show.acknowledgements);
    if (moduleType === "special_thanks") return richTextHasContent(show.special_thanks);
    if (moduleType === "season_calendar" || moduleType === "back_cover") return richTextHasContent(show.season_calendar);
    if (moduleType === "custom_text") return richTextHasContent(String(module.settings.body ?? ""));
    if (moduleType === "custom_image") return Boolean(String(module.settings.image_url ?? "").trim());
    return true;
  };
  const emptyVisibleSections =
    activeTab === "overview"
      ? visibleModules.filter((module) => !sectionHasKnownContent(module))
      : [];
  const latestExport = exportRows[0] ?? null;
  const hasCompletedExport = exportRows.some((row) => row.status === "done" && Boolean(row.file_path));
  const readinessItems =
    activeTab === "overview"
      ? [
          {
            label: "Required submissions are complete",
            detail: blockers.openDrafts === 0 && blockers.returnedForEdits === 0 && blockers.missingBios === 0 && blockers.missingNotes === 0
              ? "No missing, draft, pending, or returned requested submissions."
              : `${blockers.openDrafts} pending/draft, ${blockers.returnedForEdits} returned, ${blockers.missingBios + blockers.missingNotes} missing.`,
            ok: blockers.openDrafts === 0 && blockers.returnedForEdits === 0 && blockers.missingBios === 0 && blockers.missingNotes === 0,
            href: `/app/shows/${show.id}?tab=submissions`
          },
          {
            label: "Submissions are reviewed and locked",
            detail: blockers.needsReview === 0 && blockers.unlockedApproved === 0
              ? "No submitted items waiting for review and no approved items left unlocked."
              : `${blockers.needsReview} need review, ${blockers.unlockedApproved} approved but not locked.`,
            ok: blockers.needsReview === 0 && blockers.unlockedApproved === 0,
            href: `/app/shows/${show.id}?tab=submissions&submissionFilter=needs_review`
          },
          {
            label: "Bios and headshots fit print rules",
            detail: blockers.overLimit === 0 && blockers.missingHeadshots === 0
              ? "No over-limit text or missing requested headshots."
              : `${blockers.overLimit} over limit, ${blockers.missingHeadshots} missing headshots.`,
            ok: blockers.overLimit === 0 && blockers.missingHeadshots === 0,
            href: `/app/shows/${show.id}?tab=submissions&submissionFilter=over_limit`
          },
          {
            label: "Visible sections have content",
            detail: emptyVisibleSections.length === 0
              ? `${visibleModules.length} visible section(s) have known content or are data-driven.`
              : `${emptyVisibleSections.length} visible section(s) look empty: ${emptyVisibleSections.slice(0, 3).map((module) => module.display_title || module.module_type).join(", ")}${emptyVisibleSections.length > 3 ? "..." : ""}`,
            ok: emptyVisibleSections.length === 0,
            href: `/app/shows/${show.id}?tab=program-plan`
          },
          {
            label: "Preview/export check is clean",
            detail: exportProgramDiagnostics
              ? `${exportProgramDiagnostics.pageSequence.length} designed pages, ${exportProgramDiagnostics.paddingNeeded} blank padding, parity ${exportProgramDiagnostics.previewExportParityOk ? "OK" : "needs review"}.`
              : "Open preview once a program slug exists.",
            ok: Boolean(exportProgramDiagnostics?.previewExportParityOk),
            href: `/app/shows/${show.id}?tab=preview`
          },
          {
            label: "Export is available",
            detail: hasCompletedExport
              ? `Latest export: ${latestExport?.export_type ?? "export"} ${latestExport?.status ?? ""}.`
              : "No completed export yet.",
            ok: hasCompletedExport,
            href: `/app/shows/${show.id}?tab=export`
          }
        ]
      : [];
  const readinessBlockers = readinessItems.filter((item) => !item.ok);
  const readyToPublish = activeTab === "overview" && readinessBlockers.length === 0;
  const specialNotePeople = activeTab === "people-roles"
    ? people.filter((person) => person.role_category_display !== "cast")
    : [];
  const currentDirectorNotePersonId = specialNoteAssignments.directorPersonId;
  const currentDramaturgNotePersonId = specialNoteAssignments.dramaturgPersonId;
  const currentMusicDirectorNotePersonId = specialNoteAssignments.musicDirectorPersonId;
  const currentDirectorTemplateId = specialNoteAssignments.directorTemplateId || "default:director_note";
  const currentDramaturgTemplateId = specialNoteAssignments.dramaturgTemplateId || "default:dramaturgical_note";
  const currentMusicDirectorTemplateId = specialNoteAssignments.musicDirectorTemplateId || "default:music_director_note";
  const hasLegacyNoteSetup =
    show.modules.some((module) =>
      ["director_note", "dramaturgical_note", "music_director_note"].includes(module.module_type)
    ) ||
    Boolean(currentDirectorNotePersonId || currentDramaturgNotePersonId || currentMusicDirectorNotePersonId);
  const roleAssignments = activeTab === "people-roles" ? await getShowRoleAssignments(show.id) : [];
  const roleLibrary =
    activeTab === "people-roles"
      ? await getRoleLibraryData(show.id)
      : { roles: [], shows: [], selectedShowId: "" };
  const availableRoleTemplates = roleLibrary.roles.filter((role) => !role.is_hidden);
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
      <div className="container container-wide grid workspace-grid">
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
                  <span className="kpi-badge">{completedSubmissionCount}/{submissionQueue.length} complete</span>
                  <span className="kpi-badge">{reminderSummary.missing} outstanding</span>
                  <span className="kpi-badge">{show.reminders_paused ? "Reminders Paused" : "Reminders Active"}</span>
                  {deliveryMode ? <span className="kpi-badge">{deliveryMode.label}</span> : null}
                </div>
              </div>
              <article className={`card readiness-hero ${readyToPublish ? "is-ready" : "needs-work"}`}>
                <div className="stack-sm">
                  <span className="eyebrow">Publishing Readiness</span>
                  <h2>{readyToPublish ? "This playbill looks ready to publish." : `${readinessBlockers.length} item${readinessBlockers.length === 1 ? "" : "s"} need attention before publishing.`}</h2>
                  <p className="section-note">
                    Use this as the admin handoff board: it checks submissions, visible sections, preview/export health, and the final print package.
                  </p>
                </div>
                <div className="readiness-score" aria-label={`${readinessItems.length - readinessBlockers.length} of ${readinessItems.length} readiness checks complete`}>
                  <strong>{readinessItems.length - readinessBlockers.length}/{readinessItems.length}</strong>
                  <span>checks clear</span>
                </div>
              </article>
              <div className="readiness-grid">
                <article className="card stack-sm">
                  <div className="card-toolbar">
                    <strong>Ready to Publish Checklist</strong>
                    <span className={`status-pill ${readyToPublish ? "success" : "warning"}`}>
                      {readyToPublish ? "Ready" : "Needs work"}
                    </span>
                  </div>
                  <div className="readiness-checklist">
                    {readinessItems.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`readiness-check ${item.ok ? "is-ok" : "needs-work"}`}
                      >
                        <span className="readiness-icon">{item.ok ? "OK" : "!"}</span>
                        <span>
                          <strong>{item.label}</strong>
                          <span className="meta-text">{item.detail}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </article>
                <article className="card stack-sm">
                  <strong>Suggested Next Step</strong>
                  {readinessBlockers[0] ? (
                    <>
                      <p className="section-note">{readinessBlockers[0].detail}</p>
                      <Link className="button-link" href={readinessBlockers[0].href}>
                        Fix {readinessBlockers[0].label.toLowerCase()}
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="section-note">
                        Everything on the checklist is clear. Do one final human proof in Preview, then export the print package.
                      </p>
                      <Link className="button-link" href={`/app/shows/${show.id}?tab=preview`}>
                        Open final preview
                      </Link>
                    </>
                  )}
                  <div className="readiness-mini-list">
                    <span><strong>{visibleModules.length}</strong> visible section{visibleModules.length === 1 ? "" : "s"}</span>
                    <span><strong>{emptyVisibleSections.length}</strong> empty visible section{emptyVisibleSections.length === 1 ? "" : "s"}</span>
                    <span><strong>{exportRows.length}</strong> export record{exportRows.length === 1 ? "" : "s"}</span>
                  </div>
                </article>
              </div>
              <article className="card stack-sm submissions-filter">
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-label">Status</div>
                    <div className="stat-value"><span className="status-pill">{show.status}</span></div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Submissions Complete</div>
                    <div className="stat-value">{completedSubmissionCount}/{submissionQueue.length}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Outstanding</div>
                    <div className="stat-value">{reminderSummary.missing}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">No Bio Requested</div>
                    <div className="stat-value">{blockers.skippedBios}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Overdue</div>
                    <div className="stat-value">{reminderSummary.overdue}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Due in {show.reminder_due_soon_days} days</div>
                    <div className="stat-value">{reminderSummary.dueSoon}</div>
                  </div>
                </div>
                <div className="link-row">
                  <Link href={`/app/shows/${show.id}?tab=settings`}>Show Settings</Link>
                  <Link href={`/app/shows/${show.id}?tab=program-plan`}>Sections & Order</Link>
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open Preview</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}?view=booklet`}>Open Print Imposition View</Link> : null}
                  {show.program_slug ? <Link href={`/programs/${show.program_slug}/submit`}>Contributor Form</Link> : null}
                </div>
                <div className="stack-sm">
                  <form action={setDueDateAction} className="top-actions" data-pending-label="Saving due date..." data-preserve-scroll="true">
                    <label>
                      Global bio due date
                      <input
                        type="date"
                        name="dueDate"
                        required
                        defaultValue={reminderSummary.currentBioDueDate ? String(reminderSummary.currentBioDueDate).slice(0, 10) : ""}
                      />
                    </label>
                    <input type="hidden" name="dueScope" value="bio" />
                    <button type="submit">Set Due Date</button>
                  </form>
                  <form action={setDueDateAction} className="top-actions" data-pending-label="Saving notes due date..." data-preserve-scroll="true">
                    <label>
                      Global notes due date
                      <input
                        type="date"
                        name="dueDate"
                        required
                        defaultValue={reminderSummary.currentNotesDueDate ? String(reminderSummary.currentNotesDueDate).slice(0, 10) : ""}
                      />
                    </label>
                    <input type="hidden" name="dueScope" value="notes" />
                    <button type="submit">Set Notes Due Date</button>
                  </form>
                  <div className="top-actions">
                    <form action={sendInvitesAction} data-pending-label="Sending invites..." data-preserve-scroll="true" data-no-overlay="true">
                      <button type="submit">Send Invites</button>
                    </form>
                    <form action={sendReminderTestEmailAction} data-pending-label="Sending test email..." data-preserve-scroll="true" data-no-overlay="true">
                      <button type="submit">Send Test Email To Me</button>
                    </form>
                    <form action={sendReminderPreviewEmailAction} data-pending-label="Sending reminder preview..." data-preserve-scroll="true" data-no-overlay="true">
                      <button type="submit">Send Real Reminder Preview To Me</button>
                    </form>
                    <BulkReminderRunner
                      showId={show.id}
                      remindersPaused={show.reminders_paused}
                      options={[
                        { value: "all_open", label: "All open tasks" },
                        { value: "open_bios", label: "All open bios" },
                        { value: "open_notes", label: "All open notes" }
                      ]}
                    />
                    <form action={setReminderPausedAction} data-pending-label="Updating reminders setting..." data-preserve-scroll="true">
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

            </section>
          ) : null}

          {activeTab === "program-plan" ? (
            <section className="panel-grid">
              <div className="card admin-guidance-card">
                <span className="eyebrow">Phase 2 Cleanup</span>
                <strong>Sections decide what exists. Program Order decides what prints first.</strong>
                <p className="section-note">
                  This page still saves to the existing program module data, but the controls are organized around the way production staff think about building a playbill.
                </p>
              </div>
              <article className="card stack-sm">
                <strong>Booklet Readiness</strong>
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
                        No hidden optional filler sections are available. Advanced layout controls can mark hidden sections as filler when needed.
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
                <strong>Section Preview</strong>
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
              <ProgramPlanEditor
                modules={show.modules}
                onSubmitAction={savePlanAction}
                previewModuleId={modulePreviewId}
                previewBasePath={`/app/shows/${show.id}`}
                paddingSimIds={paddingSimIds}
                showId={show.id}
                programSlug={show.program_slug}
              />
            </section>
          ) : null}

          {activeTab === "preview" ? (
            <section className="panel-grid">
              <article className="card stack-sm">
                <strong>Preview Readiness</strong>
                <div>
                  Current print sequence:{" "}
                  {mappedTokens.length > 0 ? (
                    <code>{mappedTokens.join(" -> ")}</code>
                  ) : (
                    "No sections are ready for preview yet. Include sections from Sections & Order."
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
                <strong>Need to change the order?</strong>
                <div className="meta-text">
                  Program order now lives with section setup, so preview can stay focused on proofing the finished playbill.
                </div>
                <Link href={`/app/shows/${show.id}?tab=program-plan`} className="button-link">
                  Open Sections & Order
                </Link>
              </article>
            </section>
          ) : null}

          {activeTab === "people-roles" ? (
            <section className="panel-grid">
              <article className="card stack-sm">
                <strong>Program Note Assignments</strong>
                <p className="section-note">
                  Contributor Note sections from Sections & Order appear here automatically. Title the section however you want, then assign the person who should submit it.
                </p>
                {contributorNoteAssignments.length === 0 ? (
                  <div className="module-settings-empty">
                    No flexible contributor notes yet. Open Sections & Order, add a Contributor Note section, and name it something like Director&apos;s Note or Choreographer&apos;s Note.
                  </div>
                ) : (
                  <form action={updateContributorNotesAction} className="stack-sm" data-pending-label="Saving program note assignments..." data-preserve-scroll="true">
                    <div className="table-frame">
                      <table className="simple-table">
                        <thead>
                          <tr>
                            <th>Program Section</th>
                            <th>Assigned Contributor</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contributorNoteAssignments.map((assignment) => (
                            <tr key={`contributor-note-${assignment.module_id}`}>
                              <td>
                                <strong>{assignment.module_title}</strong>
                                <input type="hidden" name="noteModuleIds" value={assignment.module_id} />
                                <div className="meta-text">This request will appear to the contributor as {assignment.module_title}.</div>
                              </td>
                              <td>
                                <select name={`notePersonId:${assignment.module_id}`} defaultValue={assignment.assigned_person_id}>
                                  <option value="">Unassigned</option>
                                  {people.map((person) => (
                                    <option key={`program-note-person-${assignment.module_id}-${person.id}`} value={person.id}>
                                      {person.full_name} - {person.role_title}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                {assignment.request_id ? (
                                  <span className="status-pill">{assignment.request_status || "pending"}</span>
                                ) : (
                                  <span className="meta-text">No request yet</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button type="submit">Save Program Note Assignments</button>
                  </form>
                )}
              </article>

              {hasLegacyNoteSetup ? (
              <article className="card stack-sm">
                <strong>Legacy Note Assignments</strong>
                <p className="section-note">
                  This show still has older fixed note slots. New playbills should use Program Note Assignments above, where each Contributor Note section can be titled and assigned freely.
                </p>
                <details>
                  <summary><strong>Show legacy Director / Dramaturgical / Music Director controls</strong></summary>
                <form action={updateSpecialNotesAction} className="grid" style={{ gap: "0.75rem", marginTop: "0.75rem" }} data-pending-label="Saving legacy note assignments..." data-preserve-scroll="true">
                  <div className="form-row-2">
                    <label>
                      Director Note Template
                      <select name="directorTemplateId" defaultValue={currentDirectorTemplateId}>
                        {specialNoteTemplates
                          .filter((template) => template.request_type === "director_note")
                          .map((template) => (
                            <option key={`director-template-${template.id}`} value={template.id}>
                              {template.name} {template.scope === "show" ? "(show)" : "(global)"}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Director&apos;s Note Person
                      <select name="directorPersonId" defaultValue={currentDirectorNotePersonId}>
                        <option value="">Unassigned</option>
                        {specialNotePeople.map((person) => (
                          <option key={`director-${person.id}`} value={person.id}>
                            {person.full_name} - {person.role_title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-row-2">
                    <label>
                      Dramaturgical Template
                      <select name="dramaturgTemplateId" defaultValue={currentDramaturgTemplateId}>
                        {specialNoteTemplates
                          .filter((template) => template.request_type === "dramaturgical_note")
                          .map((template) => (
                            <option key={`dramaturg-template-${template.id}`} value={template.id}>
                              {template.name} {template.scope === "show" ? "(show)" : "(global)"}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Dramaturgical Note Person
                      <select name="dramaturgPersonId" defaultValue={currentDramaturgNotePersonId}>
                        <option value="">Unassigned</option>
                        {specialNotePeople.map((person) => (
                          <option key={`dramaturg-${person.id}`} value={person.id}>
                            {person.full_name} - {person.role_title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-row-2">
                    <label>
                      Music Director Template
                      <select name="musicDirectorTemplateId" defaultValue={currentMusicDirectorTemplateId}>
                        {specialNoteTemplates
                          .filter((template) => template.request_type === "music_director_note")
                          .map((template) => (
                            <option key={`music-template-${template.id}`} value={template.id}>
                              {template.name} {template.scope === "show" ? "(show)" : "(global)"}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Music Director&apos;s Note Person
                      <select name="musicDirectorPersonId" defaultValue={currentMusicDirectorNotePersonId}>
                        <option value="">Unassigned</option>
                        {specialNotePeople.map((person) => (
                          <option key={`music-${person.id}`} value={person.id}>
                            {person.full_name} - {person.role_title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button type="submit">Save Legacy Note Assignments</button>
                </form>
                </details>
                <details>
                  <summary><strong>Manage Legacy Note Templates</strong></summary>
                  <div className="stack-sm" style={{ marginTop: "0.5rem" }}>
                    <form action={createSpecialNoteTemplateAction} className="form-row-3" data-pending-label="Creating note template..." data-preserve-scroll="true">
                      <label>
                        Template name
                        <input name="templateName" placeholder="e.g. Director's Context Note" required />
                      </label>
                      <label>
                        Note type
                        <select name="templateType" defaultValue="director_note">
                          <option value="director_note">Director Note</option>
                          <option value="dramaturgical_note">Dramaturgical Note</option>
                          <option value="music_director_note">Music Director Note</option>
                        </select>
                      </label>
                      <label>
                        Scope
                        <select name="templateScope" defaultValue="show">
                          <option value="show">Show-only</option>
                          <option value="global">Global</option>
                        </select>
                      </label>
                      <button type="submit">Create Template</button>
                    </form>
                    <div className="table-frame">
                      <table className="simple-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Scope</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {specialNoteTemplates.map((template) => (
                            <tr key={`special-template-row-${template.id}`}>
                              <td>{template.name}</td>
                              <td>{template.request_type}</td>
                              <td>{template.scope}</td>
                              <td>
                                {template.id.startsWith("default:") ? (
                                  <span className="meta-text">Default</span>
                                ) : (
                                  <form action={archiveSpecialNoteTemplateAction} data-pending-label="Archiving note template..." data-preserve-scroll="true">
                                    <input type="hidden" name="templateId" value={template.id} />
                                    <button type="submit">Archive</button>
                                  </form>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </article>
              ) : null}
              <article className="card stack-sm">
                <strong>Submission Request Repair</strong>
                <form action={resyncSubmissionRequestsAction} className="top-actions" data-pending-label="Resyncing submission requests..." data-preserve-scroll="true">
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
                  <form action={addPeopleAction} className="grid" style={{ gap: "0.55rem" }} data-pending-label="Adding person..." data-preserve-scroll="true">
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
                    <div className="stack-sm">
                      What should this person submit?
                      <span className="section-note">
                        Choose exactly what you need from them. Notes can be requested without a bio.
                      </span>
                    </div>
                    <label className="checkbox-inline">
                      <input type="checkbox" name="requestBio" defaultChecked />
                      <span>Request a program bio</span>
                    </label>
                    <label className="checkbox-inline">
                      <input type="checkbox" name="requestNotes" />
                      <span>Request notes or production information</span>
                    </label>
                    <button type="submit">Add Person and Create Requests</button>
                  </form>
                </article>

                <article className="card grid">
                  <strong>Paste Import</strong>
                  <p className="section-note">
                    Paste either: <code>Name | Role | cast|creative|production | email</code> per line, or a CSV/tabular paste with headers
                    <code> First Name, Last Name, Preferred Name, Pronouns, Project Role, Email</code>.
                  </p>
                  <form action={addPeopleAction} className="stack-sm" data-pending-label="Importing people..." data-preserve-scroll="true">
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
                  <form action={addPeopleAction} className="stack-sm" data-pending-label="Uploading people CSV..." data-preserve-scroll="true">
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
                  <form action={bulkEditPeopleAction} className="stack-sm" data-pending-label="Applying bulk edit..." style={{ marginTop: "0.45rem" }} data-preserve-scroll="true">
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
                  submission_type: person.submission_type,
                  request_bio: person.request_bio,
                  request_notes: person.request_notes,
                  request_summary: person.request_summary,
                  bio_char_limit: person.bio_char_limit,
                  bio_char_limit_override: person.bio_char_limit_override,
                  submission_status: person.submission_status,
                  submitted_at: person.submitted_at
                }))}
                onSubmitAction={bulkEditSelectedPeopleAction}
                onEditAction={updatePersonProfileAction}
                onRemovePersonAction={removePersonFromShowAction}
                onAddRoleAction={addRoleAssignmentAction}
                onUpdateRoleAction={updateRoleAssignmentAction}
                onRemoveRoleAction={removeRoleAssignmentAction}
                personRoles={roleAssignments}
                roleTemplates={availableRoleTemplates.map((template) => ({
                  id: template.id,
                  name: template.name,
                  category: template.category
                }))}
                roleError={roleError}
                roleErrorRoleName={roleName}
                highlightedPersonId={personForRole || ""}
              />
              <p className="section-note">
                Tip: if someone has more than one role, click <strong>Edit</strong> in their row and manage all role assignments in that modal.
              </p>
              <article className="card stack-sm">
                <strong>Program List Ordering (Cast / Creative / Production)</strong>
                <p className="section-note">
                  Drag within each category to control the printed list order (Role ... Name). Cast uses billing order; creative/production use team list order.
                </p>
                <RoleListOrderEditor
                  roles={roleAssignments.map((assignment) => ({
                    id: assignment.id,
                    person_name: assignment.person_name,
                    role_name: assignment.role_name,
                    category: assignment.category
                  }))}
                  onSubmitAction={reorderRoleListOrderAction}
                />
              </article>
            </section>
          ) : null}

          {activeTab === "submissions" ? (
            <section className="workspace-pane">
              <div className="pane-header">
                <strong>Submissions</strong>
                <div className="kpi-inline">
                  <span className="kpi-badge">
                    {completedSubmissionCount}
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
                  <form action={importBiosAction} className="top-actions" data-pending-label="Importing bios..." data-preserve-scroll="true">
                    <input type="file" name="bioCsvFile" accept=".csv,text/csv" required />
                    <button type="submit">Import Bios CSV</button>
                  </form>
                </details>
                <form action={bulkApproveBiosAction} className="top-actions" data-pending-label="Bulk approving bios..." data-preserve-scroll="true">
                  <button type="submit">Bulk Approve Eligible Bios</button>
                  <span className="section-note">
                    Approves bios with content (or marked No Bio) that are not already approved/locked.
                  </span>
                </form>
                <div className="chip-row">
                  {[
                    ["all", "All"],
                    ["pending", "Pending"],
                    ["needs_review", "Needs Review"],
                    ["bio_missing", "Bio Missing"],
                    ["no_bio", "No Bio Requested"],
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
                <form method="get" className="form-row-2" data-preserve-scroll="true">
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
                            <th scope="col">Next Step</th>
                            <th scope="col">Updated</th>
                            <th scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubmissions.map((task) => {
                            const approveAction = adminQuickStatus.bind(null, show.id, task.task_id, "approved");
                            const lockAction = adminQuickStatus.bind(null, show.id, task.task_id, "locked");
                            const returnAction = adminReturnSubmission.bind(null, show.id, task.task_id);
                            const remindAction = sendSingleReminderNow.bind(null, show.id, task.task_id);
                            return (
                              <tr key={task.task_id}>
                                <td>
                                  <strong>{task.full_name}</strong>
                                  <div className="meta-text">{task.email}</div>
                                </td>
                                <td>{task.role_title}</td>
                                <td style={{ textTransform: "capitalize" }}>{task.role_category_display ?? task.team_type}</td>
                                <td>{task.submission_label || getSubmissionTypeLabel(task.submission_type)}</td>
                                <td><span className="status-pill">{task.submission_status}</span></td>
                                <td>
                                  {task.submission_type === "bio"
                                    ? `${task.bio_char_count}/${task.bio_char_limit} chars`
                                    : `${countWordsFromRichText(task.bio)} words`}
                                </td>
                                <td>{getTaskNextStep(task)}</td>
                                <td>{task.submitted_at ? new Date(task.submitted_at).toLocaleDateString("en-US") : "No submission yet"}</td>
                                <td>
                                  <div className="submission-actions">
                                    <Link href={`/app/shows/${show.id}/submissions/${task.task_id}`}>Review</Link>
                                    <form action={remindAction} data-pending-label="Sending reminder..." data-preserve-scroll="true" data-no-overlay="true">
                                      <button type="submit">Send Reminder</button>
                                    </form>
                                    <form action={approveAction} data-pending-label="Approving submission..." data-preserve-scroll="true">
                                      <button type="submit">Approve</button>
                                    </form>
                                    <form action={lockAction} data-pending-label="Locking submission..." data-preserve-scroll="true">
                                      <button type="submit">Lock</button>
                                    </form>
                                    <form action={returnAction} className="inline-form" data-pending-label="Returning submission..." data-preserve-scroll="true">
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
                        const remindAction = sendSingleReminderNow.bind(null, show.id, task.task_id);
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
                                Requirement: {task.submission_label || getSubmissionTypeLabel(task.submission_type)} • Status: <span className="status-pill">{task.submission_status}</span> • {task.submission_type === "bio"
                                  ? `${task.bio_char_count}/${task.bio_char_limit} chars`
                                  : `${countWordsFromRichText(task.bio)} words`}
                              </div>
                              <div className="submission-meta">Next step: {getTaskNextStep(task)}</div>
                              <div className="submission-meta">
                                Updated: {task.submitted_at ? new Date(task.submitted_at).toLocaleDateString("en-US") : "No submission yet"}
                              </div>
                            </div>
                            <div className="submission-actions">
                              <Link href={`/app/shows/${show.id}/submissions/${task.task_id}`}>Open Review</Link>
                              <form action={remindAction} data-pending-label="Sending reminder..." data-preserve-scroll="true" data-no-overlay="true">
                                <button type="submit">Send Reminder</button>
                              </form>
                              <form action={approveAction} data-pending-label="Approving submission..." data-preserve-scroll="true">
                                <button type="submit">Approve</button>
                              </form>
                              <form action={returnAction} className="inline-form" data-pending-label="Returning submission..." data-preserve-scroll="true">
                                <input name="message" placeholder="Return message" required />
                                <button type="submit">Return</button>
                              </form>
                              <form action={lockAction} data-pending-label="Locking submission..." data-preserve-scroll="true">
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
                {exportProgramDiagnostics ? (
                  <div className="meta-text">
                    Diagnostics: {exportProgramDiagnostics.pageSequence.length} designed pages •{" "}
                    {exportProgramDiagnostics.paddedPages.length} booklet pages •{" "}
                    {exportProgramDiagnostics.bookletSpreads.length} spreads •{" "}
                    {exportProgramDiagnostics.paddingNeeded} blank padding • parity{" "}
                    {exportProgramDiagnostics.previewExportParityOk ? "OK" : "check needed"}
                  </div>
                ) : null}
                <div className="top-actions">
                  <form action={requestExportAction} data-pending-label="Generating proof export..." data-preserve-scroll="true">
                    <input type="hidden" name="exportType" value="proof" />
                    <button type="submit">Generate Proof Export</button>
                  </form>
                  <form action={requestExportAction} data-pending-label="Generating print export..." data-preserve-scroll="true">
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
                      {row.file_path ? (
                        <div className="link-row">
                          <a href={row.file_path} data-no-overlay="true">
                            Open Export
                          </a>
                          <a href={`${row.file_path}?artifact=page-map`} data-no-overlay="true">
                            View Page Map
                          </a>
                          <a href={`${row.file_path}?artifact=page-map&format=csv`} data-no-overlay="true">
                            Download Page Map CSV
                          </a>
                        </div>
                      ) : null}
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
                  <form action={setPublishAction} data-pending-label="Updating publish status..." data-preserve-scroll="true">
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
                <strong>Contributor Access Links</strong>
                <div className="meta-text">
                  Use the generic show submission link below if you want one stable link to share in rehearsal reports, production books, or email. Personalized reminder emails still provide the smoother direct-to-task sign-in flow.
                </div>
                {genericSubmissionUrl ? (
                  <>
                    <label>
                      Generic show submission link
                      <input defaultValue={genericSubmissionUrl} readOnly />
                    </label>
                    <div className="link-row">
                      <Link href={genericSubmissionPath}>Open submission page</Link>
                      {show.program_slug ? <Link href={`/programs/${show.program_slug}`}>Open program preview</Link> : null}
                    </div>
                  </>
                ) : (
                  <div className="meta-text">This show does not have a linked program slug yet, so the generic submission link is not available.</div>
                )}
                <div className="meta-text">
                  Automated reminder cron currently runs daily at 9:00 AM Eastern (13:00 UTC) and then applies this show&apos;s reminder automation settings.
                </div>
              </article>

              <article className="card stack-sm">
                <strong>Submission Settings</strong>
                <div className="meta-text">
                  Set the bio length for this playbill. Contributors and reviewers will see and enforce this exact limit.
                </div>
                <form action={updateShowSubmissionSettingsAction} className="stack-sm" data-pending-label="Saving submission settings..." data-preserve-scroll="true">
                  <label>
                    Bio character limit
                    <input
                      type="number"
                      name="bioCharLimit"
                      min={100}
                      max={2000}
                      defaultValue={show.bio_char_limit}
                      required
                    />
                  </label>
                  <div className="meta-text">
                    Current playbill limit: {show.bio_char_limit} characters. Existing playbills use 375 until changed.
                  </div>
                  <button type="submit">Save Submission Settings</button>
                </form>
              </article>

              <article className="card stack-sm">
                <strong>Reminder Automation</strong>
                <div className="meta-text">
                  Control automatic reminder cadence for this specific show. Manual invites and manual reminder sends remain available even if automation is turned off.
                </div>
                <form action={updateShowReminderSettingsAction} className="stack-sm" data-pending-label="Saving reminder settings..." data-preserve-scroll="true">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      name="reminderAutomationEnabled"
                      defaultChecked={show.reminder_automation_enabled}
                    />
                    <span>Enable automatic cron reminders for this show</span>
                  </label>
                  <div className="form-row-2">
                    <label>
                      Reminder cadence (days)
                      <input
                        type="number"
                        name="reminderCadenceDays"
                        min={1}
                        max={30}
                        defaultValue={show.reminder_cadence_days}
                      />
                    </label>
                    <label>
                      Due soon window (days)
                      <input
                        type="number"
                        name="reminderDueSoonDays"
                        min={1}
                        max={30}
                        defaultValue={show.reminder_due_soon_days}
                      />
                    </label>
                  </div>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      name="reminderSendLastDay"
                      defaultChecked={show.reminder_send_last_day}
                    />
                    <span>Send an automatic last-day reminder on the due date</span>
                  </label>
                  <div className="meta-text">
                    Current automation: {show.reminder_automation_enabled ? "Enabled" : "Disabled"} • cadence every{" "}
                    {show.reminder_cadence_days} day{show.reminder_cadence_days === 1 ? "" : "s"} • due soon window{" "}
                    {show.reminder_due_soon_days} day{show.reminder_due_soon_days === 1 ? "" : "s"} • last-day reminder{" "}
                    {show.reminder_send_last_day ? "on" : "off"}
                  </div>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      name="adminSubmissionNotificationsEnabled"
                      defaultChecked={show.admin_submission_notifications_enabled}
                    />
                    <span>Email admins when a contributor submits materials for review</span>
                  </label>
                  <label>
                    Admin notification recipients
                    <textarea
                      name="adminSubmissionNotificationEmails"
                      className="rich-textarea"
                      defaultValue={show.admin_submission_notification_emails}
                      placeholder={"one@email.com\nanother@email.com\n\nLeave blank to notify all admins/editors."}
                    />
                  </label>
                  <div className="meta-text">
                    If recipient emails are left blank, notifications fall back to all owner/admin/editor emails in the system.
                  </div>
                  <button type="submit">Save Reminder Automation</button>
                </form>
              </article>

              <article className="card stack-sm">
                <strong>Show Setup: Poster + Performance Schedule</strong>
                <div className="meta-text">
                  This is the source for cover poster and program performance date/time text.
                </div>
                <form action={updateShowPresentationAction} className="stack-sm" data-pending-label="Saving poster and schedule..." data-preserve-scroll="true">
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
                <form action={updateActsAndSongsAction} className="stack-sm" data-pending-label="Saving acts and songs..." data-preserve-scroll="true">
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
                <strong>Show Setup: Sponsorships</strong>
                <div className="meta-text">
                  Dedicated sponsorship content source for the Sponsors module (separate from Acknowledgements/Special Thanks).
                </div>
                <form action={updateSponsorshipsAction} className="stack-sm" data-pending-label="Saving sponsorships..." data-preserve-scroll="true">
                  <RichTextField
                    name="sponsorships"
                    label="Sponsorship Copy"
                    initialValue={show.sponsorships}
                    draftNamespace={`show-sponsorships:${show.id}`}
                  />
                  <label>
                    Sponsorship Image URL
                    <input id="showSponsorshipImageUrlInput" name="sponsorshipImageUrl" defaultValue={show.sponsorship_image_url} />
                  </label>
                  {show.program_slug ? (
                    <ProgramImageUpload
                      programSlug={show.program_slug}
                      showId={show.id}
                      assetType="sponsor"
                      targetInputId="showSponsorshipImageUrlInput"
                      label="Upload Sponsorship Image (optional)"
                    />
                  ) : null}
                  <button type="submit">Save Sponsorships</button>
                </form>
              </article>

              <article className="card stack-sm">
                <strong>Show Setup: Acknowledgements + Special Thanks</strong>
                <div className="meta-text">
                  These feed separate sections in Sections & Order.
                </div>
                <form action={updateAcknowledgementsAction} className="stack-sm" data-pending-label="Saving acknowledgements and thanks..." data-preserve-scroll="true">
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
                <form action={assignSeasonToShowAction} className="top-actions" data-pending-label="Applying season..." data-preserve-scroll="true">
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
                    The producing organization section is currently hidden. Open Sections & Order and include it to render this content.
                  </div>
                ) : null}
                <div className="top-actions">
                  <Link href="/app/producing-profiles">Open Producing Profiles</Link>
                  {!hasDepartmentModuleVisible ? <Link href={`/app/shows/${show.id}?tab=program-plan`}>Open Sections & Order</Link> : null}
                </div>
                {departmentRepository.length === 0 ? (
                  <div className="meta-text">No profiles yet. Use Producing Profiles to create one.</div>
                ) : (
                  <form action={updateShowDepartmentsAction} className="stack-sm" data-pending-label="Saving department bindings..." data-preserve-scroll="true">
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
                  <form action={archiveShowAction} className="stack-sm" data-pending-label="Archiving show..." data-preserve-scroll="true">
                    <p className="section-note">
                      Archive this show first to disable active editing and unlock permanent deletion controls.
                    </p>
                    <button type="submit">Archive Show</button>
                  </form>
                ) : (
                  <form action={restoreShowAction} className="stack-sm" data-pending-label="Restoring show..." data-preserve-scroll="true">
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
                <form action={deleteShowAction} className="stack-sm" data-pending-label="Deleting show..." data-preserve-scroll="true">
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
