import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getMissingSupabaseEnvVars, getSupabaseWriteClient } from "@/lib/supabase";

export type ShowSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  venue: string;
  submission_total: number;
  submission_submitted: number;
  program_slug: string | null;
  is_published: boolean;
  published_at: string | null;
};

export type ShowModule = {
  id: string;
  module_type: string;
  display_title: string;
  module_order: number;
  visible: boolean;
  filler_eligible: boolean;
  settings: Record<string, unknown>;
};

export type ShowDetail = ShowSummary & {
  modules: ShowModule[];
};

export type ShowExportSummary = {
  id: string;
  export_type: string;
  status: string;
  file_path: string;
  created_at: string;
  completed_at: string | null;
};

const createShowSchema = z.object({
  title: z.string().min(1),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  venue: z.string().optional().or(z.literal("")),
  seasonTag: z.string().optional().or(z.literal("")),
  slug: z.string().optional().or(z.literal(""))
});

const modulePayloadSchema = z.object({
  module_type: z.string().min(1),
  display_title: z.string().optional().or(z.literal("")),
  visible: z.boolean(),
  filler_eligible: z.boolean(),
  settings: z.record(z.unknown()).optional()
});

export const moduleToProgramTokens: Record<string, string[]> = {
  cover: ["poster"],
  production_info: [],
  cast_list: ["cast_bios"],
  creative_team: ["team_bios"],
  production_team: ["team_bios"],
  bios: ["cast_bios", "team_bios"],
  director_note: ["director_note"],
  acts_scenes: ["acts_songs"],
  songs: ["acts_songs"],
  headshots_grid: ["production_photos"],
  sponsors: ["acknowledgements"],
  special_thanks: ["acknowledgements"],
  back_cover: ["season_calendar"]
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatShowDates(startDate?: string, endDate?: string) {
  const start = startDate?.trim();
  const end = endDate?.trim();
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || "TBD";
}

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}?${qp.toString()}`);
}

function buildProgramLayoutTokens(modules: Array<z.infer<typeof modulePayloadSchema>>) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const module of modules) {
    if (!module.visible) {
      continue;
    }

    for (const token of moduleToProgramTokens[module.module_type] ?? []) {
      if (!seen.has(token)) {
        seen.add(token);
        ordered.push(token);
      }
    }
  }

  return ordered;
}

export function getProgramTokensFromShowModules(modules: ShowModule[]) {
  const mapped = modules.map((module) => ({
    module_type: module.module_type,
    display_title: module.display_title,
    visible: module.visible,
    filler_eligible: module.filler_eligible,
    settings: module.settings
  }));
  return buildProgramLayoutTokens(mapped);
}

export async function createShow(formData: FormData) {
  "use server";

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/shows/new", `Supabase is not configured: ${missing.join(", ")}`);
  }

  let parsed: z.infer<typeof createShowSchema>;
  try {
    parsed = createShowSchema.parse({
      title: formData.get("title"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      venue: formData.get("venue"),
      seasonTag: formData.get("seasonTag"),
      slug: formData.get("slug")
    });
  } catch {
    withError("/app/shows/new", "Please fill in the required fields.");
  }

  const client = getSupabaseWriteClient();
  const slugBase = parsed.slug ? slugify(parsed.slug) : slugify(parsed.title);
  const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

  const showDates = formatShowDates(parsed.startDate, parsed.endDate);

  const { data: program, error: programError } = await client
    .from("programs")
    .insert({
      title: parsed.title,
      slug,
      theatre_name: parsed.venue ?? "",
      show_dates: showDates
    })
    .select("id, slug")
    .single();

  if (programError || !program) {
    withError("/app/shows/new", programError?.message ?? "Could not create base program.");
  }

  const { data: show, error: showError } = await client
    .from("shows")
    .insert({
      title: parsed.title,
      slug,
      program_id: program.id,
      start_date: parsed.startDate || null,
      end_date: parsed.endDate || null,
      venue: parsed.venue ?? "",
      season_tag: parsed.seasonTag ?? "",
      status: "draft"
    })
    .select("id")
    .single();

  if (showError || !show) {
    withError("/app/shows/new", showError?.message ?? "Could not create show.");
  }

  await client.from("show_style_settings").upsert({
    show_id: show.id,
    title_font: "Oswald",
    body_font: "Merriweather",
    section_title_color: "#006b54",
    body_color: "#000000",
    bio_name_color: "#006b54",
    section_title_size_pt: 14,
    body_size_pt: 10,
    bio_name_size_pt: 11,
    safe_margin_in: 0.5,
    density_mode: "normal"
  });

  const defaultModules = [
    "cover",
    "production_info",
    "cast_list",
    "creative_team",
    "production_team",
    "bios",
    "director_note",
    "acts_scenes",
    "songs",
    "headshots_grid",
    "sponsors",
    "special_thanks",
    "back_cover"
  ];

  await client.from("program_modules").insert(
    defaultModules.map((module, index) => ({
      show_id: show.id,
      module_type: module,
      display_title: module.replace(/_/g, " "),
      module_order: index,
      visible: true,
      filler_eligible: ["bios", "special_thanks", "sponsors"].includes(module)
    }))
  );

  redirect(`/app/shows/${show.id}`);
}

export async function getShowsForDashboard() {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return [] as ShowSummary[];
  }

  try {
    const client = getSupabaseWriteClient();
    const { data: shows } = await client
      .from("shows")
      .select("id, title, slug, status, start_date, end_date, venue, program_id, is_published, published_at")
      .order("created_at", { ascending: false });

    const { data: programs } = await client.from("programs").select("id, slug");
    const { data: people } = await client.from("people").select("program_id, submission_status");

    const programSlugById = new Map<string, string>();
    for (const p of programs ?? []) {
      programSlugById.set(String(p.id), String(p.slug));
    }

    const submissionByProgram = new Map<string, { total: number; submitted: number }>();
    for (const row of people ?? []) {
      const pid = String(row.program_id ?? "");
      const current = submissionByProgram.get(pid) ?? { total: 0, submitted: 0 };
      current.total += 1;
      if (String(row.submission_status ?? "") === "submitted") {
        current.submitted += 1;
      }
      submissionByProgram.set(pid, current);
    }

    return (shows ?? []).map((show) => {
      const programId = String(show.program_id ?? "");
      const sub = submissionByProgram.get(programId) ?? { total: 0, submitted: 0 };
      return {
        id: String(show.id),
        title: String(show.title),
        slug: String(show.slug),
        status: String(show.status ?? "draft"),
        start_date: show.start_date ? String(show.start_date) : null,
        end_date: show.end_date ? String(show.end_date) : null,
        venue: String(show.venue ?? ""),
        submission_total: sub.total,
        submission_submitted: sub.submitted,
        program_slug: programSlugById.get(programId) ?? String(show.slug),
        is_published: Boolean(show.is_published),
        published_at: show.published_at ? String(show.published_at) : null
      };
    }) as ShowSummary[];
  } catch {
    return [] as ShowSummary[];
  }
}

export async function getShowById(showId: string) {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return null;
  }

  try {
    const client = getSupabaseWriteClient();
    const { data: show, error } = await client
      .from("shows")
      .select("id, title, slug, status, start_date, end_date, venue, program_id, is_published, published_at")
      .eq("id", showId)
      .single();

    if (error || !show) {
      return null;
    }

    const programId = String(show.program_id ?? "");
    const { data: program } = await client.from("programs").select("slug").eq("id", programId).single();
    const { data: people } = await client.from("people").select("submission_status").eq("program_id", programId);
    const { data: modules } = await client
      .from("program_modules")
      .select("id, module_type, display_title, module_order, visible, filler_eligible, settings")
      .eq("show_id", showId)
      .order("module_order", { ascending: true });

    const total = (people ?? []).length;
    const submitted = (people ?? []).filter((row) => String(row.submission_status ?? "") === "submitted").length;

    return {
      id: String(show.id),
      title: String(show.title),
      slug: String(show.slug),
      status: String(show.status ?? "draft"),
      start_date: show.start_date ? String(show.start_date) : null,
      end_date: show.end_date ? String(show.end_date) : null,
      venue: String(show.venue ?? ""),
      submission_total: total,
      submission_submitted: submitted,
      program_slug: program?.slug ? String(program.slug) : String(show.slug),
      is_published: Boolean(show.is_published),
      published_at: show.published_at ? String(show.published_at) : null,
      modules: (modules ?? []).map((mod) => ({
        id: String(mod.id),
        module_type: String(mod.module_type),
        display_title: String(mod.display_title ?? ""),
        module_order: Number(mod.module_order ?? 0),
        visible: Boolean(mod.visible),
        filler_eligible: Boolean(mod.filler_eligible),
        settings: (mod.settings as Record<string, unknown>) ?? {}
      }))
    } satisfies ShowDetail;
  } catch {
    return null;
  }
}

export async function updateShowModules(showId: string, formData: FormData) {
  "use server";

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=program-plan`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const rawPayload = formData.get("modulesPayload")?.toString() ?? "[]";
  let modules: Array<z.infer<typeof modulePayloadSchema>> = [];
  try {
    const parsed = JSON.parse(rawPayload) as unknown[];
    modules = parsed.map((item) => modulePayloadSchema.parse(item));
  } catch {
    withError(`/app/shows/${showId}?tab=program-plan`, "Invalid module payload.");
  }

  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, program_id")
    .eq("id", showId)
    .single();

  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  const { error: deleteError } = await client.from("program_modules").delete().eq("show_id", showId);
  if (deleteError) {
    withError(`/app/shows/${showId}?tab=program-plan`, deleteError.message);
  }

  if (modules.length > 0) {
    const { error: insertError } = await client.from("program_modules").insert(
      modules.map((module, index) => ({
        show_id: showId,
        module_type: module.module_type,
        display_title: module.display_title || module.module_type.replace(/_/g, " "),
        module_order: index,
        visible: module.visible,
        filler_eligible: module.filler_eligible,
        settings: module.settings ?? {}
      }))
    );
    if (insertError) {
      withError(`/app/shows/${showId}?tab=program-plan`, insertError.message);
    }
  }

  const layoutTokens = buildProgramLayoutTokens(modules);
  if (show.program_id) {
    await client.from("programs").update({ layout_order: layoutTokens }).eq("id", show.program_id);
  }

  redirect(`/app/shows/${showId}?tab=program-plan`);
}

export async function archiveShow(showId: string) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client.from("shows").select("id").eq("id", showId).single();
  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  const { error: updateError } = await client
    .from("shows")
    .update({
      status: "archived",
      is_published: false,
      published_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", showId);

  if (updateError) {
    withError(`/app/shows/${showId}?tab=settings`, updateError.message);
  }

  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Show archived. Delete is now enabled.")}`);
}

export async function restoreArchivedShow(showId: string) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client.from("shows").select("id").eq("id", showId).single();
  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  const { error: updateError } = await client
    .from("shows")
    .update({
      status: "draft",
      updated_at: new Date().toISOString()
    })
    .eq("id", showId);

  if (updateError) {
    withError(`/app/shows/${showId}?tab=settings`, updateError.message);
  }

  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Show restored to draft status.")}`);
}

export async function deleteArchivedShow(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, slug, status, program_id")
    .eq("id", showId)
    .single();
  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  if (String(show.status ?? "") !== "archived") {
    withError(`/app/shows/${showId}?tab=settings`, "Archive the show before deleting it.");
  }

  const expectedPhrase = `DELETE ${String(show.slug)}`;
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== expectedPhrase) {
    withError(
      `/app/shows/${showId}?tab=settings`,
      `Confirmation phrase mismatch. Type exactly: ${expectedPhrase}`
    );
  }

  if (show.program_id) {
    const { error: programDeleteError } = await client.from("programs").delete().eq("id", show.program_id);
    if (programDeleteError) {
      withError(`/app/shows/${showId}?tab=settings`, `Could not remove program data: ${programDeleteError.message}`);
    }
  }

  const { error: showDeleteError } = await client.from("shows").delete().eq("id", showId);
  if (showDeleteError) {
    withError(`/app/shows/${showId}?tab=settings`, showDeleteError.message);
  }

  redirect(`/app/shows?success=${encodeURIComponent("Show deleted permanently.")}`);
}

export async function getShowExports(showId: string) {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return [] as ShowExportSummary[];
  }

  try {
    const client = getSupabaseWriteClient();
    const { data } = await client
      .from("exports")
      .select("id, export_type, status, file_path, created_at, completed_at")
      .eq("show_id", showId)
      .order("created_at", { ascending: false })
      .limit(20);

    return (data ?? []).map((row) => ({
      id: String(row.id),
      export_type: String(row.export_type ?? ""),
      status: String(row.status ?? ""),
      file_path: String(row.file_path ?? ""),
      created_at: String(row.created_at ?? ""),
      completed_at: row.completed_at ? String(row.completed_at) : null
    })) as ShowExportSummary[];
  } catch {
    return [] as ShowExportSummary[];
  }
}

async function getShowAndProgram(showId: string) {
  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, slug, program_id")
    .eq("id", showId)
    .single();
  if (showError || !show?.program_id) {
    return null;
  }

  const { data: program, error: programError } = await client
    .from("programs")
    .select("id, slug")
    .eq("id", show.program_id)
    .single();
  if (programError || !program) {
    return null;
  }

  return {
    show_id: String(show.id),
    show_slug: String(show.slug ?? ""),
    program_id: String(program.id),
    program_slug: String(program.slug ?? "")
  };
}

export async function requestShowExport(showId: string, formData: FormData) {
  "use server";

  const current = await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=export`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const exportType = String(formData.get("exportType") ?? "proof");
  if (!["proof", "print"].includes(exportType)) {
    withError(`/app/shows/${showId}?tab=export`, "Invalid export type.");
  }

  const context = await getShowAndProgram(showId);
  if (!context) {
    withError("/app/shows", "Show not found.");
  }

  const client = getSupabaseWriteClient();
  const { data: created, error: createError } = await client
    .from("exports")
    .insert({
      show_id: showId,
      export_type: exportType,
      status: "running",
      params: {},
      file_path: "",
      created_by: current.user.id
    })
    .select("id")
    .single();

  if (createError || !created) {
    withError(`/app/shows/${showId}?tab=export`, createError?.message ?? "Could not start export.");
  }

  const filePath = `/api/exports/${created.id}/download`;

  const { error: completeError } = await client
    .from("exports")
    .update({
      status: "done",
      file_path: filePath,
      completed_at: new Date().toISOString()
    })
    .eq("id", created.id);

  if (completeError) {
    withError(`/app/shows/${showId}?tab=export`, completeError.message);
  }

  redirect(`/app/shows/${showId}?tab=export&success=${encodeURIComponent(`${exportType} export generated.`)}`);
}

export async function setShowPublished(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=publish`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const intent = String(formData.get("intent") ?? "publish");
  const shouldPublish = intent === "publish";

  const client = getSupabaseWriteClient();
  const { error } = await client
    .from("shows")
    .update({
      is_published: shouldPublish,
      published_at: shouldPublish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", showId);

  if (error) {
    withError(`/app/shows/${showId}?tab=publish`, error.message);
  }

  redirect(
    `/app/shows/${showId}?tab=publish&success=${encodeURIComponent(
      shouldPublish ? "Show published." : "Show unpublished."
    )}`
  );
}
