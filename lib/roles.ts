import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getMissingSupabaseEnvVars, getSupabaseWriteClient } from "@/lib/supabase";

export type RoleCategory = "cast" | "creative" | "production";
export type RoleScope = "global" | "show_only";

export type RoleTemplateRecord = {
  id: string;
  name: string;
  category: RoleCategory;
  scope: RoleScope;
  show_id: string | null;
  show_title: string;
  is_hidden: boolean;
  created_at: string;
};

export type RoleLibraryData = {
  roles: RoleTemplateRecord[];
  shows: Array<{ id: string; title: string }>;
  selectedShowId: string;
};

type RoleTemplateImportRow = {
  name: string;
  category: RoleCategory;
  scope: RoleScope;
  show_id: string | null;
};

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}?${qp.toString()}`);
}

function withSuccess(path: string, message: string): never {
  const qp = new URLSearchParams({ success: message });
  redirect(`${path}?${qp.toString()}`);
}

function normalizeCategory(value: string): RoleCategory {
  const lowered = value.trim().toLowerCase();
  if (lowered === "cast") return "cast";
  if (lowered === "creative") return "creative";
  return "production";
}

function normalizeScope(value: string): RoleScope {
  const lowered = value.trim().toLowerCase();
  if (lowered === "show_only") return "show_only";
  return "global";
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
    if (direct >= 0) return direct;
  }
  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    const header = normalizedHeaders[i];
    if (normalizedVariants.some((variant) => header.includes(variant))) {
      return i;
    }
  }
  return -1;
}

function dedupeRoleTemplateRows(rows: RoleTemplateImportRow[]) {
  const seen = new Set<string>();
  const ordered: RoleTemplateImportRow[] = [];
  for (const row of rows) {
    const key = `${row.name.trim().toLowerCase()}|${row.category}|${row.scope}|${row.show_id ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(row);
    }
  }
  return ordered;
}

async function upsertRoleTemplates(rows: RoleTemplateImportRow[]) {
  const client = getSupabaseWriteClient();
  let created = 0;
  let reactivated = 0;
  let failed = 0;

  for (const row of rows) {
    const existingQuery = client
      .from("role_templates")
      .select("id, is_hidden")
      .eq("name", row.name)
      .eq("category", row.category)
      .eq("scope", row.scope);
    const existingRows = row.show_id
      ? await existingQuery.eq("show_id", row.show_id).limit(1)
      : await existingQuery.is("show_id", null).limit(1);
    const existing = existingRows.data?.[0]
      ? { id: String(existingRows.data[0].id) }
      : null;

    if (existing?.id) {
      await client
        .from("role_templates")
        .update({
          is_hidden: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      reactivated += 1;
      continue;
    }

    const { error } = await client.from("role_templates").insert({
      name: row.name,
      category: row.category,
      scope: row.scope,
      show_id: row.scope === "show_only" ? row.show_id : null,
      is_hidden: false,
      updated_at: new Date().toISOString()
    });
    if (!error) {
      created += 1;
    } else {
      failed += 1;
    }
  }

  return { created, reactivated, failed };
}

export async function getRoleLibraryData(selectedShowId = ""): Promise<RoleLibraryData> {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return { roles: [], shows: [], selectedShowId: "" };
  }

  try {
    const client = getSupabaseWriteClient();
    const { data: showRows } = await client.from("shows").select("id, title").order("title", { ascending: true });
    const shows = (showRows ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "Untitled Show")
    }));

    const resolvedShowId = selectedShowId || "";
    const { data: roleRows } = await client
      .from("role_templates")
      .select("id, name, category, scope, show_id, is_hidden, created_at")
      .order("is_hidden", { ascending: true })
      .order("name", { ascending: true });

    const showTitleById = new Map(shows.map((show) => [show.id, show.title]));
    const roles = (roleRows ?? [])
      .map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        category: normalizeCategory(String(row.category ?? "production")),
        scope: normalizeScope(String(row.scope ?? "global")),
        show_id: row.show_id ? String(row.show_id) : null,
        show_title: row.show_id ? showTitleById.get(String(row.show_id)) ?? "" : "",
        is_hidden: Boolean(row.is_hidden),
        created_at: String(row.created_at ?? "")
      }))
      .filter((role) => (resolvedShowId ? role.scope === "global" || role.show_id === resolvedShowId : true));

    return {
      roles,
      shows,
      selectedShowId: resolvedShowId
    };
  } catch {
    return { roles: [], shows: [], selectedShowId: "" };
  }
}

export async function createRoleTemplate(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/roles", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = normalizeCategory(String(formData.get("category") ?? "production"));
  const scope = normalizeScope(String(formData.get("scope") ?? "global"));
  const showId = String(formData.get("showId") ?? "").trim();

  if (!name) {
    withError("/app/roles", "Role name is required.");
  }
  if (scope === "show_only" && !showId) {
    withError("/app/roles", "Show is required for show-only roles.");
  }

  const client = getSupabaseWriteClient();
  const payload = {
    name,
    category,
    scope,
    show_id: scope === "show_only" ? showId : null,
    is_hidden: false,
    updated_at: new Date().toISOString()
  };

  const existingScoped = scope === "show_only"
    ? await client
        .from("role_templates")
        .select("id")
        .eq("name", name)
        .eq("category", category)
        .eq("scope", scope)
        .eq("show_id", showId)
        .maybeSingle()
    : await client
        .from("role_templates")
        .select("id")
        .eq("name", name)
        .eq("category", category)
        .eq("scope", scope)
        .is("show_id", null)
        .maybeSingle();

  if (existingScoped.data?.id) {
    const existingId = String(existingScoped.data.id);
    await client.from("role_templates").update(payload).eq("id", existingId);
    withSuccess("/app/roles", "Role already existed and was reactivated.");
  }

  const { error } = await client.from("role_templates").insert(payload);
  if (error) {
    withError("/app/roles", error.message);
  }

  withSuccess("/app/roles", "Role created.");
}

export async function updateRoleTemplate(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = normalizeCategory(String(formData.get("category") ?? "production"));
  const scope = normalizeScope(String(formData.get("scope") ?? "global"));
  const showId = String(formData.get("showId") ?? "").trim();
  const isHidden = String(formData.get("isHidden") ?? "") === "on";

  if (!id || !name) {
    withError("/app/roles", "Role id and name are required.");
  }
  if (scope === "show_only" && !showId) {
    withError("/app/roles", "Show is required for show-only roles.");
  }

  const client = getSupabaseWriteClient();
  const { error } = await client
    .from("role_templates")
    .update({
      name,
      category,
      scope,
      show_id: scope === "show_only" ? showId : null,
      is_hidden: isHidden,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    withError("/app/roles", error.message);
  }

  withSuccess("/app/roles", "Role updated.");
}

export async function deleteRoleTemplate(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    withError("/app/roles", "Role id is required.");
  }

  const client = getSupabaseWriteClient();
  await client.from("show_roles").update({ role_template_id: null }).eq("role_template_id", id);
  const { error } = await client.from("role_templates").delete().eq("id", id);

  if (error) {
    withError("/app/roles", error.message);
  }

  withSuccess("/app/roles", "Role deleted.");
}

export async function hideShowOnlyCastRoleTemplatesForShow(showId: string) {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return;
  }

  const client = getSupabaseWriteClient();
  await client
    .from("role_templates")
    .update({ is_hidden: true, updated_at: new Date().toISOString() })
    .eq("show_id", showId)
    .eq("scope", "show_only")
    .eq("category", "cast");
}

export async function importRolesFromPaste(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/roles", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const raw = String(formData.get("rows") ?? "").trim();
  if (!raw) {
    withError("/app/roles", "Paste rows are required.");
  }

  const client = getSupabaseWriteClient();
  const { data: shows } = await client.from("shows").select("id, title, slug");
  const showByAnyKey = new Map<string, string>();
  const showRowsNormalized = (shows ?? []).map((show) => ({
    id: String(show.id ?? ""),
    title: String(show.title ?? "").trim().toLowerCase(),
    slug: String(show.slug ?? "").trim().toLowerCase()
  }));
  for (const show of shows ?? []) {
    const id = String(show.id ?? "");
    const title = String(show.title ?? "").trim().toLowerCase();
    const slug = String(show.slug ?? "").trim().toLowerCase();
    if (id) showByAnyKey.set(id.toLowerCase(), id);
    if (title) showByAnyKey.set(title, id);
    if (slug) showByAnyKey.set(slug, id);
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    withError("/app/roles", "Paste rows are required.");
  }

  const headerCols = lines[0].includes("|") ? lines[0].split("|").map((v) => v.trim()) : parseCsvRow(lines[0]);
  const roleIdx = findHeaderIndex(headerCols, ["role", "role name", "name"]);
  const categoryIdx = findHeaderIndex(headerCols, ["category"]);
  const scopeIdx = findHeaderIndex(headerCols, ["scope"]);
  const showIdx = findHeaderIndex(headerCols, ["show", "show id", "show slug"]);
  const looksLikeHeader = roleIdx >= 0 && categoryIdx >= 0;

  const dataLines = looksLikeHeader ? lines.slice(1) : lines;
  const parsedRows: RoleTemplateImportRow[] = [];

  let skippedMissingShow = 0;
  for (const line of dataLines) {
    const cols = line.includes("|") ? line.split("|").map((v) => v.trim()) : parseCsvRow(line);
    const roleName = looksLikeHeader ? String(cols[roleIdx] ?? "").trim() : String(cols[0] ?? "").trim();
    const categoryRaw = looksLikeHeader ? String(cols[categoryIdx] ?? "") : String(cols[1] ?? "");
    const scopeRaw = looksLikeHeader ? String(cols[scopeIdx] ?? "") : String(cols[2] ?? "");
    const showRaw = looksLikeHeader ? String(cols[showIdx] ?? "") : String(cols[3] ?? "");
    if (!roleName) continue;
    const category = normalizeCategory(categoryRaw || "production");
    const scope = normalizeScope(scopeRaw || (category === "cast" ? "show_only" : "global"));
    const showNeedle = showRaw.trim().toLowerCase();
    let showResolved = showRaw ? showByAnyKey.get(showNeedle) ?? null : null;
    if (!showResolved && showNeedle) {
      const fuzzy = showRowsNormalized.find((show) => show.title.includes(showNeedle) || show.slug.includes(showNeedle));
      showResolved = fuzzy?.id ?? null;
    }
    if (scope === "show_only" && !showResolved) {
      skippedMissingShow += 1;
      continue;
    }
    parsedRows.push({
      name: roleName,
      category,
      scope,
      show_id: scope === "show_only" ? showResolved : null
    });
  }

  const rows = dedupeRoleTemplateRows(parsedRows);
  if (rows.length === 0) {
    withError(
      "/app/roles",
      "No valid rows found. Use: role|category|scope|show (scope/show optional; cast defaults to show_only with a valid show)."
    );
  }

  const result = await upsertRoleTemplates(rows);
  withSuccess(
    "/app/roles",
    `Imported roles from paste/CSV. Created ${result.created}, reactivated ${result.reactivated}, failed ${result.failed}, skipped missing show ${skippedMissingShow}.`
  );
}
