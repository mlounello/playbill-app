import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUserWithProfile, requireRole } from "@/lib/auth";
import { sanitizeRichText } from "@/lib/rich-text";
import { getMissingSupabaseEnvVars, getSupabaseWriteClient } from "@/lib/supabase";

export const BIO_CHAR_LIMIT_DEFAULT = 375;

const manualPersonSchema = z.object({
  fullName: z.string().min(1),
  roleTitle: z.string().min(1),
  teamType: z.enum(["cast", "production"]),
  email: z.string().email()
});

const reviewSchema = z.object({
  bio: z.string().optional().or(z.literal("")),
  headshotUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["pending", "draft", "submitted", "returned", "approved", "locked"]),
  reason: z.string().optional().or(z.literal(""))
});

const returnSchema = z.object({
  message: z.string().min(1)
});

export type ShowSubmissionPerson = {
  id: string;
  full_name: string;
  role_title: string;
  team_type: "cast" | "production";
  email: string;
  bio: string;
  headshot_url: string;
  submission_status: "pending" | "draft" | "submitted" | "returned" | "approved" | "locked";
  submitted_at: string | null;
  bio_char_count: number;
};

export type ContributorTaskSummary = {
  show_id: string;
  show_title: string;
  show_slug: string;
  program_slug: string;
  person_id: string;
  person_name: string;
  role_title: string;
  submission_status: ShowSubmissionPerson["submission_status"];
  due_date: string | null;
  submitted_at: string | null;
};

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}?${qp.toString()}`);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function stripRichTextToPlain(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSubmissionStatus(value: string): ShowSubmissionPerson["submission_status"] {
  if (value === "draft" || value === "submitted" || value === "returned" || value === "approved" || value === "locked") {
    return value;
  }
  return "pending";
}

async function getShowProgramContext(showId: string) {
  const client = getSupabaseWriteClient();
  const { data: show } = await client.from("shows").select("id, title, slug, program_id").eq("id", showId).single();
  if (!show?.program_id) {
    return null;
  }
  const { data: program } = await client.from("programs").select("id, slug").eq("id", show.program_id).single();
  if (!program) {
    return null;
  }
  return {
    show_id: String(show.id),
    show_title: String(show.title ?? ""),
    show_slug: String(show.slug ?? ""),
    program_id: String(program.id),
    program_slug: String(program.slug ?? "")
  };
}

async function writeAuditLog(params: {
  entity: string;
  entityId: string;
  field: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason?: string;
}) {
  const current = await getCurrentUserWithProfile();
  const client = getSupabaseWriteClient();

  await client.from("audit_log").insert({
    entity: params.entity,
    entity_id: params.entityId,
    field: params.field,
    before_value: params.beforeValue,
    after_value: params.afterValue,
    changed_by: current?.user?.id ?? null,
    reason: params.reason ?? ""
  });
}

function parseBulkPeople(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [fullName = "", roleTitle = "", teamTypeRaw = "production", email = ""] = line.split("|").map((part) => part.trim());
      return manualPersonSchema.parse({
        fullName,
        roleTitle,
        teamType: teamTypeRaw.toLowerCase() === "cast" ? "cast" : "production",
        email
      });
    });
}

export async function getShowSubmissionPeople(showId: string) {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return [] as ShowSubmissionPerson[];
  }

  const context = await getShowProgramContext(showId);
  if (!context) {
    return [] as ShowSubmissionPerson[];
  }

  const client = getSupabaseWriteClient();
  const { data: peopleRows } = await client
    .from("people")
    .select("id, full_name, role_title, team_type, email, bio, headshot_url, submission_status, submitted_at")
    .eq("program_id", context.program_id)
    .order("team_type", { ascending: true })
    .order("full_name", { ascending: true });

  return (peopleRows ?? []).map((person) => {
    const cleanBio = String(person.bio ?? "");
    return {
      id: String(person.id),
      full_name: String(person.full_name ?? ""),
      role_title: String(person.role_title ?? ""),
      team_type: person.team_type === "cast" ? "cast" : "production",
      email: String(person.email ?? ""),
      bio: cleanBio,
      headshot_url: String(person.headshot_url ?? ""),
      submission_status: normalizeSubmissionStatus(String(person.submission_status ?? "pending")),
      submitted_at: person.submitted_at ? String(person.submitted_at) : null,
      bio_char_count: stripRichTextToPlain(cleanBio).length
    } satisfies ShowSubmissionPerson;
  });
}

export async function addPeopleToShow(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const mode = formData.get("mode")?.toString() ?? "manual";
  let records: Array<z.infer<typeof manualPersonSchema>> = [];

  try {
    if (mode === "bulk") {
      const bulkText = formData.get("bulkLines")?.toString() ?? "";
      records = parseBulkPeople(bulkText);
    } else {
      records = [
        manualPersonSchema.parse({
          fullName: formData.get("fullName"),
          roleTitle: formData.get("roleTitle"),
          teamType: formData.get("teamType"),
          email: formData.get("email")
        })
      ];
    }
  } catch {
    withError(
      `/app/shows/${showId}?tab=people-roles`,
      "Invalid person data. Use Name | Role | cast|production | email for bulk rows."
    );
  }

  if (records.length === 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Add at least one person.");
  }

  const context = await getShowProgramContext(showId);
  if (!context) {
    withError("/app/shows", "Show was not found.");
  }

  const client = getSupabaseWriteClient();
  const insertRows = records.map((record) => ({
    program_id: context.program_id,
    full_name: record.fullName.trim(),
    role_title: record.roleTitle.trim(),
    team_type: record.teamType,
    email: normalizeEmail(record.email),
    bio: "",
    headshot_url: "",
    submission_status: "pending",
    submitted_at: null
  }));

  const { data: insertedPeople, error: insertError } = await client
    .from("people")
    .insert(insertRows)
    .select("id, full_name, role_title, team_type");

  if (insertError || !insertedPeople) {
    withError(`/app/shows/${showId}?tab=people-roles`, insertError?.message ?? "Could not add people.");
  }

  const roleRows = insertedPeople.map((person, index) => ({
    show_id: showId,
    person_id: person.id,
    role_name: String(person.role_title ?? ""),
    category: person.team_type === "cast" ? "cast" : "production",
    billing_order: person.team_type === "cast" ? index + 1 : null,
    bio_order: null
  }));
  await client.from("show_roles").insert(roleRows);

  const { data: showRoles } = await client
    .from("show_roles")
    .select("id, person_id")
    .eq("show_id", showId)
    .in(
      "person_id",
      insertedPeople.map((person) => person.id)
    );

  if ((showRoles ?? []).length > 0) {
    await client.from("submission_requests").insert(
      (showRoles ?? []).map((role) => ({
        show_role_id: String(role.id),
        request_type: "bio",
        label: "Bio Submission",
        constraints: { maxChars: BIO_CHAR_LIMIT_DEFAULT },
        status: "pending"
      }))
    );
  }

  await writeAuditLog({
    entity: "show",
    entityId: showId,
    field: "people_add",
    beforeValue: null,
    afterValue: {
      added: insertedPeople.map((person) => ({
        id: person.id,
        full_name: person.full_name,
        role_title: person.role_title,
        team_type: person.team_type
      }))
    },
    reason: mode === "bulk" ? "bulk import" : "manual add"
  });

  redirect(`/app/shows/${showId}?tab=people-roles`);
}

export async function getContributorTasksForCurrentUser() {
  const current = await getCurrentUserWithProfile();
  if (!current?.user?.email) {
    return [] as ContributorTaskSummary[];
  }

  const client = getSupabaseWriteClient();
  const { data: peopleRows } = await client
    .from("people")
    .select("id, full_name, role_title, program_id, submission_status, submitted_at, email")
    .ilike("email", current.user.email);

  if (!peopleRows || peopleRows.length === 0) {
    return [] as ContributorTaskSummary[];
  }

  const programIds = [...new Set(peopleRows.map((row) => String(row.program_id ?? "")).filter(Boolean))];
  const { data: shows } = await client
    .from("shows")
    .select("id, title, slug, program_id")
    .in("program_id", programIds);
  const { data: programs } = await client.from("programs").select("id, slug").in("id", programIds);
  const { data: requests } = await client
    .from("submission_requests")
    .select("show_role_id, due_date, show_roles!inner(person_id)")
    .in(
      "show_roles.person_id",
      peopleRows.map((row) => row.id)
    );

  const dueDateByPersonId = new Map<string, string | null>();
  for (const request of requests ?? []) {
    const showRole = request.show_roles as { person_id?: string } | null;
    if (showRole?.person_id) {
      dueDateByPersonId.set(String(showRole.person_id), request.due_date ? String(request.due_date) : null);
    }
  }

  const showByProgramId = new Map<string, { id: string; title: string; slug: string }>();
  for (const show of shows ?? []) {
    showByProgramId.set(String(show.program_id ?? ""), {
      id: String(show.id),
      title: String(show.title ?? "Untitled Show"),
      slug: String(show.slug ?? "")
    });
  }

  const programSlugById = new Map<string, string>();
  for (const program of programs ?? []) {
    programSlugById.set(String(program.id), String(program.slug ?? ""));
  }

  return peopleRows
    .map((row) => {
      const programId = String(row.program_id ?? "");
      const show = showByProgramId.get(programId);
      if (!show) {
        return null;
      }
      return {
        show_id: show.id,
        show_title: show.title,
        show_slug: show.slug,
        program_slug: programSlugById.get(programId) ?? "",
        person_id: String(row.id),
        person_name: String(row.full_name ?? ""),
        role_title: String(row.role_title ?? ""),
        submission_status: normalizeSubmissionStatus(String(row.submission_status ?? "pending")),
        due_date: dueDateByPersonId.get(String(row.id)) ?? null,
        submitted_at: row.submitted_at ? String(row.submitted_at) : null
      } satisfies ContributorTaskSummary;
    })
    .filter((item): item is ContributorTaskSummary => item !== null)
    .sort((a, b) => a.show_title.localeCompare(b.show_title) || a.person_name.localeCompare(b.person_name));
}

export async function getContributorTaskById(showId: string, personId: string) {
  const current = await getCurrentUserWithProfile();
  if (!current?.user?.email) {
    return null;
  }

  const context = await getShowProgramContext(showId);
  if (!context) {
    return null;
  }

  const client = getSupabaseWriteClient();
  const { data: person } = await client
    .from("people")
    .select("id, full_name, role_title, team_type, email, bio, headshot_url, submission_status, submitted_at")
    .eq("id", personId)
    .eq("program_id", context.program_id)
    .single();

  if (!person) {
    return null;
  }

  if (normalizeEmail(String(person.email ?? "")) !== normalizeEmail(current.user.email)) {
    return null;
  }

  const { data: returnMessageAudit } = await client
    .from("audit_log")
    .select("reason, changed_at, after_value")
    .eq("entity", "people")
    .eq("entity_id", personId)
    .eq("field", "return_message")
    .order("changed_at", { ascending: false })
    .limit(1);

  return {
    show_id: context.show_id,
    show_title: context.show_title,
    show_slug: context.show_slug,
    program_slug: context.program_slug,
    person: {
      id: String(person.id),
      full_name: String(person.full_name ?? ""),
      role_title: String(person.role_title ?? ""),
      team_type: person.team_type === "cast" ? "cast" : "production",
      email: String(person.email ?? ""),
      bio: String(person.bio ?? ""),
      headshot_url: String(person.headshot_url ?? ""),
      submission_status: normalizeSubmissionStatus(String(person.submission_status ?? "pending")),
      submitted_at: person.submitted_at ? String(person.submitted_at) : null,
      bio_char_count: stripRichTextToPlain(String(person.bio ?? "")).length
    } satisfies ShowSubmissionPerson,
    return_message: returnMessageAudit?.[0]
      ? {
          reason:
            typeof returnMessageAudit[0].after_value === "object" && returnMessageAudit[0].after_value !== null
              ? String((returnMessageAudit[0].after_value as { message?: unknown }).message ?? "").trim() ||
                String(returnMessageAudit[0].reason ?? "").trim()
              : String(returnMessageAudit[0].reason ?? "").trim(),
          changed_at: String(returnMessageAudit[0].changed_at ?? "")
        }
      : null
  };
}

async function updateSubmissionCore(args: {
  showId: string;
  personId: string;
  bio: string;
  headshotUrl: string;
  status: ShowSubmissionPerson["submission_status"];
  reason: string;
}) {
  const context = await getShowProgramContext(args.showId);
  if (!context) {
    return { ok: false as const, message: "Show not found." };
  }

  const client = getSupabaseWriteClient();
  const { data: person } = await client
    .from("people")
    .select("id, bio, headshot_url, submission_status")
    .eq("id", args.personId)
    .eq("program_id", context.program_id)
    .single();

  if (!person) {
    return { ok: false as const, message: "Submission task was not found." };
  }

  const cleanBio = sanitizeRichText(args.bio);
  const plainLength = stripRichTextToPlain(cleanBio).length;
  if ((args.status === "submitted" || args.status === "approved" || args.status === "locked") && plainLength === 0) {
    return { ok: false as const, message: "Bio is required before submitting." };
  }

  if (plainLength > BIO_CHAR_LIMIT_DEFAULT) {
    return { ok: false as const, message: `Bio exceeds ${BIO_CHAR_LIMIT_DEFAULT} character limit.` };
  }

  const submittedAt =
    args.status === "submitted" || args.status === "approved" || args.status === "locked"
      ? new Date().toISOString()
      : null;

  const { error: updateError } = await client
    .from("people")
    .update({
      bio: cleanBio,
      headshot_url: args.headshotUrl,
      submission_status: args.status,
      submitted_at: submittedAt
    })
    .eq("id", args.personId);

  if (updateError) {
    return { ok: false as const, message: updateError.message };
  }

  const updates: Array<{ field: string; before: unknown; after: unknown }> = [];
  if (String(person.bio ?? "") !== cleanBio) {
    updates.push({ field: "bio", before: person.bio, after: cleanBio });
  }
  if (String(person.headshot_url ?? "") !== args.headshotUrl) {
    updates.push({ field: "headshot_url", before: person.headshot_url, after: args.headshotUrl });
  }
  if (String(person.submission_status ?? "pending") !== args.status) {
    updates.push({ field: "submission_status", before: person.submission_status, after: args.status });
  }

  for (const entry of updates) {
    await writeAuditLog({
      entity: "people",
      entityId: args.personId,
      field: entry.field,
      beforeValue: entry.before,
      afterValue: entry.after,
      reason: args.reason
    });
  }

  return { ok: true as const };
}

export async function contributorSaveTask(showId: string, personId: string, formData: FormData) {
  "use server";

  const current = await getCurrentUserWithProfile();
  if (!current?.user?.email) {
    redirect("/app/login");
  }

  const task = await getContributorTaskById(showId, personId);
  if (!task) {
    withError(`/contribute`, "You do not have access to this task.");
  }
  if (task.person.submission_status === "locked" || task.person.submission_status === "approved") {
    withError(`/contribute/shows/${showId}/tasks/${personId}`, "This submission is read-only.");
  }

  const bio = formData.get("bio")?.toString() ?? "";
  const headshotUrl = formData.get("headshotUrl")?.toString() ?? "";
  const intent = formData.get("intent")?.toString() ?? "save";
  const nextStatus: ShowSubmissionPerson["submission_status"] = intent === "submit" ? "submitted" : "draft";
  const result = await updateSubmissionCore({
    showId,
    personId,
    bio,
    headshotUrl,
    status: nextStatus,
    reason: intent === "submit" ? "contributor submit" : "contributor save"
  });

  if (!result.ok) {
    withError(`/contribute/shows/${showId}/tasks/${personId}`, result.message);
  }

  redirect(`/contribute/shows/${showId}/tasks/${personId}?saved=1`);
}

export async function getShowSubmissionByPerson(showId: string, personId: string) {
  const context = await getShowProgramContext(showId);
  if (!context) {
    return null;
  }

  const client = getSupabaseWriteClient();
  const { data: person } = await client
    .from("people")
    .select("id, full_name, role_title, team_type, email, bio, headshot_url, submission_status, submitted_at")
    .eq("id", personId)
    .eq("program_id", context.program_id)
    .single();
  if (!person) {
    return null;
  }

  const { data: historyRows } = await client
    .from("audit_log")
    .select("id, field, before_value, after_value, reason, changed_at, changed_by")
    .eq("entity", "people")
    .eq("entity_id", personId)
    .order("changed_at", { ascending: false })
    .limit(15);

  const changedByIds = [...new Set((historyRows ?? []).map((row) => String(row.changed_by ?? "")).filter(Boolean))];
  const { data: profileRows } =
    changedByIds.length > 0
      ? await client.from("user_profiles").select("user_id, email").in("user_id", changedByIds)
      : { data: [] as Array<{ user_id: string; email: string }> };
  const emailByUserId = new Map<string, string>();
  for (const profile of profileRows ?? []) {
    emailByUserId.set(String(profile.user_id), String(profile.email));
  }

  return {
    show: context,
    person: {
      id: String(person.id),
      full_name: String(person.full_name ?? ""),
      role_title: String(person.role_title ?? ""),
      team_type: person.team_type === "cast" ? "cast" : "production",
      email: String(person.email ?? ""),
      bio: String(person.bio ?? ""),
      headshot_url: String(person.headshot_url ?? ""),
      submission_status: normalizeSubmissionStatus(String(person.submission_status ?? "pending")),
      submitted_at: person.submitted_at ? String(person.submitted_at) : null,
      bio_char_count: stripRichTextToPlain(String(person.bio ?? "")).length
    } satisfies ShowSubmissionPerson,
    history: (historyRows ?? []).map((row) => ({
      id: String(row.id),
      field: String(row.field ?? ""),
      reason: String(row.reason ?? ""),
      changed_at: String(row.changed_at ?? ""),
      changed_by: row.changed_by ? String(row.changed_by) : "",
      changed_by_email: row.changed_by ? emailByUserId.get(String(row.changed_by)) ?? "" : "",
      before_value: row.before_value,
      after_value: row.after_value
    }))
  };
}

export async function adminSaveSubmission(showId: string, personId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  let parsed: z.infer<typeof reviewSchema>;
  try {
    parsed = reviewSchema.parse({
      bio: formData.get("bio"),
      headshotUrl: formData.get("headshotUrl"),
      status: formData.get("status"),
      reason: formData.get("reason")
    });
  } catch {
    withError(`/app/shows/${showId}/submissions/${personId}`, "Invalid review payload.");
  }

  const result = await updateSubmissionCore({
    showId,
    personId,
    bio: parsed.bio ?? "",
    headshotUrl: parsed.headshotUrl ?? "",
    status: parsed.status,
    reason: parsed.reason || "admin review edit"
  });

  if (!result.ok) {
    withError(`/app/shows/${showId}/submissions/${personId}`, result.message);
  }

  redirect(`/app/shows/${showId}/submissions/${personId}?saved=1`);
}

export async function adminReturnSubmission(showId: string, personId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  let parsed: z.infer<typeof returnSchema>;
  try {
    parsed = returnSchema.parse({
      message: formData.get("message")
    });
  } catch {
    withError(`/app/shows/${showId}?tab=submissions`, "Return message is required.");
  }

  const current = await getShowSubmissionByPerson(showId, personId);
  if (!current) {
    withError(`/app/shows/${showId}?tab=submissions`, "Submission was not found.");
  }

  const message = parsed.message.trim();
  if (!message) {
    withError(`/app/shows/${showId}?tab=submissions`, "Return message is required.");
  }

  const result = await updateSubmissionCore({
    showId,
    personId,
    bio: current.person.bio,
    headshotUrl: current.person.headshot_url,
    status: "returned",
    reason: message
  });
  if (!result.ok) {
    withError(`/app/shows/${showId}?tab=submissions`, result.message);
  }

  await writeAuditLog({
    entity: "people",
    entityId: personId,
    field: "return_message",
    beforeValue: null,
    afterValue: { message },
    reason: message
  });

  redirect(`/app/shows/${showId}?tab=submissions&success=${encodeURIComponent("Submission returned with message.")}`);
}

export async function adminQuickStatus(showId: string, personId: string, status: ShowSubmissionPerson["submission_status"]) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const current = await getShowSubmissionByPerson(showId, personId);
  if (!current) {
    withError(`/app/shows/${showId}?tab=submissions`, "Submission was not found.");
  }

  const result = await updateSubmissionCore({
    showId,
    personId,
    bio: current.person.bio,
    headshotUrl: current.person.headshot_url,
    status,
    reason: `admin quick status -> ${status}`
  });
  if (!result.ok) {
    withError(`/app/shows/${showId}?tab=submissions`, result.message);
  }

  redirect(`/app/shows/${showId}?tab=submissions`);
}
