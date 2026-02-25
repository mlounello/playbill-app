import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { hideShowOnlyCastRoleTemplatesForShow } from "@/lib/roles";
import { sanitizeRichText } from "@/lib/rich-text";
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
  reminders_paused: boolean;
  acts_and_songs: string;
  season_calendar: string;
  acknowledgements: string;
  special_thanks: string;
  poster_image_url: string;
  show_dates: string;
  performance_schedule: Array<{ date?: string; time?: string }>;
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
  slug: z.string().optional().or(z.literal("")),
  actsAndSongs: z.string().optional().or(z.literal(""))
});

const modulePayloadSchema = z.object({
  module_type: z.string().min(1),
  display_title: z.string().optional().or(z.literal("")),
  visible: z.boolean(),
  filler_eligible: z.boolean(),
  settings: z.record(z.unknown()).optional()
});
const moduleReorderSchema = z.array(z.string().uuid());

export const moduleToProgramTokens: Record<string, string[]> = {
  cover: ["poster"],
  production_info: [],
  cast_list: ["cast_bios"],
  creative_team: ["team_bios"],
  production_team: ["team_bios"],
  bios: ["cast_bios", "team_bios"],
  director_note: ["director_note"],
  dramaturgical_note: ["dramaturgical_note"],
  music_director_note: ["music_director_note"],
  acts_scenes: ["acts_songs"],
  songs: ["acts_songs"],
  department_info: ["department_info"],
  headshots_grid: ["production_photos"],
  production_photos: ["production_photos"],
  sponsors: ["acknowledgements"],
  acknowledgements: ["acknowledgements"],
  special_thanks: ["special_thanks"],
  back_cover: ["season_calendar"],
  custom_pages: ["custom_pages"],
  custom_text: [],
  custom_image: []
};

function normalizeModuleType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "cast" || normalized === "cast_team" || normalized === "cast_team_list") return "cast_list";
  if (normalized === "creative_team_list") return "creative_team";
  if (normalized === "production_team_list") return "production_team";
  if (normalized === "director_notes") return "director_note";
  if (normalized === "acknowledgments") return "acknowledgements";
  if (normalized === "specialthanks") return "special_thanks";
  if (normalized === "department") return "department_info";
  return normalized;
}

function normalizeModuleSettings(settings: Record<string, unknown> | undefined, moduleType: string) {
  const next: Record<string, unknown> = { ...(settings ?? {}) };
  const defaultIsolated = new Set([
    "cover",
    "cast_list",
    "creative_team",
    "production_team",
    "bios",
    "headshots_grid",
    "production_photos",
    "custom_image",
    "back_cover"
  ]).has(normalizeModuleType(moduleType));

  const placementRaw = String(next.placement_mode ?? "").trim().toLowerCase();
  if (placementRaw === "flow" || placementRaw === "isolated") {
    next.separate_page = placementRaw === "isolated";
  } else if (next.separate_page !== undefined) {
    next.placement_mode = Boolean(next.separate_page) ? "isolated" : "flow";
  } else {
    next.placement_mode = defaultIsolated ? "isolated" : "flow";
    next.separate_page = defaultIsolated;
  }

  if (next.show_header === undefined) {
    next.show_header = true;
  }
  if (next.allow_multiple_pages === undefined) {
    next.allow_multiple_pages = normalizeModuleType(moduleType) === "bios" || normalizeModuleType(moduleType) === "custom_pages";
  }

  return next;
}

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

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeOptionalHttpUrl(value: string | undefined, fieldLabel: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (!isValidHttpUrl(trimmed)) {
    throw new Error(`${fieldLabel} must be a valid http(s) URL.`);
  }
  return trimmed;
}

function parsePerformanceSchedule(text: string | undefined) {
  if (!text) {
    return [] as Array<{ date?: string; time?: string }>;
  }

  try {
    const parsed = JSON.parse(text) as Array<{ date?: string; time?: string }>;
    if (!Array.isArray(parsed)) {
      return [] as Array<{ date?: string; time?: string }>;
    }
    return parsed
      .filter((item) => item && typeof item.date === "string" && item.date.trim().length > 0)
      .map((item) => ({
        date: String(item.date ?? "").trim(),
        time: typeof item.time === "string" && item.time.trim().length > 0 ? item.time.trim() : undefined
      }));
  } catch {
    return [] as Array<{ date?: string; time?: string }>;
  }
}

function formatPerformanceLabel(performance: { date?: string; time?: string }) {
  const dateText = String(performance.date ?? "");
  const [yearRaw, monthRaw, dayRaw] = dateText.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) {
    return "";
  }

  const timeText = String(performance.time ?? "");
  const [hourRaw, minuteRaw] = (timeText || "00:00").split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const dateObj = new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(dateObj);

  if (!timeText) {
    return datePart;
  }

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(dateObj);
  return `${datePart} ${timePart}`;
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

    const normalizedType = normalizeModuleType(module.module_type);
    for (const token of moduleToProgramTokens[normalizedType] ?? []) {
      if (!seen.has(token)) {
        seen.add(token);
        ordered.push(token);
      }
    }
  }

  return ordered;
}

function isSubmissionCompleteStatus(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  return normalized === "submitted" || normalized === "approved" || normalized === "locked";
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
      slug: formData.get("slug"),
      actsAndSongs: formData.get("actsAndSongs")
    });
  } catch {
    withError("/app/shows/new", "Please fill in the required fields.");
  }

  const client = getSupabaseWriteClient();
  const slugBase = parsed.slug ? slugify(parsed.slug) : slugify(parsed.title);
  const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

  const showDates = formatShowDates(parsed.startDate, parsed.endDate);
  const sanitizedActsAndSongs = sanitizeRichText(parsed.actsAndSongs ?? "");

  const { data: program, error: programError } = await client
    .from("programs")
    .insert({
      title: parsed.title,
      slug,
      theatre_name: parsed.venue ?? "",
      show_dates: showDates,
      acts_songs: sanitizedActsAndSongs
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
    "dramaturgical_note",
    "music_director_note",
    "acts_scenes",
    "songs",
    "department_info",
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
      .select("id, title, slug, status, start_date, end_date, venue, program_id, is_published, published_at, reminders_paused")
      .order("created_at", { ascending: false });

    const { data: programs } = await client
      .from("programs")
      .select("*");
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
      if (isSubmissionCompleteStatus(row.submission_status)) {
        current.submitted += 1;
      }
      submissionByProgram.set(pid, current);
    }

    return (shows ?? []).map((show) => {
      const programId = String(show.program_id ?? "");
      const sub = submissionByProgram.get(programId) ?? { total: 0, submitted: 0 };
      const program = programs?.find((row) => String(row.id ?? "") === programId);
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
        published_at: show.published_at ? String(show.published_at) : null,
        reminders_paused: Boolean(show.reminders_paused),
        acts_and_songs: String(program?.acts_songs ?? ""),
        season_calendar: String(program?.season_calendar ?? ""),
        acknowledgements: String(program?.acknowledgements ?? ""),
        special_thanks: String((program as Record<string, unknown> | undefined)?.special_thanks ?? ""),
        poster_image_url: String(program?.poster_image_url ?? ""),
        show_dates: String(program?.show_dates ?? ""),
        performance_schedule: Array.isArray(program?.performance_schedule)
          ? (program?.performance_schedule as Array<{ date?: string; time?: string }>)
          : []
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
      .select("id, title, slug, status, start_date, end_date, venue, program_id, is_published, published_at, reminders_paused")
      .eq("id", showId)
      .single();

    if (error || !show) {
      return null;
    }

    const programId = String(show.program_id ?? "");
    const { data: program } = await client
      .from("programs")
      .select("*")
      .eq("id", programId)
      .single();
    const { data: people } = await client.from("people").select("submission_status").eq("program_id", programId);
    const { data: modules } = await client
      .from("program_modules")
      .select("id, module_type, display_title, module_order, visible, filler_eligible, settings")
      .eq("show_id", showId)
      .order("module_order", { ascending: true });

    const total = (people ?? []).length;
    const submitted = (people ?? []).filter((row) => isSubmissionCompleteStatus(row.submission_status)).length;

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
      reminders_paused: Boolean(show.reminders_paused),
      acts_and_songs: String(program?.acts_songs ?? ""),
      season_calendar: String(program?.season_calendar ?? ""),
      acknowledgements: String(program?.acknowledgements ?? ""),
      special_thanks: String((program as Record<string, unknown> | undefined)?.special_thanks ?? ""),
      poster_image_url: String(program?.poster_image_url ?? ""),
      show_dates: String(program?.show_dates ?? ""),
      performance_schedule: Array.isArray(program?.performance_schedule)
        ? (program?.performance_schedule as Array<{ date?: string; time?: string }>)
        : [],
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
        settings: normalizeModuleSettings(module.settings, module.module_type)
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

  const qp = new URLSearchParams({
    tab: "program-plan",
    success: "Program plan saved.",
    savedAt: String(Date.now())
  });
  redirect(`/app/shows/${showId}?${qp.toString()}`);
}

export async function reorderShowModules(showId: string, formData: FormData) {
  "use server";

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=preview`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const raw = String(formData.get("orderedModuleIds") ?? "[]");
  let orderedIds: string[] = [];
  try {
    orderedIds = moduleReorderSchema.parse(JSON.parse(raw));
  } catch {
    withError(`/app/shows/${showId}?tab=preview`, "Invalid reorder payload.");
  }

  const client = getSupabaseWriteClient();
  const { data: modules, error: modulesError } = await client
    .from("program_modules")
    .select("id")
    .eq("show_id", showId)
    .order("module_order", { ascending: true });

  if (modulesError) {
    withError(`/app/shows/${showId}?tab=preview`, modulesError.message);
  }

  const existingIds = (modules ?? []).map((row) => String(row.id ?? ""));
  if (existingIds.length !== orderedIds.length) {
    withError(`/app/shows/${showId}?tab=preview`, "Reorder payload does not match module list.");
  }
  const existingSet = new Set(existingIds);
  if (orderedIds.some((id) => !existingSet.has(id))) {
    withError(`/app/shows/${showId}?tab=preview`, "Reorder payload contains unknown module ids.");
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    withError(`/app/shows/${showId}?tab=preview`, "Reorder payload contains duplicate module ids.");
  }

  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error: updateError } = await client
      .from("program_modules")
      .update({ module_order: index })
      .eq("show_id", showId)
      .eq("id", orderedIds[index]);
    if (updateError) {
      withError(`/app/shows/${showId}?tab=preview`, updateError.message);
    }
  }

  redirect(`/app/shows/${showId}?tab=preview&success=${encodeURIComponent("Module order saved.")}`);
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

  await hideShowOnlyCastRoleTemplatesForShow(showId);

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

export async function updateShowActsAndSongs(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const actsAndSongs = sanitizeRichText(String(formData.get("actsAndSongs") ?? ""));
  const client = getSupabaseWriteClient();

  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, program_id")
    .eq("id", showId)
    .single();

  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  const { error: showUpdateError } = await client
    .from("shows")
    .update({
      updated_at: new Date().toISOString()
    })
    .eq("id", showId);

  if (showUpdateError) {
    withError(`/app/shows/${showId}?tab=settings`, showUpdateError.message);
  }

  if (show.program_id) {
    const { error: programUpdateError } = await client
      .from("programs")
      .update({ acts_songs: actsAndSongs })
      .eq("id", show.program_id);
    if (programUpdateError) {
      withError(`/app/shows/${showId}?tab=settings`, programUpdateError.message);
    }
  }

  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Acts & Songs updated from show setup.")}`);
}

export async function updateShowAcknowledgements(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const acknowledgements = sanitizeRichText(String(formData.get("acknowledgements") ?? ""));
  const specialThanks = sanitizeRichText(String(formData.get("specialThanks") ?? ""));
  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, program_id")
    .eq("id", showId)
    .single();

  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  if (show.program_id) {
    const { data: columnsData } = await client
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "programs");
    const columnSet = new Set((columnsData ?? []).map((item) => String((item as { column_name?: unknown }).column_name ?? "")));
    const updates: Record<string, string> = { acknowledgements };
    if (columnSet.has("special_thanks")) {
      updates.special_thanks = specialThanks;
    }
    const { error: programUpdateError } = await client
      .from("programs")
      .update(updates)
      .eq("id", show.program_id);
    if (programUpdateError) {
      withError(`/app/shows/${showId}?tab=settings`, programUpdateError.message);
    }
  }

  await client.from("shows").update({ updated_at: new Date().toISOString() }).eq("id", showId);
  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Acknowledgements and Special Thanks updated.")}`);
}

export async function updateShowPresentation(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
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

  const performanceSchedule = parsePerformanceSchedule(String(formData.get("performanceSchedule") ?? "[]"));
  const autoShowDates = performanceSchedule.map((item) => formatPerformanceLabel(item)).filter(Boolean).join(" | ");
  const showDatesOverride = String(formData.get("showDatesOverride") ?? "").trim();
  const resolvedShowDates = showDatesOverride || autoShowDates || "TBD";

  const posterImageUrl = (() => {
    try {
      return normalizeOptionalHttpUrl(String(formData.get("posterImageUrl") ?? ""), "Poster image URL");
    } catch (error) {
      withError(`/app/shows/${showId}?tab=settings`, error instanceof Error ? error.message : "Invalid poster image URL.");
    }
  })();

  if (show.program_id) {
    const { error: programError } = await client
      .from("programs")
      .update({
        poster_image_url: posterImageUrl,
        performance_schedule: performanceSchedule,
        show_dates: resolvedShowDates
      })
      .eq("id", show.program_id);
    if (programError) {
      withError(`/app/shows/${showId}?tab=settings`, programError.message);
    }
  }

  await client.from("shows").update({ updated_at: new Date().toISOString() }).eq("id", showId);
  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Poster and performance schedule updated.")}`);
}

export async function updateShowSeasonCalendar(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const seasonCalendar = sanitizeRichText(String(formData.get("seasonCalendar") ?? ""));
  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, program_id")
    .eq("id", showId)
    .single();

  if (showError || !show) {
    withError("/app/shows", "Show not found.");
  }

  if (show.program_id) {
    const { error: programUpdateError } = await client
      .from("programs")
      .update({ season_calendar: seasonCalendar })
      .eq("id", show.program_id);
    if (programUpdateError) {
      withError(`/app/shows/${showId}?tab=settings`, programUpdateError.message);
    }
  }

  await client.from("shows").update({ updated_at: new Date().toISOString() }).eq("id", showId);
  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Season Calendar updated from show setup.")}`);
}
