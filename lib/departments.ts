import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { sanitizeRichText } from "@/lib/rich-text";
import { getMissingSupabaseEnvVars, getSupabaseWriteClient } from "@/lib/supabase";

export type DepartmentRecord = {
  id: string;
  name: string;
  description: string;
  website: string;
  contact_email: string;
  contact_phone: string;
};

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}?${qp.toString()}`);
}

function renderDepartmentBlock(department: DepartmentRecord) {
  const lines: string[] = [];
  if (department.description.trim()) {
    lines.push(department.description.trim());
  }
  if (department.website.trim()) {
    lines.push(`<a href="${department.website.trim()}">${department.website.trim()}</a>`);
  }
  if (department.contact_email.trim()) {
    lines.push(`<a href="mailto:${department.contact_email.trim()}">${department.contact_email.trim()}</a>`);
  }
  if (department.contact_phone.trim()) {
    lines.push(department.contact_phone.trim());
  }
  const body = lines.length > 0 ? lines.map((line) => `<p>${line}</p>`).join("") : "<p>Department details coming soon.</p>";
  return `<section><h3>${department.name.trim()}</h3>${body}</section>`;
}

export function buildDepartmentInfoHtml(departments: DepartmentRecord[]) {
  if (departments.length === 0) {
    return "";
  }
  return sanitizeRichText(departments.map((department) => renderDepartmentBlock(department)).join(""));
}

export async function getDepartmentRepository() {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return [] as DepartmentRecord[];
  }

  try {
    const client = getSupabaseWriteClient();
    const { data, error } = await client
      .from("departments")
      .select("id, name, description, website, contact_email, contact_phone")
      .order("name", { ascending: true });
    if (error || !data) {
      return [] as DepartmentRecord[];
    }
    return data.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      website: String(row.website ?? ""),
      contact_email: String(row.contact_email ?? ""),
      contact_phone: String(row.contact_phone ?? "")
    })) as DepartmentRecord[];
  } catch {
    return [] as DepartmentRecord[];
  }
}

export async function getShowDepartmentSelection(showId: string) {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return [] as string[];
  }

  try {
    const client = getSupabaseWriteClient();
    const { data, error } = await client
      .from("show_departments")
      .select("department_id, sort_order")
      .eq("show_id", showId)
      .order("sort_order", { ascending: true });
    if (error || !data) {
      return [] as string[];
    }
    return data.map((row) => String(row.department_id ?? "")).filter(Boolean);
  } catch {
    return [] as string[];
  }
}

export async function createDepartment(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/shows", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const showId = String(formData.get("showId") ?? "").trim();
  if (!showId) {
    withError("/app/shows", "Show context is missing.");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    withError(`/app/shows/${showId}?tab=settings`, "Department name is required.");
  }

  const website = String(formData.get("website") ?? "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    withError(`/app/shows/${showId}?tab=settings`, "Department website must begin with http:// or https://");
  }

  const client = getSupabaseWriteClient();
  const { error } = await client.from("departments").insert({
    name,
    description: sanitizeRichText(String(formData.get("description") ?? "")),
    website,
    contact_email: String(formData.get("contactEmail") ?? "").trim().toLowerCase(),
    contact_phone: String(formData.get("contactPhone") ?? "").trim()
  });

  if (error) {
    withError(`/app/shows/${showId}?tab=settings`, error.message);
  }

  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Department created.")}`);
}

export async function updateShowDepartments(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const selectedDepartmentIds = formData
    .getAll("departmentIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, program_id")
    .eq("id", showId)
    .single();
  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  const { error: deleteError } = await client.from("show_departments").delete().eq("show_id", showId);
  if (deleteError) {
    withError(`/app/shows/${showId}?tab=settings`, deleteError.message);
  }

  if (selectedDepartmentIds.length > 0) {
    const { error: insertError } = await client.from("show_departments").insert(
      selectedDepartmentIds.map((departmentId, index) => ({
        show_id: showId,
        department_id: departmentId,
        sort_order: index
      }))
    );
    if (insertError) {
      withError(`/app/shows/${showId}?tab=settings`, insertError.message);
    }
  }

  const { data: departments } = selectedDepartmentIds.length
    ? await client
        .from("departments")
        .select("id, name, description, website, contact_email, contact_phone")
        .in("id", selectedDepartmentIds)
    : { data: [] as Array<Record<string, unknown>> };

  const order = new Map(selectedDepartmentIds.map((id, index) => [id, index]));
  const selected = (departments ?? [])
    .map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      website: String(row.website ?? ""),
      contact_email: String(row.contact_email ?? ""),
      contact_phone: String(row.contact_phone ?? "")
    }))
    .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));

  const departmentInfoHtml = buildDepartmentInfoHtml(selected);

  if (show.program_id) {
    const { error: programError } = await client
      .from("programs")
      .update({ department_info: departmentInfoHtml })
      .eq("id", show.program_id);
    if (programError) {
      withError(`/app/shows/${showId}?tab=settings`, programError.message);
    }
  }

  await client.from("shows").update({ updated_at: new Date().toISOString() }).eq("id", showId);

  redirect(
    `/app/shows/${showId}?tab=settings&success=${encodeURIComponent(
      selectedDepartmentIds.length > 0
        ? "Show departments updated."
        : "No departments selected. Department Information is now empty for this show."
    )}`
  );
}
