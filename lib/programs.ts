import { redirect } from "next/navigation";
import { z } from "zod";
import { getMissingSupabaseEnvVars, getSupabaseReadClient, getSupabaseWriteClient } from "@/lib/supabase";
import { buildBookletSpreads, padToMultipleOf4 } from "@/lib/booklet";
import { richTextHasContent, sanitizeRichText } from "@/lib/rich-text";

const layoutTokenValues = [
  "poster",
  "director_note",
  "dramaturgical_note",
  "billing",
  "acts_songs",
  "cast_bios",
  "team_bios",
  "department_info",
  "actf_ad",
  "acknowledgements",
  "season_calendar",
  "production_photos",
  "custom_pages"
] as const;

const layoutTokenSchema = z.enum(layoutTokenValues);
type LayoutToken = z.infer<typeof layoutTokenSchema>;

type PersonRecord = {
  id: string;
  full_name: string;
  role_title: string;
  bio: string;
  team_type: "cast" | "production";
  headshot_url: string;
  email: string;
  submission_status: string;
};

type CustomPageRecord = {
  title: string;
  kind: "text" | "image" | "photos";
  body: string;
};

type PerformanceRecord = {
  date: string;
  time?: string;
};

type RosterPerson = {
  name: string;
  role: string;
  teamType: "cast" | "production";
  email?: string;
  bio?: string;
  headshotUrl?: string;
};

export type ProgramPage =
  | { id: string; type: "poster"; title: string; imageUrl: string; subtitle: string }
  | { id: string; type: "text"; title: string; body: string }
  | { id: string; type: "bios"; title: string; people: PersonRecord[] }
  | { id: string; type: "image"; title: string; imageUrl: string }
  | { id: string; type: "photo_grid"; title: string; photos: string[] }
  | { id: string; type: "filler"; title: string; body: string };

const payloadSchema = z.object({
  title: z.string().min(1),
  theatreName: z.string().optional().or(z.literal("")),
  showDates: z.string().optional().or(z.literal("")),
  showDatesOverride: z.string().optional().or(z.literal("")),
  performanceSchedule: z.string().optional().or(z.literal("[]")),
  posterImageUrl: z.string().url().optional().or(z.literal("")),
  directorNotes: z.string().optional().or(z.literal("")),
  dramaturgicalNote: z.string().optional().or(z.literal("")),
  billingPage: z.string().optional().or(z.literal("")),
  actsAndSongs: z.string().optional().or(z.literal("")),
  departmentInfo: z.string().optional().or(z.literal("")),
  seasonCalendar: z.string().optional().or(z.literal("")),
  acknowledgements: z.string().optional().or(z.literal("")),
  actfAdImageUrl: z.string().url().optional().or(z.literal("")),
  rosterLines: z.string().optional().or(z.literal("")),
  castLines: z.string().optional().or(z.literal("")),
  productionTeamLines: z.string().optional().or(z.literal("")),
  productionPhotoUrls: z.string().optional(),
  customPages: z.string().optional(),
  layoutOrder: z.string().optional().or(z.literal(""))
});

const submissionSchema = z.object({
  personId: z.string().uuid(),
  email: z.string().email(),
  bio: z.string().min(1),
  headshotUrl: z.string().url().optional().or(z.literal(""))
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

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function personKey(name: string, role: string, teamType: "cast" | "production") {
  return `${normalizeName(name)}|${normalizeName(role)}|${teamType}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function redirectWithError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}?${qp.toString()}`);
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

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parsePeople(lines: string | undefined, teamType: "cast" | "production"): RosterPerson[] {
  if (!lines) {
    return [];
  }

  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", role = "", bio = "", headshotUrl = ""] = line.split("|").map((part) => part.trim());
      if (!name || !role) {
        throw new Error(`Invalid people line: ${line}`);
      }

      return {
        name,
        role,
        teamType,
        bio: sanitizeRichText(bio),
        headshotUrl: headshotUrl || undefined
      };
    });
}

function parseRosterLines(lines: string | undefined): RosterPerson[] {
  if (!lines) {
    return [];
  }

  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", role = "", team = "production", email = ""] = line.split("|").map((part) => part.trim());
      const lowered = team.toLowerCase();
      const teamType = lowered === "cast" ? "cast" : lowered === "production" ? "production" : null;

      if (!name || !role || !teamType) {
        throw new Error(`Invalid roster line: ${line}`);
      }

      if (email && !z.string().email().safeParse(email).success) {
        throw new Error(`Invalid roster email: ${line}`);
      }

      return { name, role, teamType, email: email || undefined };
    });
}

function mergeRoster(people: RosterPerson[]) {
  const map = new Map<string, RosterPerson>();
  for (const person of people) {
    const key = personKey(person.name, person.role, person.teamType);
    const existing = map.get(key);
    map.set(key, {
      ...person,
      email: person.email ?? existing?.email,
      bio: person.bio && richTextHasContent(person.bio) ? person.bio : existing?.bio ?? "",
      headshotUrl: person.headshotUrl ?? existing?.headshotUrl
    });
  }
  return [...map.values()];
}

function generateAutoBilling(people: RosterPerson[]) {
  if (!people.length) {
    return "";
  }

  const cast = people
    .filter((person) => person.teamType === "cast")
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const production = people
    .filter((person) => person.teamType === "production")
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));

  const section = (title: string, rows: RosterPerson[]) => {
    if (!rows.length) {
      return "";
    }
    const listItems = rows
      .map((row) => `<li><strong>${escapeHtml(row.role)}</strong>: ${escapeHtml(row.name)}</li>`)
      .join("");
    return `<h3>${escapeHtml(title)}</h3><ul>${listItems}</ul>`;
  };

  return section("Cast", cast) + section("Production Team", production);
}

function parseLayoutOrder(text: string): LayoutToken[] {
  const parsed = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((token) => layoutTokenSchema.parse(token));

  return parsed.length > 0 ? parsed : [...layoutTokenValues];
}

function parseProductionPhotos(text: string | undefined) {
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && isValidHttpUrl(line));
}

function parseCustomPages(text: string | undefined): CustomPageRecord[] {
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", kind = "", ...bodyParts] = line.split("|").map((part) => part.trim());
      const normalizedKind = kind.toLowerCase();
      if (!title || !bodyParts.length) {
        throw new Error(`Invalid custom page line: ${line}`);
      }

      if (normalizedKind !== "text" && normalizedKind !== "image" && normalizedKind !== "photos") {
        throw new Error(`Invalid custom page type in line: ${line}`);
      }

      const body = bodyParts.join(" | ");
      if (normalizedKind === "image" && !isValidHttpUrl(body)) {
        throw new Error(`Custom page image URL is invalid in line: ${line}`);
      }

      if (normalizedKind === "photos") {
        const photos = body
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        if (photos.some((item) => !isValidHttpUrl(item))) {
          throw new Error(`Custom page photo URL is invalid in line: ${line}`);
        }
      }

      return {
        title,
        kind: normalizedKind as "text" | "image" | "photos",
        body: normalizedKind === "text" ? sanitizeRichText(body) : body
      };
    });
}

function mapCustomPageToRenderable(page: CustomPageRecord, index: number): ProgramPage {
  if (page.kind === "text") {
    return {
      id: `custom-text-${index}`,
      type: "text",
      title: page.title,
      body: page.body
    };
  }

  if (page.kind === "image") {
    return {
      id: `custom-image-${index}`,
      type: "image",
      title: page.title,
      imageUrl: page.body
    };
  }

  const photos = page.body
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: `custom-photos-${index}`,
    type: "photo_grid",
    title: page.title,
    photos
  };
}

function parsePerformanceSchedule(text: string | undefined): PerformanceRecord[] {
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as Array<{ date?: string; time?: string }>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item.date === "string" && item.date.trim().length > 0)
      .map((item) => ({
        date: item.date!.trim(),
        time: typeof item.time === "string" && item.time.trim().length > 0 ? item.time.trim() : undefined
      }));
  } catch {
    return [];
  }
}

function formatPerformanceLabel(performance: PerformanceRecord) {
  const [yearRaw, monthRaw, dayRaw] = performance.date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) {
    return "";
  }

  const [hourRaw, minuteRaw] = (performance.time ?? "00:00").split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const dateObj = new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(dateObj);

  if (!performance.time) {
    return datePart;
  }

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(dateObj);

  return `${datePart} ${timePart}`;
}

export async function createProgram(formData: FormData) {
  "use server";

  let parsed: z.infer<typeof payloadSchema>;
  try {
    parsed = payloadSchema.parse({
      title: formData.get("title"),
      theatreName: formData.get("theatreName"),
      showDates: formData.get("showDates"),
      showDatesOverride: formData.get("showDatesOverride"),
      performanceSchedule: formData.get("performanceSchedule")?.toString() ?? "[]",
      posterImageUrl: formData.get("posterImageUrl"),
      directorNotes: formData.get("directorNotes"),
      dramaturgicalNote: formData.get("dramaturgicalNote"),
      billingPage: formData.get("billingPage"),
      actsAndSongs: formData.get("actsAndSongs"),
      departmentInfo: formData.get("departmentInfo"),
      seasonCalendar: formData.get("seasonCalendar"),
      acknowledgements: formData.get("acknowledgements"),
      actfAdImageUrl: formData.get("actfAdImageUrl") ?? "",
      rosterLines: formData.get("rosterLines"),
      castLines: formData.get("castLines"),
      productionTeamLines: formData.get("productionTeamLines"),
      productionPhotoUrls: formData.get("productionPhotoUrls")?.toString(),
      customPages: formData.get("customPages")?.toString(),
      layoutOrder: formData.get("layoutOrder")?.toString() ?? ""
    });
  } catch {
    return redirectWithError("/programs/new", "Please review required fields and input formats.");
  }

  const missingEnv = getMissingSupabaseEnvVars();
  if (missingEnv.length > 0) {
    redirectWithError("/programs/new", `Supabase is not configured: ${missingEnv.join(", ")}`);
  }

  const client = getSupabaseWriteClient();

  const baseSlug = slugify(parsed.title);
  const slug = `${baseSlug}-${Date.now().toString().slice(-5)}`;
  const layoutOrder = parseLayoutOrder(parsed.layoutOrder ?? "");
  const performanceSchedule = parsePerformanceSchedule(parsed.performanceSchedule);
  const autoShowDates = performanceSchedule.map((item) => formatPerformanceLabel(item)).filter(Boolean).join(" | ");
  const resolvedShowDates = (parsed.showDatesOverride && parsed.showDatesOverride.trim()) || parsed.showDates || autoShowDates;
  if (!resolvedShowDates) {
    redirectWithError("/programs/new", "At least one performance date is required.");
  }

  let rosterPeople: RosterPerson[] = [];
  try {
    const roster = parseRosterLines(parsed.rosterLines);
    const castDetailed = parsePeople(parsed.castLines, "cast");
    const productionDetailed = parsePeople(parsed.productionTeamLines, "production");
    rosterPeople = mergeRoster([
      ...roster,
      ...castDetailed.map((person) => ({ ...person, email: undefined })),
      ...productionDetailed.map((person) => ({ ...person, email: undefined }))
    ]);
  } catch {
    redirectWithError("/programs/new", "Roster format is invalid. Use Name | Role | cast|production | optional@email.com.");
  }

  const productionPhotoUrls = parseProductionPhotos(parsed.productionPhotoUrls);
  const customPages = parseCustomPages(parsed.customPages);

  const billingHtml = sanitizeRichText(parsed.billingPage);
  const resolvedBilling = richTextHasContent(billingHtml) ? billingHtml : generateAutoBilling(rosterPeople);

  const programsColumns = await getTableColumns(client, "programs");
  const rawProgramInsert: Record<string, unknown> = {
    title: parsed.title,
    slug,
    theatre_name: parsed.theatreName ?? "",
    show_dates: resolvedShowDates,
    performance_schedule: performanceSchedule,
    poster_image_url: parsed.posterImageUrl,
    director_notes: sanitizeRichText(parsed.directorNotes),
    dramaturgical_note: sanitizeRichText(parsed.dramaturgicalNote),
    billing_page: resolvedBilling,
    acts_songs: sanitizeRichText(parsed.actsAndSongs),
    department_info: sanitizeRichText(parsed.departmentInfo),
    actf_ad_image_url: parsed.actfAdImageUrl,
    acknowledgements: sanitizeRichText(parsed.acknowledgements),
    season_calendar: sanitizeRichText(parsed.seasonCalendar),
    production_photo_urls: productionPhotoUrls,
    custom_pages: customPages,
    layout_order: layoutOrder
  };

  const programInsert = filterToColumns(rawProgramInsert, programsColumns);

  const { data: program, error: programError } = await client.from("programs").insert(programInsert).select("id, slug").single();

  if (programError || !program) {
    redirectWithError("/programs/new", programError?.message ?? "Could not create program.");
  }

  const peopleColumns = await getTableColumns(client, "people");
  const peopleRows = rosterPeople.map((person) =>
    filterToColumns(
      {
        program_id: program.id,
        full_name: person.name,
        role_title: person.role,
        bio: person.bio ?? "",
        team_type: person.teamType,
        headshot_url: person.headshotUrl ?? "",
        email: person.email ?? "",
        submission_status: richTextHasContent(person.bio ?? "") ? "submitted" : "pending",
        submitted_at: richTextHasContent(person.bio ?? "") ? new Date().toISOString() : null
      },
      peopleColumns
    )
  );

  if (peopleRows.length > 0) {
    const { error: peopleError } = await client.from("people").insert(peopleRows);
    if (peopleError) {
      redirectWithError("/programs/new", peopleError.message);
    }
  }

  redirect(`/programs/${program.slug}`);
}

function buildRenderablePages(
  program: {
    title: string;
    theatre_name: string;
    show_dates: string;
    poster_image_url: string;
    director_notes: string;
    dramaturgical_note: string;
    billing_page: string;
    acts_songs: string;
    department_info: string;
    actf_ad_image_url: string;
    acknowledgements: string;
    season_calendar: string;
    production_photo_urls: string[];
    custom_pages: CustomPageRecord[];
    layout_order: LayoutToken[];
  },
  cast: PersonRecord[],
  production: PersonRecord[]
) {
  const hasText = (value: string) => Boolean(value && value.trim().length > 0);
  const pageByToken: Record<Exclude<LayoutToken, "custom_pages" | "production_photos">, ProgramPage> = {
    poster: {
      id: "poster",
      type: "poster",
      title: program.title,
      subtitle: `${program.theatre_name} | ${program.show_dates}`,
      imageUrl: program.poster_image_url
    },
    director_note: { id: "director-note", type: "text", title: "Director's Note", body: program.director_notes },
    dramaturgical_note: {
      id: "dramaturgical-note",
      type: "text",
      title: "Dramaturgical Note",
      body: program.dramaturgical_note
    },
    billing: { id: "billing", type: "text", title: "Billing", body: program.billing_page },
    acts_songs: { id: "acts-songs", type: "text", title: "Acts & Songs", body: program.acts_songs },
    cast_bios: { id: "cast-bios", type: "bios", title: "Who's Who in the Cast", people: cast },
    team_bios: {
      id: "team-bios",
      type: "bios",
      title: "Who's Who in the Production Team",
      people: production
    },
    department_info: {
      id: "department-info",
      type: "text",
      title: "Department Information",
      body: program.department_info
    },
    actf_ad: {
      id: "actf-ad",
      type: "image",
      title: "ACTF",
      imageUrl: program.actf_ad_image_url
    },
    acknowledgements: {
      id: "acknowledgements",
      type: "text",
      title: "Acknowledgements",
      body: program.acknowledgements
    },
    season_calendar: {
      id: "season-calendar",
      type: "text",
      title: "Season Calendar",
      body: program.season_calendar
    }
  };

  const pages: ProgramPage[] = [];

  for (const token of program.layout_order) {
    if (token === "custom_pages") {
      for (let i = 0; i < program.custom_pages.length; i += 1) {
        pages.push(mapCustomPageToRenderable(program.custom_pages[i], i));
      }
      continue;
    }

    if (token === "production_photos") {
      if (program.production_photo_urls.length > 0) {
        pages.push({
          id: "production-photos",
          type: "photo_grid",
          title: "Production Photos",
          photos: program.production_photo_urls
        });
      }
      continue;
    }

    if (token === "actf_ad" && !program.actf_ad_image_url) {
      continue;
    }

    if (token === "poster" && !hasText(program.poster_image_url)) {
      continue;
    }
    if (token === "director_note" && !richTextHasContent(program.director_notes)) {
      continue;
    }
    if (token === "dramaturgical_note" && !richTextHasContent(program.dramaturgical_note)) {
      continue;
    }
    if (token === "billing" && !richTextHasContent(program.billing_page)) {
      continue;
    }
    if (token === "acts_songs" && !richTextHasContent(program.acts_songs)) {
      continue;
    }
    if (token === "cast_bios" && cast.length === 0) {
      continue;
    }
    if (token === "team_bios" && production.length === 0) {
      continue;
    }
    if (token === "department_info" && !richTextHasContent(program.department_info)) {
      continue;
    }
    if (token === "acknowledgements" && !richTextHasContent(program.acknowledgements)) {
      continue;
    }
    if (token === "season_calendar" && !richTextHasContent(program.season_calendar)) {
      continue;
    }

    pages.push(pageByToken[token]);
  }

  if (pages.length === 0) {
    pages.push({
      id: "fallback-info",
      type: "filler",
      title: "Program Content",
      body: "No sections were provided yet. Add content and regenerate this playbill."
    });
  }

  return pages;
}

export async function getProgramBySlug(slug: string) {
  try {
    const client = getSupabaseReadClient();

    const { data: program, error } = await client.from("programs").select("*").eq("slug", slug).single();
    if (error || !program) {
      return null;
    }

    const { data: people, error: peopleError } = await client.from("people").select("*").eq("program_id", program.id);
    if (peopleError) {
      throw new Error(peopleError.message);
    }

    const normalizedPeople = (people ?? []).map((person) => ({
      id: String(person.id),
      full_name: String(person.full_name ?? ""),
      role_title: String(person.role_title ?? ""),
      bio: String(person.bio ?? ""),
      team_type: person.team_type === "cast" ? "cast" : "production",
      headshot_url: String(person.headshot_url ?? ""),
      email: String(person.email ?? ""),
      submission_status: String(person.submission_status ?? "pending")
    })) as PersonRecord[];

    const castPeople = normalizedPeople
      .filter((person) => person.team_type === "cast")
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    const productionPeople = normalizedPeople
      .filter((person) => person.team_type === "production")
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    const safeProgram = {
      title: String(program.title ?? "Untitled Show"),
      theatre_name: String(program.theatre_name ?? ""),
      show_dates: String(program.show_dates ?? ""),
      poster_image_url: String(program.poster_image_url ?? ""),
      director_notes: String(program.director_notes ?? ""),
      dramaturgical_note: String(program.dramaturgical_note ?? ""),
      billing_page: String(program.billing_page ?? ""),
      acts_songs: String(program.acts_songs ?? ""),
      department_info: String(program.department_info ?? ""),
      actf_ad_image_url: String(program.actf_ad_image_url ?? ""),
      acknowledgements: String(program.acknowledgements ?? ""),
      season_calendar: String(program.season_calendar ?? ""),
      production_photo_urls: Array.isArray(program.production_photo_urls) ? (program.production_photo_urls as string[]) : [],
      custom_pages: Array.isArray(program.custom_pages) ? (program.custom_pages as CustomPageRecord[]) : [],
      layout_order: Array.isArray(program.layout_order) ? (program.layout_order as LayoutToken[]) : [...layoutTokenValues]
    };

    const pageSequence = buildRenderablePages(safeProgram, castPeople, productionPeople);
    const paddedPages = padToMultipleOf4<ProgramPage>(pageSequence, (index) => ({
      id: `filler-${index}`,
      type: "filler",
      title: "Additional Information",
      body: "Space reserved for additional production notes, photos, or sponsor content."
    }));

    const bookletSpreads = buildBookletSpreads(paddedPages);

    return {
      id: String(program.id),
      slug: String(program.slug),
      ...safeProgram,
      castPeople,
      productionPeople,
      pageSequence,
      paddedPages,
      bookletSpreads
    };
  } catch {
    return null;
  }
}

export async function submitBioForProgram(slug: string, formData: FormData) {
  "use server";

  let parsed: z.infer<typeof submissionSchema>;
  try {
    parsed = submissionSchema.parse({
      personId: formData.get("personId"),
      email: formData.get("email"),
      bio: formData.get("bio"),
      headshotUrl: formData.get("headshotUrl") ?? ""
    });
  } catch {
    return redirectWithError(`/programs/${slug}/submit`, "Please complete all required fields.");
  }

  const cleanBio = sanitizeRichText(parsed.bio);
  if (!richTextHasContent(cleanBio)) {
    redirectWithError(`/programs/${slug}/submit`, "Bio cannot be empty.");
  }

  const missingEnv = getMissingSupabaseEnvVars();
  if (missingEnv.length > 0) {
    redirectWithError(`/programs/${slug}/submit`, `Supabase is not configured: ${missingEnv.join(", ")}`);
  }

  const client = getSupabaseWriteClient();
  const { data: program, error: programError } = await client.from("programs").select("id, slug").eq("slug", slug).single();

  if (programError || !program) {
    redirectWithError(`/programs/${slug}/submit`, "Program not found.");
  }

  const { data: targetPerson, error: personError } = await client
    .from("people")
    .select("*")
    .eq("id", parsed.personId)
    .eq("program_id", program.id)
    .single();

  if (personError || !targetPerson) {
    redirectWithError(`/programs/${slug}/submit`, "Selected person was not found.");
  }

  const rosterEmail = String(targetPerson.email ?? "").trim();
  if (!rosterEmail) {
    redirectWithError(`/programs/${slug}/submit`, "No email is on file for this person. Contact production admin.");
  }

  if (normalizeEmail(rosterEmail) !== normalizeEmail(parsed.email)) {
    redirectWithError(`/programs/${slug}/submit`, "Email does not match roster record.");
  }

  const peopleColumns = await getTableColumns(client, "people");
  const updatePayload = filterToColumns(
    {
      bio: cleanBio,
      headshot_url: parsed.headshotUrl,
      submission_status: "submitted",
      submitted_at: new Date().toISOString()
    },
    peopleColumns
  );

  const { error: updateError } = await client.from("people").update(updatePayload).eq("id", targetPerson.id);
  if (updateError) {
    redirectWithError(`/programs/${slug}/submit`, updateError.message);
  }

  redirect(`/programs/${program.slug}`);
}
