import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUserWithProfile, requireRole } from "@/lib/auth";
import { sanitizeRichText } from "@/lib/rich-text";
import { getMissingSupabaseEnvVars, getSupabaseWriteClient } from "@/lib/supabase";

export const BIO_CHAR_LIMIT_DEFAULT = 375;
export const NO_BIO_PLACEHOLDER = "<p><em>No biography provided.</em></p>";
export type SubmissionType = "bio" | "director_note" | "dramaturgical_note" | "music_director_note";
export type RoleCategory = "cast" | "creative" | "production";

export function normalizeSubmissionType(value: string): SubmissionType {
  if (value === "director_note" || value === "dramaturgical_note" || value === "music_director_note") {
    return value;
  }
  return "bio";
}

export function getSubmissionTypeLabel(type: SubmissionType) {
  if (type === "director_note") return "Director's Note";
  if (type === "dramaturgical_note") return "Dramaturgical Note";
  if (type === "music_director_note") return "Music Director's Note";
  return "Bio";
}

function getProgramFieldForSubmissionType(type: SubmissionType): "director_notes" | "dramaturgical_note" | "music_director_note" | null {
  if (type === "director_note") return "director_notes";
  if (type === "dramaturgical_note") return "dramaturgical_note";
  if (type === "music_director_note") return "music_director_note";
  return null;
}

function inferSubmissionTypeFromRole(roleTitle: string): SubmissionType {
  const normalized = roleTitle.trim().toLowerCase();
  if (normalized.includes("music director")) {
    return "music_director_note";
  }
  if (normalized.includes("dramaturg")) {
    return "dramaturgical_note";
  }
  if (normalized === "director" || normalized.includes("director")) {
    return "director_note";
  }
  return "bio";
}

const manualPersonSchema = z.object({
  fullName: z.string().min(1),
  roleTitle: z.string().min(1),
  roleCategory: z.enum(["cast", "creative", "production"]).default("production"),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  preferredName: z.string().optional(),
  pronouns: z.string().optional()
  ,
  submissionType: z.enum(["bio", "director_note", "dramaturgical_note", "music_director_note"]).optional()
});

const reviewSchema = z.object({
  bio: z.string().optional().or(z.literal("")),
  headshotUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["pending", "draft", "submitted", "returned", "approved", "locked"]),
  reason: z.string().optional().or(z.literal("")),
  skipBio: z.boolean().optional()
});

const returnSchema = z.object({
  message: z.string().min(1)
});

const bioImportRowSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  bio: z.string().optional()
});

export type ShowSubmissionPerson = {
  id: string;
  full_name: string;
  role_title: string;
  team_type: "cast" | "production";
  role_category_display?: "cast" | "creative" | "production" | "mixed";
  email: string;
  submission_type: SubmissionType;
  bio: string;
  no_bio: boolean;
  headshot_url: string;
  submission_status: "pending" | "draft" | "submitted" | "returned" | "approved" | "locked";
  submitted_at: string | null;
  bio_char_count: number;
};

export type ContributorTaskSummary = {
  task_id: string;
  show_id: string;
  show_title: string;
  show_slug: string;
  program_slug: string;
  person_id: string;
  person_name: string;
  role_title: string;
  submission_type: SubmissionType;
  submission_status: ShowSubmissionPerson["submission_status"];
  due_date: string | null;
  submitted_at: string | null;
};

function withError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}${separator}${qp.toString()}`);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function joinRoles(values: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(trimmed);
    }
  }
  return ordered.join(" & ");
}

function getRoleCategoryDisplay(categories: string[]): "cast" | "creative" | "production" | "mixed" {
  const normalized = [...new Set(categories.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return "production";
  if (normalized.length === 1) {
    const only = normalized[0];
    if (only === "cast" || only === "creative" || only === "production") {
      return only;
    }
    return "production";
  }
  return "mixed";
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findHeaderIndex(headers: string[], variants: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedVariants = variants.map(normalizeHeader);
  for (const variant of normalizedVariants) {
    const direct = normalizedHeaders.indexOf(variant);
    if (direct >= 0) {
      return direct;
    }
  }
  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    const header = normalizedHeaders[i];
    if (normalizedVariants.some((variant) => header.includes(variant))) {
      return i;
    }
  }
  return -1;
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

async function getTableColumns(client: ReturnType<typeof getSupabaseWriteClient>, tableName: string) {
  const { data, error } = await client
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);

  if (error || !data) {
    return new Set<string>();
  }

  return new Set(data.map((item) => String(item.column_name)));
}

function filterToColumns(record: Record<string, unknown>, columns: Set<string>) {
  if (columns.size === 0) {
    return record;
  }
  return Object.fromEntries(Object.entries(record).filter(([key]) => columns.has(key)));
}

function rowHasColumn(row: Record<string, unknown>, column: string) {
  return Object.prototype.hasOwnProperty.call(row, column);
}

function parseBulkPeople(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const headerCols = lines[0].includes("\t")
    ? lines[0].split("\t").map((v) => v.trim())
    : parseCsvRow(lines[0]);
  const firstNameIdx = findHeaderIndex(headerCols, ["first name"]);
  const lastNameIdx = findHeaderIndex(headerCols, ["last name"]);
  const preferredNameIdx = findHeaderIndex(headerCols, ["preferred name"]);
  const roleIdx = findHeaderIndex(headerCols, ["project role", "project roles", "role"]);
  const emailIdx = findHeaderIndex(headerCols, ["email", "email address"]);
  const looksLikeHeader = firstNameIdx >= 0 && lastNameIdx >= 0 && roleIdx >= 0 && emailIdx >= 0;

  if (looksLikeHeader) {
    return lines.slice(1).map((line) => {
      const cols = line.includes("\t") ? line.split("\t").map((v) => v.trim()) : parseCsvRow(line);
      const first = cols[firstNameIdx] ?? "";
      const last = cols[lastNameIdx] ?? "";
      const preferred = preferredNameIdx >= 0 ? cols[preferredNameIdx] ?? "" : "";
      const pronounsIdx = findHeaderIndex(headerCols, ["pronouns"]);
      const pronouns = pronounsIdx >= 0 ? cols[pronounsIdx] ?? "" : "";
      const role = cols[roleIdx] ?? "";
      const email = cols[emailIdx] ?? "";
      const fullName = preferred.trim() ? `${preferred.trim()} ${last.trim()}`.trim() : `${first} ${last}`.trim();
      const roleCategory = inferRoleCategoryFromRole(role);

      return manualPersonSchema.parse({
        fullName,
        roleTitle: role,
        roleCategory,
        email,
        firstName: first,
        lastName: last,
        preferredName: preferred,
        pronouns,
        submissionType: inferSubmissionTypeFromRole(role)
      });
    });
  }

  return lines.map((line) => {
    const [fullName = "", roleTitle = "", roleCategoryRaw = "production", email = ""] = line.split("|").map((part) => part.trim());
    const roleCategory =
      roleCategoryRaw.toLowerCase() === "cast"
        ? "cast"
        : roleCategoryRaw.toLowerCase() === "creative"
          ? "creative"
          : "production";
    return manualPersonSchema.parse({
      fullName,
      roleTitle,
      roleCategory,
      email,
      submissionType: inferSubmissionTypeFromRole(roleTitle)
    });
  });
}

function parseCsvRow(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

function inferTeamTypeFromRole(roleTitle: string): "cast" | "production" {
  const castPattern = /cast|actor|actress|character|ensemble|understudy|swing/i;
  return castPattern.test(roleTitle) ? "cast" : "production";
}

function inferRoleCategoryFromRole(roleTitle: string): RoleCategory {
  const normalized = roleTitle.trim().toLowerCase();
  if (/cast|actor|actress|character|ensemble|understudy|swing/.test(normalized)) {
    return "cast";
  }
  if (
    /director|assistant director|dramaturg|music director|choreographer|fight director|intimacy|designer|composer|lyricist|playwright|book by/.test(
      normalized
    )
  ) {
    return "creative";
  }
  return "production";
}

function isValidEmail(value: string) {
  return z.string().email().safeParse(value).success;
}

function parseCsvPeople(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one data row.");
  }

  const headers = parseCsvRow(lines[0]);
  const firstNameIdx = findHeaderIndex(headers, ["first name"]);
  const lastNameIdx = findHeaderIndex(headers, ["last name"]);
  const preferredNameIdx = findHeaderIndex(headers, ["preferred name"]);
  const pronounsIdx = findHeaderIndex(headers, ["pronouns"]);
  const roleIdx = findHeaderIndex(headers, ["project role", "project roles", "role"]);
  const emailIdx = findHeaderIndex(headers, ["email", "email address"]);
  if (firstNameIdx < 0 || lastNameIdx < 0 || roleIdx < 0 || emailIdx < 0) {
    throw new Error("CSV headers must include: First Name, Last Name, Project Role, Email.");
  }

  return lines.slice(1).map((line) => {
    const cols = parseCsvRow(line);
    const first = cols[firstNameIdx] ?? "";
    const last = cols[lastNameIdx] ?? "";
    const preferred = preferredNameIdx >= 0 ? cols[preferredNameIdx] ?? "" : "";
    const pronouns = pronounsIdx >= 0 ? cols[pronounsIdx] ?? "" : "";
    const role = cols[roleIdx] ?? "";
    const email = cols[emailIdx] ?? "";

    const fullName = preferred.trim() ? `${preferred.trim()} ${last.trim()}`.trim() : `${first} ${last}`.trim();
    const roleCategory = inferRoleCategoryFromRole(role);

    return manualPersonSchema.parse({
      fullName,
      roleTitle: role,
      roleCategory,
      email,
      firstName: first,
      lastName: last,
      preferredName: preferred,
      pronouns,
      submissionType: inferSubmissionTypeFromRole(role)
    });
  });
}

function parseBioImportCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one data row.");
  }

  const headers = parseCsvRow(lines[0]);
  const emailIdx = findHeaderIndex(headers, ["email address", "email"]);
  const nameIdx = findHeaderIndex(headers, ["name as you want listed in the program", "name"]);
  const roleIdx = findHeaderIndex(headers, ["production character or role", "character or role", "role"]);
  const bioIdx = findHeaderIndex(headers, ["bio"]);

  if (bioIdx < 0) {
    throw new Error("CSV headers must include: Bio.");
  }
  if (emailIdx < 0 && (nameIdx < 0 || roleIdx < 0)) {
    throw new Error(
      "CSV must include either Email Address, or both Name (As you want listed in the program) and Production Character or Role."
    );
  }

  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvRow(line);
    const emailRaw = emailIdx >= 0 ? String(cols[emailIdx] ?? "").trim() : "";
    const nameRaw = nameIdx >= 0 ? String(cols[nameIdx] ?? "").trim() : "";
    const roleRaw = roleIdx >= 0 ? String(cols[roleIdx] ?? "").trim() : "";
    const bioRaw = String(cols[bioIdx] ?? "").trim();

    const parsed = bioImportRowSchema.safeParse({
      email: emailRaw || undefined,
      name: nameRaw || undefined,
      role: roleRaw || undefined,
      bio: bioRaw
    });
    if (!parsed.success) {
      throw new Error("Could not read one or more CSV rows.");
    }
    return {
      email: String(parsed.data.email ?? "").trim() || undefined,
      name: String(parsed.data.name ?? "").trim() || undefined,
      role: String(parsed.data.role ?? "").trim() || undefined,
      bio: String(parsed.data.bio ?? "").trim()
    };
  });

  return rows.filter((row) => row.bio.length > 0);
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
    .select("*")
    .eq("program_id", context.program_id)
    .order("team_type", { ascending: true })
    .order("full_name", { ascending: true });
  const { data: roleRows } = await client
    .from("show_roles")
    .select("person_id, role_name, category, billing_order")
    .eq("show_id", showId);
  const rolesByPersonId = new Map<string, Array<{ role_name: string; category: string; billing_order: number | null }>>();
  for (const role of roleRows ?? []) {
    const personId = String(role.person_id ?? "");
    if (!personId) continue;
    const list = rolesByPersonId.get(personId) ?? [];
    list.push({
      role_name: String(role.role_name ?? ""),
      category: String(role.category ?? "production"),
      billing_order: role.billing_order === null ? null : Number(role.billing_order ?? null)
    });
    rolesByPersonId.set(personId, list);
  }

  return (peopleRows ?? []).map((person) => {
    const row = person as Record<string, unknown>;
    const cleanBio = String(person.bio ?? "");
    const personId = String(person.id);
    const roles = rolesByPersonId.get(personId) ?? [];
    const castRoles = roles
      .filter((role) => role.category.toLowerCase() === "cast")
      .sort((a, b) => (a.billing_order ?? Number.MAX_SAFE_INTEGER) - (b.billing_order ?? Number.MAX_SAFE_INTEGER))
      .map((role) => role.role_name);
    const nonCastRoles = roles
      .filter((role) => role.category.toLowerCase() !== "cast")
      .map((role) => role.role_name);
    const roleCategoryDisplay = getRoleCategoryDisplay(roles.map((role) => role.category));
    const combinedRoleTitle = castRoles.length > 0
      ? `${joinRoles(castRoles)}${nonCastRoles.length > 0 ? ` (${joinRoles(nonCastRoles)})` : ""}`
      : nonCastRoles.length > 0
        ? joinRoles(nonCastRoles)
        : String(person.role_title ?? "");
    return {
      id: personId,
      full_name: String(person.full_name ?? ""),
      role_title: combinedRoleTitle,
      team_type: castRoles.length > 0 ? "cast" : "production",
      role_category_display: roleCategoryDisplay,
      email: String(person.email ?? ""),
      submission_type: rowHasColumn(row, "submission_type")
        ? normalizeSubmissionType(String(person.submission_type ?? "bio"))
        : inferSubmissionTypeFromRole(String(person.role_title ?? "")),
      bio: cleanBio,
      no_bio: rowHasColumn(row, "no_bio") ? Boolean(person.no_bio) : false,
      headshot_url: String(person.headshot_url ?? ""),
      submission_status: normalizeSubmissionStatus(String(person.submission_status ?? "pending")),
      submitted_at: person.submitted_at ? String(person.submitted_at) : null,
      bio_char_count: stripRichTextToPlain(cleanBio).length
    } satisfies ShowSubmissionPerson;
  });
}

export async function getShowSpecialNoteAssignments(showId: string) {
  const context = await getShowProgramContext(showId);
  if (!context) {
    return {
      directorPersonId: "",
      dramaturgPersonId: "",
      musicDirectorPersonId: ""
    };
  }

  const client = getSupabaseWriteClient();
  const { data: roles } = await client
    .from("show_roles")
    .select("id, person_id")
    .eq("show_id", showId);
  const roleById = new Map((roles ?? []).map((row) => [String(row.id), String(row.person_id ?? "")]));
  const roleIds = [...roleById.keys()];
  if (roleIds.length === 0) {
    return {
      directorPersonId: "",
      dramaturgPersonId: "",
      musicDirectorPersonId: ""
    };
  }

  const { data: requests } = await client
    .from("submission_requests")
    .select("show_role_id, request_type")
    .in("show_role_id", roleIds);

  let directorPersonId = "";
  let dramaturgPersonId = "";
  let musicDirectorPersonId = "";
  for (const request of requests ?? []) {
    const personId = roleById.get(String(request.show_role_id ?? "")) ?? "";
    if (!personId) continue;
    const requestType = normalizeSubmissionType(String(request.request_type ?? "bio"));
    if (requestType === "director_note") directorPersonId = personId;
    if (requestType === "dramaturgical_note") dramaturgPersonId = personId;
    if (requestType === "music_director_note") musicDirectorPersonId = personId;
  }

  return {
    directorPersonId,
    dramaturgPersonId,
    musicDirectorPersonId
  };
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
    } else if (mode === "csv") {
      const csvFile = formData.get("csvFile");
      if (!(csvFile instanceof File)) {
        throw new Error("CSV file is required.");
      }
      const text = await csvFile.text();
      records = parseCsvPeople(text);
    } else {
      records = [
        manualPersonSchema.parse({
          fullName: formData.get("fullName"),
          roleTitle: formData.get("roleTitle"),
          roleCategory: formData.get("roleCategory"),
          email: formData.get("email"),
          submissionType: formData.get("submissionType")
        })
      ];
    }
  } catch (error) {
    withError(
      `/app/shows/${showId}?tab=people-roles`,
      error instanceof Error
        ? error.message
        : "Invalid person data. Use Name | Role | cast|creative|production | email for bulk rows, or the required CSV headers."
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
  const peopleColumns = await getTableColumns(client, "people");
  const { data: existingPeopleRows } = await client
    .from("people")
    .select("id, full_name, email, team_type")
    .eq("program_id", context.program_id);
  const existingPeople = (existingPeopleRows ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    email: normalizeEmail(String(row.email ?? "")),
    team_type: row.team_type === "cast" ? "cast" : "production"
  }));
  const peopleByEmail = new Map(existingPeople.map((person) => [person.email, person]));

  const newPeopleRecords = records.filter((record) => !peopleByEmail.has(normalizeEmail(record.email)));
  const insertRows = newPeopleRecords.map((record) =>
    filterToColumns(
      {
        program_id: context.program_id,
        full_name: record.fullName.trim(),
        role_title: record.roleTitle.trim(),
        team_type: record.roleCategory === "cast" ? "cast" : "production",
        email: normalizeEmail(record.email),
        submission_type: "bio",
        bio: "",
        headshot_url: "",
        submission_status: "pending",
        submitted_at: null,
        first_name: (record.firstName ?? "").trim(),
        last_name: (record.lastName ?? "").trim(),
        preferred_name: (record.preferredName ?? "").trim(),
        pronouns: (record.pronouns ?? "").trim()
      },
      peopleColumns
    )
  );

  let insertedPeople: Array<{ id: string; full_name: string; email: string; team_type: "cast" | "production" }> = [];
  if (insertRows.length > 0) {
    const { data, error: insertError } = await client
      .from("people")
      .insert(insertRows)
      .select("id, full_name, email, team_type");
    if (insertError || !data) {
      withError(`/app/shows/${showId}?tab=people-roles`, insertError?.message ?? "Could not add people.");
    }
    insertedPeople = data.map((row) => ({
      id: String(row.id),
      full_name: String(row.full_name ?? ""),
      email: normalizeEmail(String(row.email ?? "")),
      team_type: row.team_type === "cast" ? "cast" : "production"
    }));
  }

  const allPeople = [...existingPeople, ...insertedPeople];
  const personIdByEmail = new Map(allPeople.map((person) => [person.email, person.id]));

  // Keep people.team_type as bio grouping: cast if any cast role exists.
  const castEmails = new Set(records.filter((record) => record.roleCategory === "cast").map((record) => normalizeEmail(record.email)));
  for (const email of castEmails) {
    const personId = personIdByEmail.get(email);
    if (!personId) continue;
    await client
      .from("people")
      .update(filterToColumns({ team_type: "cast" }, peopleColumns))
      .eq("id", personId);
  }

  const { data: existingRoleRows } = await client
    .from("show_roles")
    .select("id, person_id, role_name, category, billing_order")
    .eq("show_id", showId);
  const existingRoleKeys = new Set(
    (existingRoleRows ?? []).map(
      (row) => `${String(row.person_id ?? "")}|${String(row.role_name ?? "").trim().toLowerCase()}|${String(row.category ?? "").trim().toLowerCase()}`
    )
  );
  let nextCastBillingOrder =
    Math.max(
      0,
      ...(existingRoleRows ?? [])
        .filter((row) => String(row.category ?? "").trim().toLowerCase() === "cast")
        .map((row) => Number(row.billing_order ?? 0))
    ) + 1;

  const newRoleRows: Array<{
    show_id: string;
    person_id: string;
    role_name: string;
    category: string;
    billing_order: number | null;
    bio_order: number | null;
  }> = [];
  for (const record of records) {
    const personId = personIdByEmail.get(normalizeEmail(record.email));
    if (!personId) {
      continue;
    }
    const roleName = record.roleTitle.trim();
    const category = record.roleCategory;
    const roleKey = `${personId}|${roleName.toLowerCase()}|${category}`;
    if (existingRoleKeys.has(roleKey)) {
      continue;
    }
    existingRoleKeys.add(roleKey);
    newRoleRows.push({
      show_id: showId,
      person_id: personId,
      role_name: roleName,
      category,
      billing_order: category === "cast" ? nextCastBillingOrder++ : null,
      bio_order: null
    });
  }

  if (newRoleRows.length > 0) {
    await client.from("show_roles").insert(newRoleRows);
  }

  // Ensure exactly one bio request per person (not per role).
  const personIds = [...new Set(records.map((record) => personIdByEmail.get(normalizeEmail(record.email)) ?? "").filter(Boolean))];
  if (personIds.length > 0) {
    const { data: allRolesForPeople } = await client
      .from("show_roles")
      .select("id, person_id, category, billing_order")
      .eq("show_id", showId)
      .in("person_id", personIds);
    const roleIds = (allRolesForPeople ?? []).map((row) => String(row.id ?? "")).filter(Boolean);
    const { data: existingBioRequests } = roleIds.length
      ? await client
          .from("submission_requests")
          .select("id, show_role_id, request_type")
          .in("show_role_id", roleIds)
      : { data: [] as Array<Record<string, unknown>> };
    const roleById = new Map((allRolesForPeople ?? []).map((row) => [String(row.id), String(row.person_id ?? "")]));
    const hasBioByPersonId = new Set(
      (existingBioRequests ?? [])
        .filter((row) => String(row.request_type ?? "bio") === "bio")
        .map((row) => roleById.get(String(row.show_role_id ?? "")) ?? "")
        .filter(Boolean)
    );
    const rowsToInsert: Array<{
      show_role_id: string;
      request_type: string;
      label: string;
      constraints: { maxChars: number };
      status: string;
    }> = [];
    for (const personId of personIds) {
      if (hasBioByPersonId.has(personId)) {
        continue;
      }
      const rolesForPerson = (allRolesForPeople ?? [])
        .filter((row) => String(row.person_id ?? "") === personId)
        .sort((a, b) => {
          const aCast = String(a.category ?? "").toLowerCase() === "cast" ? 0 : 1;
          const bCast = String(b.category ?? "").toLowerCase() === "cast" ? 0 : 1;
          if (aCast !== bCast) return aCast - bCast;
          return Number(a.billing_order ?? Number.MAX_SAFE_INTEGER) - Number(b.billing_order ?? Number.MAX_SAFE_INTEGER);
        });
      const chosenRoleId = rolesForPerson[0]?.id ? String(rolesForPerson[0].id) : "";
      if (!chosenRoleId) continue;
      rowsToInsert.push({
        show_role_id: chosenRoleId,
        request_type: "bio",
        label: `${getSubmissionTypeLabel("bio")} Submission`,
        constraints: { maxChars: BIO_CHAR_LIMIT_DEFAULT },
        status: "pending"
      });
    }
    if (rowsToInsert.length > 0) {
      await client.from("submission_requests").insert(rowsToInsert);
    }
  }

  await writeAuditLog({
    entity: "show",
    entityId: showId,
    field: "people_add",
    beforeValue: null,
    afterValue: {
      added_people: insertedPeople.map((person) => ({
        id: person.id,
        full_name: person.full_name,
        team_type: person.team_type,
        email: person.email
      })),
      added_roles: newRoleRows.map((role) => ({
        person_id: role.person_id,
        role_name: role.role_name,
        category: role.category
      }))
    },
    reason: mode === "bulk" ? "bulk import" : "manual add"
  });

  redirect(`/app/shows/${showId}?tab=people-roles`);
}

export async function bulkEditPeopleField(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const lookupFieldRaw = String(formData.get("lookupField") ?? "");
  const editsText = String(formData.get("editsText") ?? "");
  const selectedTargetFields = formData
    .getAll("targetFields")
    .map((value) => String(value))
    .filter((value) => ["full_name", "role_title", "team_type", "email", "submission_type"].includes(value)) as Array<
    "full_name" | "role_title" | "team_type" | "email" | "submission_type"
  >;

  if (!["email", "name"].includes(lookupFieldRaw) || !editsText.trim() || selectedTargetFields.length === 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Invalid bulk edit configuration.");
  }
  const lookupField = lookupFieldRaw as "email" | "name";

  const context = await getShowProgramContext(showId);
  if (!context) {
    withError("/app/shows", "Show was not found.");
  }

  const client = getSupabaseWriteClient();
  const { data: peopleRows } = await client
    .from("people")
    .select("id, full_name, role_title, team_type, email, submission_type")
    .eq("program_id", context.program_id);

  const people: Array<{
    id: string;
    full_name: string;
    role_title: string;
    team_type: "cast" | "production" | "creative";
    email: string;
    submission_type: SubmissionType;
  }> = (peopleRows ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    role_title: String(row.role_title ?? ""),
    team_type: row.team_type === "cast" ? "cast" : "production",
    email: String(row.email ?? ""),
    submission_type: normalizeSubmissionType(String(row.submission_type ?? "bio"))
  }));

  const mapByLookup = new Map<
    string,
    { id: string; full_name: string; role_title: string; team_type: "cast" | "production" | "creative"; email: string; submission_type: SubmissionType }
  >();
  for (const person of people) {
    const key = lookupField === "email" ? normalizeEmail(person.email) : normalizeName(person.full_name);
    if (!key) {
      continue;
    }
    if (!mapByLookup.has(key)) {
      mapByLookup.set(key, person);
    }
  }

  const lines = editsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, "No edit lines were provided.");
  }

  let updated = 0;
  const unmatched: string[] = [];
  const invalid: string[] = [];
  const selectedSet = new Set(selectedTargetFields);

  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
    const lookupRaw = parts[0] ?? "";
    if (!lookupRaw || parts.length < 2) {
      invalid.push(line);
      continue;
    }

    const lookup = lookupField === "email" ? normalizeEmail(lookupRaw) : normalizeName(lookupRaw);
    const person = mapByLookup.get(lookup);
    if (!person) {
      unmatched.push(lookupRaw);
      continue;
    }

    const updates = new Map<"full_name" | "role_title" | "team_type" | "email" | "submission_type", string>();

    // Single-field convenience: `lookup | new value`
    if (selectedSet.size === 1 && parts.length === 2 && !parts[1].includes("=")) {
      const target = [...selectedSet][0];
      updates.set(target, parts[1]);
    } else {
      for (const raw of parts.slice(1)) {
        const eqIndex = raw.indexOf("=");
        if (eqIndex <= 0) {
          continue;
        }
        const keyRaw = raw.slice(0, eqIndex).trim().toLowerCase();
        const valueRaw = raw.slice(eqIndex + 1).trim();
        const fieldKey =
          keyRaw === "name" || keyRaw === "full_name"
            ? "full_name"
            : keyRaw === "role" || keyRaw === "role_title"
              ? "role_title"
              : keyRaw === "team" || keyRaw === "team_type" || keyRaw === "category"
                ? "team_type"
                : keyRaw === "email"
                  ? "email"
                  : keyRaw === "submission" || keyRaw === "submission_type" || keyRaw === "requirement"
                    ? "submission_type"
                  : null;
        if (!fieldKey || !selectedSet.has(fieldKey) || !valueRaw) {
          continue;
        }
        updates.set(fieldKey, valueRaw);
      }
    }

    if (updates.size === 0) {
      invalid.push(line);
      continue;
    }

    const peopleUpdate: Record<string, string> = {};
    const auditEntries: Array<{ field: string; beforeValue: string; afterValue: string }> = [];
    let nextRoleName: string | null = null;
    let nextRoleCategory: string | null = null;

    for (const [field, rawValue] of updates.entries()) {
      let nextValue = rawValue;
      const currentValue =
        field === "full_name"
          ? person.full_name
          : field === "role_title"
            ? person.role_title
              : field === "team_type"
                ? person.team_type
                : field === "submission_type"
                  ? person.submission_type
                  : person.email;

      if (field === "team_type") {
        const lowered = rawValue.toLowerCase();
        if (lowered !== "cast" && lowered !== "creative" && lowered !== "production") {
          invalid.push(line);
          continue;
        }
        nextValue = lowered;
      }

      if (field === "email") {
        if (!z.string().email().safeParse(rawValue).success) {
          invalid.push(line);
          continue;
        }
        nextValue = normalizeEmail(rawValue);
      }
      if (field === "submission_type") {
        nextValue = normalizeSubmissionType(rawValue);
      }

      if (currentValue === nextValue) {
        continue;
      }

      const persistedPeopleValue = field === "team_type" && nextValue === "creative" ? "production" : nextValue;
      peopleUpdate[field] = persistedPeopleValue;
      auditEntries.push({ field, beforeValue: currentValue, afterValue: nextValue });

      if (field === "role_title") {
        nextRoleName = nextValue;
      }
      if (field === "team_type") {
        nextRoleCategory = nextValue === "cast" ? "cast" : nextValue === "creative" ? "creative" : "production";
      }
    }

    if (Object.keys(peopleUpdate).length === 0) {
      continue;
    }

    const { error: updateError } = await client.from("people").update(peopleUpdate).eq("id", person.id);
    if (updateError) {
      invalid.push(line);
      continue;
    }

    if (nextRoleName !== null) {
      await client.from("show_roles").update({ role_name: nextRoleName }).eq("show_id", showId).eq("person_id", person.id);
    }
    if (nextRoleCategory !== null) {
      await client
        .from("show_roles")
        .update({ category: nextRoleCategory })
        .eq("show_id", showId)
        .eq("person_id", person.id);
    }
    if (updates.has("submission_type")) {
      const nextType = normalizeSubmissionType(String(updates.get("submission_type") ?? "bio"));
      const { data: roleRow } = await client
        .from("show_roles")
        .select("id")
        .eq("show_id", showId)
        .eq("person_id", person.id)
        .maybeSingle();
      if (roleRow?.id) {
        await client
          .from("submission_requests")
          .update({
            request_type: nextType,
            label: `${getSubmissionTypeLabel(nextType)} Submission`
          })
          .eq("show_role_id", String(roleRow.id));
      }
    }

    for (const audit of auditEntries) {
      await writeAuditLog({
        entity: "people",
        entityId: person.id,
        field: audit.field,
        beforeValue: audit.beforeValue,
        afterValue: audit.afterValue,
        reason: `bulk_edit_${audit.field}`
      });
    }

    updated += 1;
  }

  const noteParts = [`Updated ${updated} row(s).`];
  if (unmatched.length > 0) {
    noteParts.push(`${unmatched.length} unmatched lookup value(s).`);
  }
  if (invalid.length > 0) {
    noteParts.push(`${invalid.length} invalid line(s).`);
  }

  redirect(`/app/shows/${showId}?tab=people-roles&success=${encodeURIComponent(noteParts.join(" "))}`);
}

export async function bulkEditSelectedPeople(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const selectedIds = formData
    .getAll("selectedPersonIds")
    .map((value) => String(value))
    .filter(Boolean);
  if (selectedIds.length === 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Select at least one person.");
  }

  const enableFullName = String(formData.get("enableFullName") ?? "") === "on";
  const enableRoleTitle = String(formData.get("enableRoleTitle") ?? "") === "on";
  const enableTeamType = String(formData.get("enableTeamType") ?? "") === "on";
  const enableEmail = String(formData.get("enableEmail") ?? "") === "on";
  const enableSubmissionType = String(formData.get("enableSubmissionType") ?? "") === "on";
  const enabledCount = [enableFullName, enableRoleTitle, enableTeamType, enableEmail, enableSubmissionType].filter(Boolean).length;
  if (enabledCount === 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Enable at least one field to update.");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const teamType = String(formData.get("teamType") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim();
  const submissionType = normalizeSubmissionType(String(formData.get("submissionType") ?? "bio"));

  if (enableFullName && !fullName) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Full Name is required when enabled.");
  }
  if (enableRoleTitle && !roleTitle) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Role Title is required when enabled.");
  }
  if (enableTeamType && !["cast", "creative", "production"].includes(teamType)) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Category must be cast, creative, or production.");
  }
  if (enableEmail && !z.string().email().safeParse(email).success) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Email must be valid when enabled.");
  }

  const context = await getShowProgramContext(showId);
  if (!context) {
    withError("/app/shows", "Show was not found.");
  }

  const client = getSupabaseWriteClient();
  const { data: peopleRows } = await client
    .from("people")
    .select("id, full_name, role_title, team_type, email, submission_type")
    .eq("program_id", context.program_id)
    .in("id", selectedIds);

  const people = (peopleRows ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    role_title: String(row.role_title ?? ""),
    team_type: row.team_type === "cast" ? "cast" : "production",
    email: String(row.email ?? ""),
    submission_type: normalizeSubmissionType(String(row.submission_type ?? "bio"))
  }));
  if (people.length === 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, "No selected people were found.");
  }

  const normalizedEmail = normalizeEmail(email);
  let updatedRows = 0;
  for (const person of people) {
    const peopleUpdate: Record<string, string> = {};
    const audits: Array<{ field: string; beforeValue: string; afterValue: string }> = [];

    if (enableFullName && person.full_name !== fullName) {
      peopleUpdate.full_name = fullName;
      audits.push({ field: "full_name", beforeValue: person.full_name, afterValue: fullName });
    }
    if (enableRoleTitle && person.role_title !== roleTitle) {
      peopleUpdate.role_title = roleTitle;
      audits.push({ field: "role_title", beforeValue: person.role_title, afterValue: roleTitle });
    }
    if (enableTeamType && person.team_type !== teamType) {
      peopleUpdate.team_type = teamType === "cast" ? "cast" : "production";
      audits.push({ field: "team_type", beforeValue: person.team_type, afterValue: teamType });
    }
    if (enableEmail && normalizeEmail(person.email) !== normalizedEmail) {
      peopleUpdate.email = normalizedEmail;
      audits.push({ field: "email", beforeValue: person.email, afterValue: normalizedEmail });
    }
    if (enableSubmissionType && person.submission_type !== submissionType) {
      peopleUpdate.submission_type = submissionType;
      audits.push({ field: "submission_type", beforeValue: person.submission_type, afterValue: submissionType });
    }

    if (Object.keys(peopleUpdate).length === 0) {
      continue;
    }

    const { error: updateError } = await client.from("people").update(peopleUpdate).eq("id", person.id);
    if (updateError) {
      continue;
    }

    if (enableRoleTitle) {
      await client.from("show_roles").update({ role_name: roleTitle }).eq("show_id", showId).eq("person_id", person.id);
    }
    if (enableTeamType) {
      await client
        .from("show_roles")
        .update({ category: teamType === "cast" ? "cast" : teamType === "creative" ? "creative" : "production" })
        .eq("show_id", showId)
        .eq("person_id", person.id);
    }
    if (enableSubmissionType) {
      const { data: roleRow } = await client
        .from("show_roles")
        .select("id")
        .eq("show_id", showId)
        .eq("person_id", person.id)
        .maybeSingle();
      if (roleRow?.id) {
        await client
          .from("submission_requests")
          .update({
            request_type: submissionType,
            label: `${getSubmissionTypeLabel(submissionType)} Submission`
          })
          .eq("show_role_id", String(roleRow.id));
      }
    }

    for (const audit of audits) {
      await writeAuditLog({
        entity: "people",
        entityId: person.id,
        field: audit.field,
        beforeValue: audit.beforeValue,
        afterValue: audit.afterValue,
        reason: "bulk_selected_edit"
      });
    }

    updatedRows += 1;
  }

  redirect(
    `/app/shows/${showId}?tab=people-roles&success=${encodeURIComponent(
      `Bulk edit complete. Updated ${updatedRows} of ${people.length} selected row(s).`
    )}`
  );
}

export async function updatePersonProfile(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const personId = String(formData.get("personId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const teamType = String(formData.get("teamType") ?? "").trim().toLowerCase();
  const email = normalizeEmail(String(formData.get("email") ?? "").trim());
  const submissionType = normalizeSubmissionType(String(formData.get("submissionType") ?? "bio"));

  if (!personId) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Person id is required.");
  }
  if (!fullName) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Full Name is required.");
  }
  if (!roleTitle) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Role Title is required.");
  }
  if (!["cast", "creative", "production"].includes(teamType)) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Category must be cast, creative, or production.");
  }
  if (!z.string().email().safeParse(email).success) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Email must be valid.");
  }

  const context = await getShowProgramContext(showId);
  if (!context) {
    withError("/app/shows", "Show was not found.");
  }

  const client = getSupabaseWriteClient();
  const { data: personRow } = await client
    .from("people")
    .select("id, full_name, role_title, team_type, email, submission_type")
    .eq("program_id", context.program_id)
    .eq("id", personId)
    .maybeSingle();
  if (!personRow?.id) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Person not found.");
  }

  const current = {
    id: String(personRow.id),
    full_name: String(personRow.full_name ?? ""),
    role_title: String(personRow.role_title ?? ""),
    team_type: personRow.team_type === "cast" ? "cast" : "production",
    email: normalizeEmail(String(personRow.email ?? "")),
    submission_type: normalizeSubmissionType(String(personRow.submission_type ?? "bio"))
  };

  const nextPeopleTeamType = teamType === "cast" ? "cast" : "production";
  const peopleUpdate: Record<string, string> = {};
  const audits: Array<{ field: string; beforeValue: string; afterValue: string }> = [];

  if (current.full_name !== fullName) {
    peopleUpdate.full_name = fullName;
    audits.push({ field: "full_name", beforeValue: current.full_name, afterValue: fullName });
  }
  if (current.role_title !== roleTitle) {
    peopleUpdate.role_title = roleTitle;
    audits.push({ field: "role_title", beforeValue: current.role_title, afterValue: roleTitle });
  }
  if (current.team_type !== nextPeopleTeamType) {
    peopleUpdate.team_type = nextPeopleTeamType;
    audits.push({ field: "team_type", beforeValue: current.team_type, afterValue: teamType });
  }
  if (current.email !== email) {
    peopleUpdate.email = email;
    audits.push({ field: "email", beforeValue: current.email, afterValue: email });
  }
  if (current.submission_type !== submissionType) {
    peopleUpdate.submission_type = submissionType;
    audits.push({ field: "submission_type", beforeValue: current.submission_type, afterValue: submissionType });
  }

  if (Object.keys(peopleUpdate).length > 0) {
    const { error: updateError } = await client.from("people").update(peopleUpdate).eq("id", current.id);
    if (updateError) {
      withError(`/app/shows/${showId}?tab=people-roles`, updateError.message || "Could not update person.");
    }
  }

  if (current.role_title !== roleTitle) {
    await client.from("show_roles").update({ role_name: roleTitle }).eq("show_id", showId).eq("person_id", current.id);
  }

  const roleCategory = teamType === "cast" ? "cast" : teamType === "creative" ? "creative" : "production";
  await client.from("show_roles").update({ category: roleCategory }).eq("show_id", showId).eq("person_id", current.id);

  if (current.submission_type !== submissionType) {
    const { data: roleRow } = await client
      .from("show_roles")
      .select("id")
      .eq("show_id", showId)
      .eq("person_id", current.id)
      .maybeSingle();
    if (roleRow?.id) {
      await client
        .from("submission_requests")
        .update({
          request_type: submissionType,
          label: `${getSubmissionTypeLabel(submissionType)} Submission`
        })
        .eq("show_role_id", String(roleRow.id));
    }
  }

  for (const audit of audits) {
    await writeAuditLog({
      entity: "people",
      entityId: current.id,
      field: audit.field,
      beforeValue: audit.beforeValue,
      afterValue: audit.afterValue,
      reason: "single_person_edit"
    });
  }

  redirect(`/app/shows/${showId}?tab=people-roles&success=${encodeURIComponent("Person profile updated.")}`);
}

export async function updateSpecialNoteAssignments(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const context = await getShowProgramContext(showId);
  if (!context) {
    withError("/app/shows", "Show was not found.");
  }

  const directorPersonId = String(formData.get("directorPersonId") ?? "").trim();
  const dramaturgPersonId = String(formData.get("dramaturgPersonId") ?? "").trim();
  const musicDirectorPersonId = String(formData.get("musicDirectorPersonId") ?? "").trim();

  const selected = [directorPersonId, dramaturgPersonId, musicDirectorPersonId].filter(Boolean);
  const unique = new Set(selected);
  if (unique.size !== selected.length) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Each special note assignment must be a different person.");
  }

  const client = getSupabaseWriteClient();
  const { data: peopleRows } = await client
    .from("people")
    .select("id, full_name")
    .eq("program_id", context.program_id);
  const people = (peopleRows ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? "")
  }));

  const peopleIdSet = new Set(people.map((person) => person.id));
  for (const selectedId of unique) {
    if (!peopleIdSet.has(selectedId)) {
      withError(`/app/shows/${showId}?tab=people-roles`, "One or more selected people are no longer available.");
    }
  }

  const { data: roleRows } = await client
    .from("show_roles")
    .select("id, person_id")
    .eq("show_id", showId);
  const roles = (roleRows ?? []).map((row) => ({
    id: String(row.id),
    person_id: String(row.person_id ?? "")
  }));
  const roleByPersonId = new Map<string, string>();
  for (const role of roles) {
    if (role.person_id && !roleByPersonId.has(role.person_id)) {
      roleByPersonId.set(role.person_id, role.id);
    }
  }

  const { data: existingRequests } = await client
    .from("submission_requests")
    .select("id, show_role_id, request_type")
    .in("show_role_id", roles.map((role) => role.id));
  const requests = (existingRequests ?? []).map((row) => ({
    id: String(row.id),
    show_role_id: String(row.show_role_id ?? ""),
    request_type: normalizeSubmissionType(String(row.request_type ?? "bio"))
  }));
  const requestsByRoleId = new Map<string, Array<{ id: string; request_type: SubmissionType }>>();
  for (const request of requests) {
    const list = requestsByRoleId.get(request.show_role_id) ?? [];
    list.push({ id: request.id, request_type: request.request_type });
    requestsByRoleId.set(request.show_role_id, list);
  }

  // Bio stays default for everyone.
  for (const role of roles) {
    const roleRequests = requestsByRoleId.get(role.id) ?? [];
    const hasBio = roleRequests.some((item) => item.request_type === "bio");
    if (!hasBio) {
      await client.from("submission_requests").insert({
        show_role_id: role.id,
        request_type: "bio",
        label: `${getSubmissionTypeLabel("bio")} Submission`,
        constraints: { maxChars: BIO_CHAR_LIMIT_DEFAULT },
        status: "pending"
      });
    }
  }

  const requestedAssignments: Array<{ type: SubmissionType; personId: string }> = [
    { type: "director_note", personId: directorPersonId },
    { type: "dramaturgical_note", personId: dramaturgPersonId },
    { type: "music_director_note", personId: musicDirectorPersonId }
  ];

  for (const assignment of requestedAssignments) {
    const selectedRoleId = assignment.personId ? roleByPersonId.get(assignment.personId) ?? "" : "";
    const existingOfType = requests.filter((item) => item.request_type === assignment.type);

    for (const existing of existingOfType) {
      if (selectedRoleId && existing.show_role_id === selectedRoleId) {
        continue;
      }
      await client.from("submission_requests").delete().eq("id", existing.id);
    }

    if (selectedRoleId) {
      const alreadyLinked = existingOfType.some((item) => item.show_role_id === selectedRoleId);
      if (!alreadyLinked) {
        await client.from("submission_requests").insert({
          show_role_id: selectedRoleId,
          request_type: assignment.type,
          label: `${getSubmissionTypeLabel(assignment.type)} Submission`,
          constraints: { maxChars: BIO_CHAR_LIMIT_DEFAULT },
          status: "pending"
        });
      }
    }
  }

  const assignmentLabel = [
    directorPersonId
      ? `Director: ${people.find((person) => person.id === directorPersonId)?.full_name ?? "Assigned"}`
      : "Director: Unassigned",
    dramaturgPersonId
      ? `Dramaturgical: ${people.find((person) => person.id === dramaturgPersonId)?.full_name ?? "Assigned"}`
      : "Dramaturgical: Unassigned",
    musicDirectorPersonId
      ? `Music Director: ${people.find((person) => person.id === musicDirectorPersonId)?.full_name ?? "Assigned"}`
      : "Music Director: Unassigned"
  ].join(" | ");

  await writeAuditLog({
    entity: "show",
    entityId: showId,
    field: "special_note_assignments",
    beforeValue: null,
    afterValue: {
      directorPersonId: directorPersonId || null,
      dramaturgPersonId: dramaturgPersonId || null,
      musicDirectorPersonId: musicDirectorPersonId || null
    },
    reason: assignmentLabel
  });

  redirect(
    `/app/shows/${showId}?tab=people-roles&success=${encodeURIComponent(
      "Special note assignments updated. Bio remains default and note requests were synced."
    )}`
  );
}

export async function getContributorTasksForCurrentUser() {
  const current = await getCurrentUserWithProfile();
  if (!current?.user?.email) {
    return [] as ContributorTaskSummary[];
  }

  const client = getSupabaseWriteClient();
  const { data: peopleRows } = await client
    .from("people")
    .select("id, full_name, role_title, program_id, submission_status, submitted_at, email, submission_type")
    .ilike("email", current.user.email);

  if (!peopleRows || peopleRows.length === 0) {
    return [] as ContributorTaskSummary[];
  }

  const personIds = peopleRows.map((row) => String(row.id)).filter(Boolean);
  const personById = new Map(
    peopleRows.map((row) => [
      String(row.id),
      {
        person_name: String(row.full_name ?? ""),
        role_title: String(row.role_title ?? ""),
        submitted_at: row.submitted_at ? String(row.submitted_at) : null,
        fallback_status: normalizeSubmissionStatus(String(row.submission_status ?? "pending"))
      }
    ])
  );
  const { data: roles } = await client
    .from("show_roles")
    .select("id, show_id, person_id")
    .in("person_id", personIds);
  const roleRows = roles ?? [];
  const roleIds = roleRows.map((row) => String(row.id)).filter(Boolean);
  if (roleIds.length === 0) {
    return [] as ContributorTaskSummary[];
  }

  const roleMetaById = new Map(
    roleRows.map((row) => [
      String(row.id),
      {
        show_id: String(row.show_id ?? ""),
        person_id: String(row.person_id ?? "")
      }
    ])
  );

  const { data: requests } = await client
    .from("submission_requests")
    .select("id, show_role_id, due_date, status, request_type")
    .in("show_role_id", roleIds);
  const requestRows = (requests ?? []).filter((row) =>
    ["bio", "director_note", "dramaturgical_note", "music_director_note"].includes(String(row.request_type ?? "bio"))
  );
  if (requestRows.length === 0) {
    return [] as ContributorTaskSummary[];
  }

  const showIds = [...new Set(roleRows.map((row) => String(row.show_id ?? "")).filter(Boolean))];
  const { data: shows } = await client
    .from("shows")
    .select("id, title, slug, program_id")
    .in("id", showIds);
  const programIds = [...new Set((shows ?? []).map((show) => String(show.program_id ?? "")).filter(Boolean))];
  const { data: programs } =
    programIds.length > 0
      ? await client.from("programs").select("id, slug").in("id", programIds)
      : { data: [] as Array<Record<string, unknown>> };

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

  return requestRows
    .map((request) => {
      const roleMeta = roleMetaById.get(String(request.show_role_id ?? ""));
      if (!roleMeta) {
        return null;
      }
      const show = (shows ?? []).find((row) => String(row.id) === roleMeta.show_id);
      if (!show) {
        return null;
      }
      const person = personById.get(roleMeta.person_id);
      if (!person) {
        return null;
      }
      const programId = String(show.program_id ?? "");
      const showMeta = showByProgramId.get(programId);
      if (!showMeta) {
        return null;
      }
      return {
        task_id: String(request.id),
        show_id: showMeta.id,
        show_title: showMeta.title,
        show_slug: showMeta.slug,
        program_slug: programSlugById.get(programId) ?? "",
        person_id: roleMeta.person_id,
        person_name: person.person_name,
        role_title: person.role_title,
        submission_type: normalizeSubmissionType(String(request.request_type ?? "bio")),
        submission_status: normalizeSubmissionStatus(String(request.status ?? person.fallback_status)),
        due_date: request.due_date ? String(request.due_date) : null,
        submitted_at: person.submitted_at
      } satisfies ContributorTaskSummary;
    })
    .filter((item): item is ContributorTaskSummary => item !== null)
    .sort((a, b) => {
      const showSort = a.show_title.localeCompare(b.show_title);
      if (showSort !== 0) return showSort;
      const nameSort = a.person_name.localeCompare(b.person_name);
      if (nameSort !== 0) return nameSort;
      return a.submission_type.localeCompare(b.submission_type);
    });
}

export async function getContributorTaskById(showId: string, taskId: string) {
  const current = await getCurrentUserWithProfile();
  if (!current?.user?.email) {
    return null;
  }

  const context = await getShowProgramContext(showId);
  if (!context) {
    return null;
  }

  const client = getSupabaseWriteClient();
  const { data: roles } = await client
    .from("show_roles")
    .select("id, person_id, show_id")
    .eq("show_id", showId);
  const roleRows = roles ?? [];
  const roleById = new Map(roleRows.map((row) => [String(row.id), String(row.person_id ?? "")]));

  const { data: requestById } = await client
    .from("submission_requests")
    .select("id, show_role_id, request_type, status, due_date")
    .eq("id", taskId)
    .maybeSingle();

  let resolvedRequestId = "";
  let resolvedRequestType: SubmissionType = "bio";
  let resolvedRequestStatus: ShowSubmissionPerson["submission_status"] = "pending";
  let resolvedDueDate: string | null = null;
  let resolvedPersonId = "";

  if (requestById && roleById.has(String(requestById.show_role_id ?? ""))) {
    resolvedRequestId = String(requestById.id);
    resolvedRequestType = normalizeSubmissionType(String(requestById.request_type ?? "bio"));
    resolvedRequestStatus = normalizeSubmissionStatus(String(requestById.status ?? "pending"));
    resolvedDueDate = requestById.due_date ? String(requestById.due_date) : null;
    resolvedPersonId = roleById.get(String(requestById.show_role_id ?? "")) ?? "";
  } else {
    // Legacy fallback: taskId may be a person id; map to that person's bio request.
    resolvedPersonId = taskId;
    const roleForPerson = roleRows.find((row) => String(row.person_id ?? "") === resolvedPersonId);
    if (!roleForPerson?.id) {
      return null;
    }
    const { data: bioRequest } = await client
      .from("submission_requests")
      .select("id, request_type, status, due_date")
      .eq("show_role_id", String(roleForPerson.id))
      .eq("request_type", "bio")
      .maybeSingle();
    if (!bioRequest?.id) {
      return null;
    }
    resolvedRequestId = String(bioRequest.id);
    resolvedRequestType = normalizeSubmissionType(String(bioRequest.request_type ?? "bio"));
    resolvedRequestStatus = normalizeSubmissionStatus(String(bioRequest.status ?? "pending"));
    resolvedDueDate = bioRequest.due_date ? String(bioRequest.due_date) : null;
  }

  const { data: person } = await client
    .from("people")
    .select("*")
    .eq("id", resolvedPersonId)
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
    .eq("entity_id", resolvedPersonId)
    .eq("field", "return_message")
    .order("changed_at", { ascending: false })
    .limit(1);

  let taskBody = String(person.bio ?? "");
  if (resolvedRequestType !== "bio") {
    const programField = getProgramFieldForSubmissionType(resolvedRequestType);
    if (programField) {
      const { data: program } = await client
        .from("programs")
        .select(programField)
        .eq("id", context.program_id)
        .maybeSingle();
      taskBody = String((program as Record<string, unknown> | null)?.[programField] ?? "");
    } else {
      taskBody = "";
    }
  }

  const row = person as Record<string, unknown>;
  return {
    task_id: resolvedRequestId,
    request_type: resolvedRequestType,
    due_date: resolvedDueDate,
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
      submission_type: resolvedRequestType,
      bio: taskBody,
      no_bio: resolvedRequestType === "bio" ? (rowHasColumn(row, "no_bio") ? Boolean(person.no_bio) : false) : false,
      headshot_url: String(person.headshot_url ?? ""),
      submission_status: resolvedRequestStatus,
      submitted_at: person.submitted_at ? String(person.submitted_at) : null,
      bio_char_count: stripRichTextToPlain(taskBody).length
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
  requestId: string;
  personId: string;
  submissionType: SubmissionType;
  bio: string;
  headshotUrl: string;
  status: ShowSubmissionPerson["submission_status"];
  reason: string;
  skipBio?: boolean;
}) {
  const context = await getShowProgramContext(args.showId);
  if (!context) {
    return { ok: false as const, message: "Show not found." };
  }

  const client = getSupabaseWriteClient();
  const peopleColumns = await getTableColumns(client, "people");
  const { data: person } = await client
    .from("people")
    .select("*")
    .eq("id", args.personId)
    .eq("program_id", context.program_id)
    .single();

  if (!person) {
    return { ok: false as const, message: "Submission task was not found." };
  }

  const row = person as Record<string, unknown>;
  const hasNoBio = rowHasColumn(row, "no_bio");
  const submissionType = args.submissionType;
  const submissionLabel = getSubmissionTypeLabel(submissionType);
  const isBioType = submissionType === "bio";
  const resolvedHeadshotUrl = isBioType ? args.headshotUrl : String(person.headshot_url ?? "");
  const typedBio = sanitizeRichText(args.bio);
  const cleanBio = isBioType && args.skipBio ? "" : typedBio;
  const plainLength = stripRichTextToPlain(typedBio).length;
  if (isBioType && !args.skipBio && (args.status === "submitted" || args.status === "approved" || args.status === "locked") && plainLength === 0) {
    return { ok: false as const, message: `${submissionLabel} is required before submitting.` };
  }

  if (!args.skipBio && plainLength > BIO_CHAR_LIMIT_DEFAULT) {
    return { ok: false as const, message: `${submissionLabel} exceeds ${BIO_CHAR_LIMIT_DEFAULT} character limit.` };
  }

  const nowIso = new Date().toISOString();
  const submittedAt = args.status === "submitted" || args.status === "approved" || args.status === "locked" ? nowIso : null;

  if (isBioType) {
    const { error: updateError } = await client
      .from("people")
      .update(
        filterToColumns(
          {
            bio: cleanBio,
            headshot_url: resolvedHeadshotUrl,
            submission_status: args.status,
            submitted_at: submittedAt,
            no_bio: hasNoBio ? Boolean(args.skipBio) : undefined
          },
          peopleColumns
        )
      )
      .eq("id", args.personId);

    if (updateError) {
      return { ok: false as const, message: updateError.message };
    }
  }

  const updates: Array<{ field: string; before: unknown; after: unknown }> = [];
  if (isBioType && String(person.bio ?? "") !== cleanBio) {
    updates.push({ field: "bio", before: person.bio, after: cleanBio });
  }
  if (isBioType && String(person.headshot_url ?? "") !== resolvedHeadshotUrl) {
    updates.push({ field: "headshot_url", before: person.headshot_url, after: resolvedHeadshotUrl });
  }
  if (isBioType && String(person.submission_status ?? "pending") !== args.status) {
    updates.push({ field: "submission_status", before: person.submission_status, after: args.status });
  }
  if (isBioType && hasNoBio && Boolean(person.no_bio) !== Boolean(args.skipBio)) {
    updates.push({ field: "no_bio", before: Boolean(person.no_bio), after: Boolean(args.skipBio) });
  }

  const programField = getProgramFieldForSubmissionType(submissionType);
  if (programField) {
    let beforeValue: string | null = null;
    if (!isBioType) {
      const { data: existingProgram } = await client
        .from("programs")
        .select(programField)
        .eq("id", context.program_id)
        .maybeSingle();
      beforeValue = String((existingProgram as Record<string, unknown> | null)?.[programField] ?? "");
    }
    const { error: programUpdateError } = await client
      .from("programs")
      .update({ [programField]: cleanBio })
      .eq("id", context.program_id);
    if (programUpdateError) {
      return { ok: false as const, message: programUpdateError.message };
    }
    await writeAuditLog({
      entity: "programs",
      entityId: context.program_id,
      field: programField,
      beforeValue,
      afterValue: cleanBio,
      reason: `${submissionLabel} sync from contributor/admin submission`
    });
  }

  const { error: requestUpdateError } = await client
    .from("submission_requests")
    .update({
      status: args.status,
      updated_at: nowIso
    })
    .eq("id", args.requestId);
  if (requestUpdateError) {
    return { ok: false as const, message: requestUpdateError.message };
  }

  const { data: existingSubmission } = await client
    .from("submissions")
    .select("id")
    .eq("request_id", args.requestId)
    .maybeSingle();
  if (existingSubmission?.id) {
    await client
      .from("submissions")
      .update({
        plain_text: stripRichTextToPlain(cleanBio),
        status: args.status,
        updated_at: nowIso
      })
      .eq("id", String(existingSubmission.id));
  } else {
    await client.from("submissions").insert({
      request_id: args.requestId,
      plain_text: stripRichTextToPlain(cleanBio),
      status: args.status
    });
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

async function getBioRequestForPerson(showId: string, personId: string) {
  const client = getSupabaseWriteClient();
  const { data: role } = await client
    .from("show_roles")
    .select("id")
    .eq("show_id", showId)
    .eq("person_id", personId)
    .maybeSingle();
  if (!role?.id) {
    return null;
  }
  const { data: request } = await client
    .from("submission_requests")
    .select("id, request_type")
    .eq("show_role_id", String(role.id))
    .eq("request_type", "bio")
    .maybeSingle();
  if (!request?.id) {
    return null;
  }
  return {
    requestId: String(request.id),
    requestType: normalizeSubmissionType(String(request.request_type ?? "bio"))
  };
}

export async function contributorSaveTask(showId: string, taskId: string, formData: FormData) {
  "use server";

  const current = await getCurrentUserWithProfile();
  if (!current?.user?.email) {
    redirect("/app/login");
  }

  const task = await getContributorTaskById(showId, taskId);
  if (!task) {
    withError(`/contribute`, "You do not have access to this task.");
  }
  if (task.person.submission_status === "locked" || task.person.submission_status === "approved") {
    withError(`/contribute/shows/${showId}/tasks/${taskId}`, "This submission is read-only.");
  }

  const bio = formData.get("bio")?.toString() ?? "";
  const headshotUrl = formData.get("headshotUrl")?.toString() ?? "";
  const skipBio = String(formData.get("skipBio") ?? "") === "on";
  const intent = formData.get("intent")?.toString() ?? "save";
  const nextStatus: ShowSubmissionPerson["submission_status"] = intent === "submit" ? "submitted" : "draft";
  const result = await updateSubmissionCore({
    showId,
    requestId: String(task.task_id ?? ""),
    personId: task.person.id,
    submissionType: task.person.submission_type,
    bio,
    headshotUrl,
    status: nextStatus,
    reason: intent === "submit" ? "contributor submit" : "contributor save",
    skipBio
  });

  if (!result.ok) {
    withError(`/contribute/shows/${showId}/tasks/${taskId}`, result.message);
  }

  redirect(`/contribute/shows/${showId}/tasks/${taskId}?saved=1`);
}

export async function getShowSubmissionByPerson(showId: string, personId: string) {
  const context = await getShowProgramContext(showId);
  if (!context) {
    return null;
  }

  const client = getSupabaseWriteClient();
  const { data: person } = await client
    .from("people")
    .select("*")
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

  const row = person as Record<string, unknown>;
  return {
    show: context,
    person: {
      id: String(person.id),
      full_name: String(person.full_name ?? ""),
      role_title: String(person.role_title ?? ""),
      team_type: person.team_type === "cast" ? "cast" : "production",
      email: String(person.email ?? ""),
      submission_type: rowHasColumn(row, "submission_type")
        ? normalizeSubmissionType(String(person.submission_type ?? "bio"))
        : inferSubmissionTypeFromRole(String(person.role_title ?? "")),
      bio: String(person.bio ?? ""),
      no_bio: rowHasColumn(row, "no_bio") ? Boolean(person.no_bio) : false,
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
      reason: formData.get("reason"),
      skipBio: String(formData.get("skipBio") ?? "") === "on"
    });
  } catch {
    withError(`/app/shows/${showId}/submissions/${personId}`, "Invalid review payload.");
  }

  const requestInfo = await getBioRequestForPerson(showId, personId);
  if (!requestInfo) {
    withError(`/app/shows/${showId}/submissions/${personId}`, "Bio request not found for this person.");
  }

  const result = await updateSubmissionCore({
    showId,
    requestId: requestInfo.requestId,
    personId,
    submissionType: requestInfo.requestType,
    bio: parsed.bio ?? "",
    headshotUrl: parsed.headshotUrl ?? "",
    status: parsed.status,
    reason: parsed.reason || "admin review edit",
    skipBio: Boolean(parsed.skipBio)
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

  const requestInfo = await getBioRequestForPerson(showId, personId);
  if (!requestInfo) {
    withError(`/app/shows/${showId}?tab=submissions`, "Bio request not found for this person.");
  }

  const result = await updateSubmissionCore({
    showId,
    requestId: requestInfo.requestId,
    personId,
    submissionType: requestInfo.requestType,
    bio: current.person.bio,
    headshotUrl: current.person.headshot_url,
    status: "returned",
    reason: message,
    skipBio: current.person.no_bio
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

  const requestInfo = await getBioRequestForPerson(showId, personId);
  if (!requestInfo) {
    withError(`/app/shows/${showId}?tab=submissions`, "Bio request not found for this person.");
  }

  const result = await updateSubmissionCore({
    showId,
    requestId: requestInfo.requestId,
    personId,
    submissionType: requestInfo.requestType,
    bio: current.person.bio,
    headshotUrl: current.person.headshot_url,
    status,
    reason: `admin quick status -> ${status}`,
    skipBio: current.person.no_bio
  });
  if (!result.ok) {
    withError(`/app/shows/${showId}?tab=submissions`, result.message);
  }

  redirect(`/app/shows/${showId}?tab=submissions`);
}

export async function importBiosFromCsv(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const csvFile = formData.get("bioCsvFile");
  if (!(csvFile instanceof File)) {
    withError(`/app/shows/${showId}?tab=submissions`, "CSV file is required.");
  }

  const text = await csvFile.text();
  let rows: Array<{ email?: string; name?: string; role?: string; bio: string }> = [];
  try {
    rows = parseBioImportCsv(text);
  } catch (error) {
    withError(
      `/app/shows/${showId}?tab=submissions`,
      error instanceof Error ? error.message : "Could not parse bio CSV."
    );
  }

  if (rows.length === 0) {
    withError(`/app/shows/${showId}?tab=submissions`, "No bio rows found in CSV.");
  }

  const context = await getShowProgramContext(showId);
  if (!context) {
    withError("/app/shows", "Show was not found.");
  }

  const client = getSupabaseWriteClient();
  const peopleColumns = await getTableColumns(client, "people");
  const { data: peopleRows } = await client
    .from("people")
    .select("id, full_name, role_title, email, bio, submission_status")
    .eq("program_id", context.program_id);

  const people = (peopleRows ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    role_title: String(row.role_title ?? ""),
    email: String(row.email ?? ""),
    bio: String(row.bio ?? ""),
    submission_status: normalizeSubmissionStatus(String(row.submission_status ?? "pending"))
  }));

  const byEmail = new Map<string, typeof people[number]>();
  const byNameRole = new Map<string, typeof people[number]>();
  const byName = new Map<string, Array<typeof people[number]>>();
  for (const person of people) {
    const emailKey = normalizeEmail(person.email);
    if (emailKey && !byEmail.has(emailKey)) {
      byEmail.set(emailKey, person);
    }
    const nameRoleKey = `${normalizeName(person.full_name)}::${normalizeName(person.role_title)}`;
    if (nameRoleKey && !byNameRole.has(nameRoleKey)) {
      byNameRole.set(nameRoleKey, person);
    }
    const nameKey = normalizeName(person.full_name);
    if (nameKey) {
      const list = byName.get(nameKey) ?? [];
      list.push(person);
      byName.set(nameKey, list);
    }
  }

  let updated = 0;
  let unchanged = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    let person: (typeof people)[number] | undefined;
    const normalizedRowEmail = row.email && isValidEmail(row.email) ? normalizeEmail(row.email) : "";
    if (normalizedRowEmail) {
      person = byEmail.get(normalizedRowEmail);
    }
    if (!person && row.email && !normalizedRowEmail) {
      // Invalid email values are ignored so name+role fallback can still match.
    }
    const rowName = row.name ? normalizeName(row.name) : "";
    const rowRole = row.role ? normalizeName(row.role) : "";
    if (!person && rowName && rowRole) {
      person = byNameRole.get(`${rowName}::${rowRole}`);
    }
    if (!person && rowName) {
      const candidates = byName.get(rowName) ?? [];
      if (candidates.length === 1) {
        person = candidates[0];
      } else if (candidates.length > 1 && rowRole) {
        person =
          candidates.find((candidate) => {
            const candidateRole = normalizeName(candidate.role_title);
            return candidateRole.includes(rowRole) || rowRole.includes(candidateRole);
          }) ?? undefined;
      }
    }
    if (!person) {
      unmatched.push(row.email || `${row.name ?? "Unknown"} | ${row.role ?? "Unknown role"}`);
      continue;
    }

    const cleanBio = sanitizeRichText(row.bio);
    if (!cleanBio) {
      unchanged += 1;
      continue;
    }
    if (cleanBio === person.bio) {
      unchanged += 1;
      continue;
    }

    const { error: updateError } = await client
      .from("people")
      .update(
        filterToColumns(
          {
            bio: cleanBio,
            submission_status: "submitted",
            submitted_at: new Date().toISOString(),
            no_bio: false
          },
          peopleColumns
        )
      )
      .eq("id", person.id);
    if (updateError) {
      unmatched.push(row.email || `${row.name ?? "Unknown"} | ${row.role ?? "Unknown role"}`);
      continue;
    }

    await writeAuditLog({
      entity: "people",
      entityId: person.id,
      field: "bio",
      beforeValue: person.bio,
      afterValue: cleanBio,
      reason: "bio_csv_import"
    });
    await writeAuditLog({
      entity: "people",
      entityId: person.id,
      field: "submission_status",
      beforeValue: person.submission_status,
      afterValue: "submitted",
      reason: "bio_csv_import"
    });
    updated += 1;
  }

  const parts = [`Bio import complete: ${updated} updated`];
  if (unchanged > 0) {
    parts.push(`${unchanged} unchanged`);
  }
  if (unmatched.length > 0) {
    const sample = unmatched.slice(0, 3).join("; ");
    parts.push(`${unmatched.length} unmatched${sample ? ` (examples: ${sample})` : ""}`);
  }
  if (updated === 0) {
    withError(
      `/app/shows/${showId}?tab=submissions`,
      `No bios were imported. ${parts.join(", ")}.`
    );
  }

  redirect(`/app/shows/${showId}?tab=submissions&success=${encodeURIComponent(parts.join(", ") + ".")}`);
}
