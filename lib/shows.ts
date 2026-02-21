import { redirect } from "next/navigation";
import { z } from "zod";
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
};

const createShowSchema = z.object({
  title: z.string().min(1),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  venue: z.string().optional().or(z.literal("")),
  seasonTag: z.string().optional().or(z.literal("")),
  slug: z.string().optional().or(z.literal(""))
});

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
      .select("id, title, slug, status, start_date, end_date, venue, program_id")
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
        program_slug: programSlugById.get(programId) ?? String(show.slug)
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
      .select("id, title, slug, status, start_date, end_date, venue, program_id")
      .eq("id", showId)
      .single();

    if (error || !show) {
      return null;
    }

    const programId = String(show.program_id ?? "");
    const { data: program } = await client.from("programs").select("slug").eq("id", programId).single();
    const { data: people } = await client.from("people").select("submission_status").eq("program_id", programId);

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
      program_slug: program?.slug ? String(program.slug) : String(show.slug)
    } satisfies ShowSummary;
  } catch {
    return null;
  }
}
