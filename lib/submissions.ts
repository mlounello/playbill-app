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
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  preferredName: z.string().optional(),
  pronouns: z.string().optional()
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
      const teamType = inferTeamTypeFromRole(role);

      return manualPersonSchema.parse({
        fullName,
        roleTitle: role,
        teamType,
        email,
        firstName: first,
        lastName: last,
        preferredName: preferred,
        pronouns
      });
    });
  }

  return lines.map((line) => {
    const [fullName = "", roleTitle = "", teamTypeRaw = "production", email = ""] = line.split("|").map((part) => part.trim());
    return manualPersonSchema.parse({
      fullName,
      roleTitle,
      teamType: teamTypeRaw.toLowerCase() === "cast" ? "cast" : "production",
      email
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
    const teamType = inferTeamTypeFromRole(role);

    return manualPersonSchema.parse({
      fullName,
      roleTitle: role,
      teamType,
      email,
      firstName: first,
      lastName: last,
      preferredName: preferred,
      pronouns
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
          teamType: formData.get("teamType"),
          email: formData.get("email")
        })
      ];
    }
  } catch (error) {
    withError(
      `/app/shows/${showId}?tab=people-roles`,
      error instanceof Error
        ? error.message
        : "Invalid person data. Use Name | Role | cast|production | email for bulk rows, or the required CSV headers."
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
  const insertRows = records.map((record) =>
    filterToColumns(
      {
        program_id: context.program_id,
        full_name: record.fullName.trim(),
        role_title: record.roleTitle.trim(),
        team_type: record.teamType,
        email: normalizeEmail(record.email),
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

export async function bulkEditPeopleField(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const lookupFieldRaw = String(formData.get("lookupField") ?? "");
  const editsText = String(formData.get("editsText") ?? "");
  const selectedTargetFields = formData
    .getAll("targetFields")
    .map((value) => String(value))
    .filter((value) => ["full_name", "role_title", "team_type", "email"].includes(value)) as Array<
    "full_name" | "role_title" | "team_type" | "email"
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
    .select("id, full_name, role_title, team_type, email")
    .eq("program_id", context.program_id);

  const people: Array<{
    id: string;
    full_name: string;
    role_title: string;
    team_type: "cast" | "production";
    email: string;
  }> = (peopleRows ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    role_title: String(row.role_title ?? ""),
    team_type: row.team_type === "cast" ? "cast" : "production",
    email: String(row.email ?? "")
  }));

  const mapByLookup = new Map<string, { id: string; full_name: string; role_title: string; team_type: "cast" | "production"; email: string }>();
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

    const updates = new Map<"full_name" | "role_title" | "team_type" | "email", string>();

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
              : person.email;

      if (field === "team_type") {
        const lowered = rawValue.toLowerCase();
        if (lowered !== "cast" && lowered !== "production") {
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

      if (currentValue === nextValue) {
        continue;
      }

      peopleUpdate[field] = nextValue;
      auditEntries.push({ field, beforeValue: currentValue, afterValue: nextValue });

      if (field === "role_title") {
        nextRoleName = nextValue;
      }
      if (field === "team_type") {
        nextRoleCategory = nextValue === "cast" ? "cast" : "production";
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
  const enabledCount = [enableFullName, enableRoleTitle, enableTeamType, enableEmail].filter(Boolean).length;
  if (enabledCount === 0) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Enable at least one field to update.");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const teamType = String(formData.get("teamType") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim();

  if (enableFullName && !fullName) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Full Name is required when enabled.");
  }
  if (enableRoleTitle && !roleTitle) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Role Title is required when enabled.");
  }
  if (enableTeamType && !["cast", "production"].includes(teamType)) {
    withError(`/app/shows/${showId}?tab=people-roles`, "Category must be cast or production.");
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
    .select("id, full_name, role_title, team_type, email")
    .eq("program_id", context.program_id)
    .in("id", selectedIds);

  const people = (peopleRows ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    role_title: String(row.role_title ?? ""),
    team_type: row.team_type === "cast" ? "cast" : "production",
    email: String(row.email ?? "")
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
      peopleUpdate.team_type = teamType;
      audits.push({ field: "team_type", beforeValue: person.team_type, afterValue: teamType });
    }
    if (enableEmail && normalizeEmail(person.email) !== normalizedEmail) {
      peopleUpdate.email = normalizedEmail;
      audits.push({ field: "email", beforeValue: person.email, afterValue: normalizedEmail });
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
        .update({ category: teamType === "cast" ? "cast" : "production" })
        .eq("show_id", showId)
        .eq("person_id", person.id);
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
