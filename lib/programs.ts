import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseReadClient, getSupabaseWriteClient } from "@/lib/supabase";
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

export type ProgramPage =
  | { id: string; type: "poster"; title: string; imageUrl: string; subtitle: string }
  | { id: string; type: "text"; title: string; body: string }
  | { id: string; type: "bios"; title: string; people: PersonRecord[] }
  | { id: string; type: "image"; title: string; imageUrl: string }
  | { id: string; type: "photo_grid"; title: string; photos: string[] }
  | { id: string; type: "filler"; title: string; body: string };

const personLineSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().min(1),
  headshotUrl: z.string().optional()
});

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
  castLines: z.string().optional().or(z.literal("")),
  productionTeamLines: z.string().optional().or(z.literal("")),
  productionPhotoUrls: z.string().optional(),
  customPages: z.string().optional(),
  layoutOrder: z.string().optional().or(z.literal(""))
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

function parsePeople(lines: string | undefined) {
  if (!lines) {
    return [];
  }

  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", role = "", bio = "", headshotUrl = ""] = line.split("|").map((part) => part.trim());
      return personLineSchema.parse({
        name,
        role,
        bio: sanitizeRichText(bio),
        headshotUrl: headshotUrl || undefined
      });
    });
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
        kind: normalizedKind,
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

  const parsed = payloadSchema.parse({
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
    castLines: formData.get("castLines"),
    productionTeamLines: formData.get("productionTeamLines"),
    productionPhotoUrls: formData.get("productionPhotoUrls")?.toString(),
    customPages: formData.get("customPages")?.toString(),
    layoutOrder: formData.get("layoutOrder")?.toString() ?? ""
  });

  const client = getSupabaseWriteClient();
  const baseSlug = slugify(parsed.title);
  const slug = `${baseSlug}-${Date.now().toString().slice(-5)}`;
  const layoutOrder = parseLayoutOrder(parsed.layoutOrder ?? "");
  const performanceSchedule = parsePerformanceSchedule(parsed.performanceSchedule);
  const autoShowDates = performanceSchedule.map((item) => formatPerformanceLabel(item)).filter(Boolean).join(" | ");
  const resolvedShowDates = (parsed.showDatesOverride && parsed.showDatesOverride.trim()) || parsed.showDates || autoShowDates;
  if (!resolvedShowDates) {
    throw new Error("At least one show date is required.");
  }
  const productionPhotoUrls = parseProductionPhotos(parsed.productionPhotoUrls);
  const customPages = parseCustomPages(parsed.customPages);

  const { data: program, error: programError } = await client
    .from("programs")
    .insert({
      title: parsed.title,
      slug,
      theatre_name: parsed.theatreName ?? "",
      show_dates: resolvedShowDates,
      performance_schedule: performanceSchedule,
      poster_image_url: parsed.posterImageUrl,
      director_notes: sanitizeRichText(parsed.directorNotes),
      dramaturgical_note: sanitizeRichText(parsed.dramaturgicalNote),
      billing_page: sanitizeRichText(parsed.billingPage),
      acts_songs: sanitizeRichText(parsed.actsAndSongs),
      department_info: sanitizeRichText(parsed.departmentInfo),
      actf_ad_image_url: parsed.actfAdImageUrl,
      acknowledgements: sanitizeRichText(parsed.acknowledgements),
      season_calendar: sanitizeRichText(parsed.seasonCalendar),
      production_photo_urls: productionPhotoUrls,
      custom_pages: customPages,
      layout_order: layoutOrder
    })
    .select("id, slug")
    .single();

  if (programError || !program) {
    throw new Error(programError?.message ?? "Could not create program.");
  }

  const castPeople = parsePeople(parsed.castLines).map((person) => ({
    program_id: program.id,
    full_name: person.name,
    role_title: person.role,
    bio: person.bio,
    team_type: "cast",
    headshot_url: person.headshotUrl ?? ""
  }));

  const productionPeople = parsePeople(parsed.productionTeamLines).map((person) => ({
    program_id: program.id,
    full_name: person.name,
    role_title: person.role,
    bio: person.bio,
    team_type: "production",
    headshot_url: person.headshotUrl ?? ""
  }));

  const { error: peopleError } = await client.from("people").insert([...castPeople, ...productionPeople]);
  if (peopleError) {
    throw new Error(peopleError.message);
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

    const { data: program, error } = await client
      .from("programs")
      .select(
        "id, title, slug, theatre_name, show_dates, poster_image_url, director_notes, dramaturgical_note, billing_page, acts_songs, department_info, actf_ad_image_url, acknowledgements, season_calendar, performance_schedule, production_photo_urls, custom_pages, layout_order"
      )
      .eq("slug", slug)
      .single();

    if (error || !program) {
      return null;
    }

    const { data: people, error: peopleError } = await client
      .from("people")
      .select("id, full_name, role_title, bio, team_type, headshot_url")
      .eq("program_id", program.id)
      .order("full_name", { ascending: true });

    if (peopleError) {
      throw new Error(peopleError.message);
    }

    const castPeople = (people ?? []).filter((person) => person.team_type === "cast") as PersonRecord[];
    const productionPeople = (people ?? []).filter((person) => person.team_type === "production") as PersonRecord[];

    const pageSequence = buildRenderablePages(
      {
        ...program,
        production_photo_urls: (program.production_photo_urls ?? []) as string[],
        custom_pages: (program.custom_pages ?? []) as CustomPageRecord[],
        layout_order: (program.layout_order ?? layoutTokenValues) as LayoutToken[]
      },
      castPeople,
      productionPeople
    );

    const paddedPages = padToMultipleOf4<ProgramPage>(pageSequence, (index) => ({
      id: `filler-${index}`,
      type: "filler",
      title: "Additional Information",
      body: "Space reserved for additional production notes, photos, or sponsor content."
    }));

    const bookletSpreads = buildBookletSpreads(paddedPages);

    return {
      ...program,
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

  const submissionSchema = z.object({
    fullName: z.string().min(1),
    roleTitle: z.string().min(1),
    bio: z.string().min(1),
    teamType: z.enum(["cast", "production"]),
    headshotUrl: z.string().url().optional().or(z.literal(""))
  });

  const parsed = submissionSchema.parse({
    fullName: formData.get("fullName"),
    roleTitle: formData.get("roleTitle"),
    bio: formData.get("bio"),
    teamType: formData.get("teamType"),
    headshotUrl: formData.get("headshotUrl") ?? ""
  });

  const client = getSupabaseWriteClient();
  const cleanBio = sanitizeRichText(parsed.bio);
  if (!richTextHasContent(cleanBio)) {
    throw new Error("Bio cannot be empty.");
  }
  const { data: program, error: programError } = await client
    .from("programs")
    .select("id, slug")
    .eq("slug", slug)
    .single();

  if (programError || !program) {
    throw new Error(programError?.message ?? "Program not found.");
  }

  const { error: peopleError } = await client.from("people").insert({
    program_id: program.id,
    full_name: parsed.fullName,
    role_title: parsed.roleTitle,
    bio: cleanBio,
    team_type: parsed.teamType,
    headshot_url: parsed.headshotUrl
  });

  if (peopleError) {
    throw new Error(peopleError.message);
  }

  redirect(`/programs/${program.slug}`);
}
