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
