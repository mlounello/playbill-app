import { redirect } from "next/navigation";
import { z } from "zod";
import { buildDepartmentInfoHtml } from "@/lib/departments";
import { buildSeasonCalendarHtml } from "@/lib/seasons";
import { getMissingSupabaseEnvVars, getSupabaseWriteClient } from "@/lib/supabase";
import { buildBookletSpreads, padToMultipleOf4 } from "@/lib/booklet";
import { richTextHasContent, sanitizeRichText } from "@/lib/rich-text";

const layoutTokenValues = [
  "poster",
  "director_note",
  "dramaturgical_note",
  "music_director_note",
  "billing",
  "acts_songs",
  "cast_bios",
  "team_bios",
  "department_info",
  "actf_ad",
  "acknowledgements",
  "special_thanks",
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

type ExistingPersonRow = {
  id: string;
  full_name: string;
  role_title: string;
  team_type: "cast" | "production";
  bio: string;
  headshot_url: string;
  email: string;
  submission_status: string;
  submitted_at: string | null;
};

type RosterPerson = {
  name: string;
  role: string;
  teamType: "cast" | "production";
  email?: string;
  bio?: string;
  headshotUrl?: string;
};

type ProgramModuleRecord = {
  id: string;
  module_type: string;
  display_title: string;
  module_order: number;
  visible: boolean;
  filler_eligible: boolean;
  settings: Record<string, unknown>;
};

type ShowRoleRecord = {
  id: string;
  person_id: string;
  role_name: string;
  category: string;
  billing_order: number | null;
  bio_order: number | null;
};

type DensityMode = "normal" | "compact" | "loose";

export type ProgramPage =
  | { id: string; type: "poster"; title: string; imageUrl: string; subtitle: string }
  | { id: string; type: "text"; title: string; body: string }
  | { id: string; type: "stacked"; title: string; sections: Array<{ title: string; body: string }> }
  | { id: string; type: "bios"; title: string; people: PersonRecord[] }
  | { id: string; type: "image"; title: string; imageUrl: string }
  | { id: string; type: "photo_grid"; title: string; photos: string[] }
  | { id: string; type: "filler"; title: string; body: string };

export type ProgramSummary = {
  id: string;
  slug: string;
  title: string;
  show_dates: string;
  created_at: string;
};

export type ProgramWorkspaceSummary = ProgramSummary & {
  submission_total: number;
  submission_submitted: number;
  status: "draft" | "collecting" | "in_review" | "locked" | "published";
};

const payloadSchema = z.object({
  title: z.string().min(1),
  theatreName: z.string().optional().or(z.literal("")),
  showDates: z.string().optional().or(z.literal("")),
  showDatesOverride: z.string().optional().or(z.literal("")),
  performanceSchedule: z.string().optional().or(z.literal("[]")),
  posterImageUrl: z.string().optional().or(z.literal("")),
  directorNotes: z.string().optional().or(z.literal("")),
  dramaturgicalNote: z.string().optional().or(z.literal("")),
  musicDirectorNote: z.string().optional().or(z.literal("")),
  billingPage: z.string().optional().or(z.literal("")),
  actsAndSongs: z.string().optional().or(z.literal("")),
  departmentInfo: z.string().optional().or(z.literal("")),
  seasonCalendar: z.string().optional().or(z.literal("")),
  acknowledgements: z.string().optional().or(z.literal("")),
  specialThanks: z.string().optional().or(z.literal("")),
  actfAdImageUrl: z.string().optional().or(z.literal("")),
  rosterLines: z.string().optional().or(z.literal("")),
  castLines: z.string().optional().or(z.literal("")),
  productionTeamLines: z.string().optional().or(z.literal("")),
  productionPhotoUrls: z.string().optional(),
  customPages: z.string().optional(),
  layoutOrder: z.string().optional().or(z.literal(""))
});

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

function richTextToPlain(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateBioWeight(person: PersonRecord) {
  const plainLength = richTextToPlain(person.bio).length;
  const headshotWeight = person.headshot_url.trim() ? 180 : 60;
  return 220 + Math.min(1900, Math.round(plainLength * 0.45)) + headshotWeight;
}

function getBioPageBudget(densityMode: DensityMode) {
  if (densityMode === "compact") {
    return 2200;
  }
  if (densityMode === "loose") {
    return 1700;
  }
  return 1900;
}

function paginateBios(title: string, idBase: string, people: PersonRecord[], densityMode: DensityMode = "normal") {
  const PAGE_BUDGET = getBioPageBudget(densityMode);
  const pages: ProgramPage[] = [];
  let current: PersonRecord[] = [];
  let currentWeight = 0;

  for (const person of people) {
    const weight = estimateBioWeight(person);
    if (current.length > 0 && currentWeight + weight > PAGE_BUDGET) {
      pages.push({
        id: `${idBase}-${pages.length + 1}`,
        type: "bios",
        title: pages.length === 0 ? title : `${title} (cont.)`,
        people: current
      });
      current = [];
      currentWeight = 0;
    }

    current.push(person);
    currentWeight += weight;
  }

  if (current.length > 0) {
    pages.push({
      id: `${idBase}-${pages.length + 1}`,
      type: "bios",
      title: pages.length === 0 ? title : `${title} (cont.)`,
      people: current
    });
  }

  return pages;
}

function peopleWithBios(people: PersonRecord[]) {
  return people.filter((person) => richTextHasContent(person.bio));
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

function normalizeExistingPeopleRows(rows: Record<string, unknown>[]) {
  return rows.map((person) => ({
    id: String(person.id ?? ""),
    full_name: String(person.full_name ?? ""),
    role_title: String(person.role_title ?? ""),
    team_type: person.team_type === "cast" ? "cast" : "production",
    bio: String(person.bio ?? ""),
    headshot_url: String(person.headshot_url ?? ""),
    email: String(person.email ?? ""),
    submission_status: String(person.submission_status ?? "pending"),
    submitted_at: person.submitted_at ? String(person.submitted_at) : null
  })) as ExistingPersonRow[];
}

function mergeRosterWithExisting(rosterPeople: RosterPerson[], existingPeople: ExistingPersonRow[]) {
  const existingByKey = new Map<string, ExistingPersonRow>();
  for (const person of existingPeople) {
    const key = personKey(person.full_name, person.role_title, person.team_type);
    existingByKey.set(key, person);
  }

  return rosterPeople.map((person) => {
    const key = personKey(person.name, person.role, person.teamType);
    const existing = existingByKey.get(key);
    const finalBio = person.bio && richTextHasContent(person.bio) ? person.bio : existing?.bio ?? "";
    const submitted = richTextHasContent(finalBio);

    return {
      full_name: person.name,
      role_title: person.role,
      team_type: person.teamType,
      bio: finalBio,
      headshot_url: person.headshotUrl ?? existing?.headshot_url ?? "",
      email: person.email ?? existing?.email ?? "",
      submission_status: submitted ? "submitted" : "pending",
      submitted_at: submitted ? existing?.submitted_at ?? new Date().toISOString() : null
    };
  });
}

function generateAutoBilling(people: RosterPerson[]) {
  if (!people.length) {
    return "";
  }

  const cast = people.filter((person) => person.teamType === "cast");
  const production = people.filter((person) => person.teamType === "production");
  const creativeRolePattern =
    /director|assistant director|dramaturg|music director|choreographer|fight director|intimacy|designer|composer|lyricist|playwright|book by/i;
  const creativeTeam = production.filter((person) => creativeRolePattern.test(person.role));
  const productionTeam = production.filter((person) => !creativeRolePattern.test(person.role));

  const section = (title: string, rows: RosterPerson[], sortByRole = false) => {
    if (!rows.length) {
      return "";
    }
    const sorted = [...rows].sort((a, b) =>
      sortByRole ? a.role.localeCompare(b.role) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)
    );
    const listItems = sorted
      .map(
        (row) =>
          `<li class="billing-item"><span class="billing-left">${escapeHtml(row.role)}</span><span class="billing-leader" aria-hidden="true"></span><span class="billing-right">${escapeHtml(row.name)}</span></li>`
      )
      .join("");
    return `<section class="billing-section"><h3 class="billing-section-title">${escapeHtml(title)}</h3><ul class="billing-list">${listItems}</ul></section>`;
  };

  return (
    `<div class="billing-sheet">` +
    section("Cast", cast, false) +
    section("Creative Team", creativeTeam, true) +
    section("Production Team", productionTeam, true) +
    `</div>`
  );
}

function getResolvedBillingPage(
  manualBillingHtml: string,
  cast: Array<{ full_name: string; role_title: string }>,
  production: Array<{ full_name: string; role_title: string }>
) {
  if (richTextHasContent(manualBillingHtml)) {
    return manualBillingHtml;
  }
  const roster: RosterPerson[] = [
    ...cast.map((person) => ({
      name: person.full_name,
      role: person.role_title,
      teamType: "cast" as const
    })),
    ...production.map((person) => ({
      name: person.full_name,
      role: person.role_title,
      teamType: "production" as const
    }))
  ];
  return generateAutoBilling(roster);
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

function buildRoleListHtml(people: PersonRecord[]) {
  if (people.length === 0) {
    return "";
  }

  const sorted = [...people].sort(
    (a, b) => a.role_title.localeCompare(b.role_title) || a.full_name.localeCompare(b.full_name)
  );

  return `<ul>${sorted
    .map((person) => `<li><strong>${escapeHtml(person.role_title)}</strong>: ${escapeHtml(person.full_name)}</li>`)
    .join("")}</ul>`;
}

function normalizeRoleCategory(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "cast" || normalized === "cast_member" || normalized === "cast_list") return "cast";
  if (normalized === "creative" || normalized === "creative_team") return "creative";
  if (normalized === "production" || normalized === "production_team" || normalized === "crew" || normalized === "team") {
    return "production";
  }
  return "production";
}

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

function uniqueRoleNames(values: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of values) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(trimmed);
    }
  }
  return ordered;
}

function joinRoles(values: string[]) {
  return uniqueRoleNames(values).join(" & ");
}

function buildCategoryRoleListHtml(title: string, rows: Array<{ role: string; name: string }>, showTitle: boolean = true) {
  if (rows.length === 0) {
    return "";
  }
  const listItems = rows
    .map(
      (row) =>
        `<li class="billing-item"><span class="billing-left">${escapeHtml(row.role)}</span><span class="billing-leader" aria-hidden="true"></span><span class="billing-right">${escapeHtml(row.name)}</span></li>`
    )
    .join("");
  const heading = showTitle ? `<h3 class="playbill-title billing-section-title">${escapeHtml(title)}</h3>` : "";
  return `<section class="billing-section">${heading}<ul class="billing-list">${listItems}</ul></section>`;
}

function derivePeopleForBiosFromRoles(
  people: PersonRecord[],
  roles: ShowRoleRecord[]
) {
  const rolesByPersonId = new Map<string, ShowRoleRecord[]>();
  for (const role of roles) {
    const list = rolesByPersonId.get(role.person_id) ?? [];
    list.push(role);
    rolesByPersonId.set(role.person_id, list);
  }

  const castPeople: PersonRecord[] = [];
  const productionPeople: PersonRecord[] = [];

  for (const person of people) {
    const personRoles = rolesByPersonId.get(person.id) ?? [];
    if (personRoles.length === 0) {
      // Legacy fallback when roles are unavailable.
      if (person.team_type === "cast") {
        castPeople.push(person);
      } else {
        productionPeople.push(person);
      }
      continue;
    }

    const castRoles = personRoles
      .filter((role) => normalizeRoleCategory(role.category) === "cast")
      .sort((a, b) => (a.billing_order ?? Number.MAX_SAFE_INTEGER) - (b.billing_order ?? Number.MAX_SAFE_INTEGER))
      .map((role) => role.role_name);
    const nonCastRoles = personRoles
      .filter((role) => normalizeRoleCategory(role.category) !== "cast")
      .sort((a, b) => (a.bio_order ?? Number.MAX_SAFE_INTEGER) - (b.bio_order ?? Number.MAX_SAFE_INTEGER))
      .map((role) => role.role_name);

    if (castRoles.length > 0) {
      const castRoleLine = joinRoles(castRoles);
      const appended = nonCastRoles.length > 0 ? ` (${joinRoles(nonCastRoles)})` : "";
      castPeople.push({
        ...person,
        team_type: "cast",
        role_title: `${castRoleLine}${appended}`
      });
    } else {
      productionPeople.push({
        ...person,
        team_type: "production",
        role_title: joinRoles(nonCastRoles)
      });
    }
  }

  castPeople.sort((a, b) => a.full_name.localeCompare(b.full_name));
  productionPeople.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return { castPeople, productionPeople };
}

function buildRoleListRowsByCategory(
  people: PersonRecord[],
  roles: ShowRoleRecord[],
  category: "cast" | "creative" | "production"
) {
  const personNameById = new Map(people.map((person) => [person.id, person.full_name]));
  const grouped = new Map<string, { personId: string; name: string; roles: string[]; billingOrder: number | null }>();

  for (const role of roles) {
    if (normalizeRoleCategory(role.category) !== category) {
      continue;
    }
    const personName = personNameById.get(role.person_id);
    if (!personName) {
      continue;
    }
    const existing = grouped.get(role.person_id) ?? {
      personId: role.person_id,
      name: personName,
      roles: [],
      billingOrder: role.billing_order ?? null
    };
    existing.roles.push(role.role_name);
    if (existing.billingOrder === null && role.billing_order !== null) {
      existing.billingOrder = role.billing_order;
    }
    grouped.set(role.person_id, existing);
  }

  const rowsFromRoles = [...grouped.values()]
    .sort((a, b) => {
      if (category === "cast") {
        const aOrder = a.billingOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.billingOrder ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    })
    .map((row) => ({
      role: joinRoles(row.roles),
      name: row.name
    }));

  if (rowsFromRoles.length > 0) {
    return rowsFromRoles;
  }

  const creativeRolePattern =
    /director|assistant director|dramaturg|music director|choreographer|fight director|intimacy|designer|composer|lyricist|playwright|book by/i;

  // Legacy fallback: derive list rows from people if show_roles are unavailable.
  return people
    .filter((person) => {
      if (category === "cast") {
        return person.team_type === "cast";
      }
      if (person.team_type !== "production") {
        return false;
      }
      const isCreative = creativeRolePattern.test(person.role_title);
      return category === "creative" ? isCreative : !isCreative;
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((person) => ({
      role: person.role_title,
      name: person.full_name
    }));
}

function buildProductionInfoHtml(program: { theatre_name: string; show_dates: string; performance_schedule: PerformanceRecord[] }) {
  const rows: string[] = [];
  if (program.theatre_name.trim()) {
    rows.push(`<p><strong>Venue:</strong> ${escapeHtml(program.theatre_name)}</p>`);
  }
  if (program.show_dates.trim()) {
    rows.push(`<p><strong>Dates:</strong> ${escapeHtml(program.show_dates)}</p>`);
  }

  const scheduleRows = program.performance_schedule
    .map((item) => formatPerformanceLabel(item))
    .filter((item) => Boolean(item))
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  if (scheduleRows) {
    rows.push(`<p><strong>Performance Schedule</strong></p><ul>${scheduleRows}</ul>`);
  }

  return rows.join("");
}

function splitCreativeAndProductionTeam(people: PersonRecord[]) {
  const creativeRolePattern =
    /director|assistant director|dramaturg|music director|choreographer|fight director|intimacy|designer|composer|lyricist|playwright|book by/i;

  const creativeTeam = people.filter((person) => creativeRolePattern.test(person.role_title));
  const productionTeam = people.filter((person) => !creativeRolePattern.test(person.role_title));
  return { creativeTeam, productionTeam };
}

function getSettingString(settings: Record<string, unknown>, key: string) {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

function normalizeDensityMode(value: unknown): DensityMode {
  if (value === "compact" || value === "loose") {
    return value;
  }
  return "normal";
}

function isStackablePage(page: ProgramPage) {
  return page.type === "text" || (page.type === "filler" && richTextHasContent(page.body));
}

function isBillingStyledPage(page: ProgramPage) {
  if (page.type !== "text" && page.type !== "filler") {
    return false;
  }
  return page.body.includes("billing-section") || page.body.includes("billing-list");
}

function countTag(html: string, tag: string) {
  const re = new RegExp(`<${tag}(\\s|>)`, "gi");
  return (html.match(re) ?? []).length;
}

function estimateRichTextLines(html: string) {
  const plain = richTextToPlain(html);
  const charLines = Math.ceil(Math.max(1, plain.length) / 72);
  const paragraphBlocks = countTag(html, "p") + countTag(html, "li") + countTag(html, "blockquote");
  const headingBlocks = countTag(html, "h3") + countTag(html, "h4");
  const listBlocks = countTag(html, "ul") + countTag(html, "ol");
  const hardBreaks = (html.match(/<br\s*\/?>/gi) ?? []).length;

  return charLines + paragraphBlocks * 2 + headingBlocks * 2 + listBlocks * 3 + hardBreaks;
}

function estimateStackUnits(page: ProgramPage) {
  if (page.type === "text" || page.type === "filler") {
    const textBody = page.body;
    const lineEstimate = estimateRichTextLines(textBody);
    const titleUnits = page.title?.trim() ? 44 : 0;
    const densityFactor = isBillingStyledPage(page) ? 7.4 : 11.5;
    return titleUnits + Math.round(lineEstimate * densityFactor);
  }
  return Number.MAX_SAFE_INTEGER;
}

function getStackPageBudget(densityMode: DensityMode) {
  if (densityMode === "compact") {
    return 980;
  }
  if (densityMode === "loose") {
    return 800;
  }
  return 900;
}

function getBillingStackBudget(densityMode: DensityMode) {
  if (densityMode === "compact") {
    return 1450;
  }
  if (densityMode === "loose") {
    return 1180;
  }
  return 1325;
}

function renderModulePages(
  module: ProgramModuleRecord,
  index: number,
  program: {
    title: string;
    theatre_name: string;
    show_dates: string;
    performance_schedule: PerformanceRecord[];
    poster_image_url: string;
    director_notes: string;
    dramaturgical_note: string;
    music_director_note: string;
    billing_page: string;
    acts_songs: string;
    department_info: string;
    actf_ad_image_url: string;
    acknowledgements: string;
    special_thanks: string;
    season_calendar: string;
    production_photo_urls: string[];
    custom_pages: CustomPageRecord[];
  },
  rosterPeople: PersonRecord[],
  cast: PersonRecord[],
  production: PersonRecord[],
  showRoles: ShowRoleRecord[],
  densityMode: DensityMode
) {
  const normalizedType = normalizeModuleType(module.module_type);
  const moduleTitle = module.display_title.trim() || normalizedType.replace(/_/g, " ");
  const showHeader = Boolean(module.settings.show_header ?? true);
  const title = showHeader ? moduleTitle : "";
  const safeModuleId = module.id ? module.id.slice(0, 8) : String(index);
  const idBase = `${normalizedType}-${index}-${safeModuleId}`;
  const hasPoster = Boolean(program.poster_image_url.trim());
  const hasDirectorNote = richTextHasContent(program.director_notes);
  const hasDramaturgicalNote = richTextHasContent(program.dramaturgical_note);
  const hasMusicDirectorNote = richTextHasContent(program.music_director_note);
  const resolvedBillingPage = getResolvedBillingPage(program.billing_page, cast, production);
  const hasBilling = richTextHasContent(resolvedBillingPage);
  const hasActsSongs = richTextHasContent(program.acts_songs);
  const hasDepartmentInfo = richTextHasContent(program.department_info);
  const hasAcknowledgements = richTextHasContent(program.acknowledgements);
  const hasSpecialThanks = richTextHasContent(program.special_thanks);
  const hasSeasonCalendar = richTextHasContent(program.season_calendar);
  const hasActfImage = Boolean(program.actf_ad_image_url.trim());
  const castWithBios = peopleWithBios(cast);
  const productionWithBios = peopleWithBios(production);
  const allHeadshots = [...cast, ...production].map((person) => person.headshot_url).filter((url) => Boolean(url.trim()));
  const emptyPlaceholder = (placeholderTitle: string, body: string) =>
    [
      {
        id: `${idBase}-placeholder`,
        type: "filler" as const,
        title: placeholderTitle,
        body
      }
    ] satisfies ProgramPage[];

  if (normalizedType === "cover") {
    if (!hasPoster) {
      return [] as ProgramPage[];
    }
    return [
      {
        id: idBase,
        type: "poster",
        title: program.title,
        subtitle: "",
        imageUrl: program.poster_image_url
      }
    ] satisfies ProgramPage[];
  }

  if (normalizedType === "production_info") {
    const body = buildProductionInfoHtml(program);
    if (!richTextHasContent(body)) {
      return emptyPlaceholder(
        title,
        "Production Info is enabled, but no venue/date/schedule data is available yet. Update Show Settings: Poster + Performance Schedule."
      );
    }
    return [{ id: idBase, type: "text", title, body }] satisfies ProgramPage[];
  }

  if (normalizedType === "cast_list") {
    const body = buildCategoryRoleListHtml(
      moduleTitle,
      buildRoleListRowsByCategory(rosterPeople, showRoles, "cast"),
      showHeader
    );
    if (!richTextHasContent(body)) {
      return emptyPlaceholder(
        title,
        "Cast List is enabled, but no cast records were found. In People and Roles, confirm entries are assigned to category: cast."
      );
    }
    return [{ id: idBase, type: "text", title: "", body }] satisfies ProgramPage[];
  }

  if (normalizedType === "creative_team") {
    const body = buildCategoryRoleListHtml(
      moduleTitle,
      buildRoleListRowsByCategory(rosterPeople, showRoles, "creative"),
      showHeader
    );
    if (!richTextHasContent(body)) {
      return emptyPlaceholder(
        title,
        "Creative Team module is enabled, but no creative team records were found. Add people in People and Roles with category: creative."
      );
    }
    return [{ id: idBase, type: "text", title: "", body }] satisfies ProgramPage[];
  }

  if (normalizedType === "production_team") {
    const body = buildCategoryRoleListHtml(
      moduleTitle,
      buildRoleListRowsByCategory(rosterPeople, showRoles, "production"),
      showHeader
    );
    if (!richTextHasContent(body)) {
      return emptyPlaceholder(
        title,
        "Production Team module is enabled, but no production records were found. Add people in People and Roles with category: production."
      );
    }
    return [{ id: idBase, type: "text", title: "", body }] satisfies ProgramPage[];
  }

  if (normalizedType === "bios") {
    const pages: ProgramPage[] = [];
    const scope = getSettingString(module.settings, "scope");
    const allowMultiplePages = Boolean(module.settings.allow_multiple_pages ?? true);
    if (scope !== "production" && cast.length > 0) {
      const castPages = paginateBios(`${title}: Cast`, `${idBase}-cast`, castWithBios, densityMode);
      if (allowMultiplePages) {
        pages.push(...castPages);
      } else if (castPages.length > 0) {
        pages.push(castPages[0]);
      }
    }
    if (scope !== "cast" && production.length > 0) {
      const productionPages = paginateBios(`${title}: Production Team`, `${idBase}-production`, productionWithBios, densityMode);
      if (allowMultiplePages) {
        pages.push(...productionPages);
      } else if (productionPages.length > 0) {
        pages.push(productionPages[0]);
      }
    }
    return pages;
  }

  if (normalizedType === "director_note") {
    if (!hasDirectorNote) {
      return emptyPlaceholder(title, "Director's note module is enabled, but no note content has been submitted yet.");
    }
    return [{ id: idBase, type: "text", title, body: program.director_notes }] satisfies ProgramPage[];
  }

  if (normalizedType === "dramaturgical_note") {
    if (!hasDramaturgicalNote) {
      return emptyPlaceholder(title, "Dramaturgical note module is enabled, but no note content has been submitted yet.");
    }
    return [{ id: idBase, type: "text", title, body: program.dramaturgical_note }] satisfies ProgramPage[];
  }

  if (normalizedType === "music_director_note") {
    if (!hasMusicDirectorNote) {
      return emptyPlaceholder(title, "Music director note module is enabled, but no note content has been submitted yet.");
    }
    return [{ id: idBase, type: "text", title, body: program.music_director_note }] satisfies ProgramPage[];
  }

  if (normalizedType === "acts_scenes" || normalizedType === "songs") {
    if (!hasActsSongs) {
      return [] as ProgramPage[];
    }
    return [{ id: idBase, type: "text", title, body: program.acts_songs }] satisfies ProgramPage[];
  }

  if (normalizedType === "headshots_grid") {
    const photos = allHeadshots.length > 0 ? allHeadshots : program.production_photo_urls;
    if (photos.length === 0) {
      return [] as ProgramPage[];
    }
    return [{ id: idBase, type: "photo_grid", title, photos }] satisfies ProgramPage[];
  }

  if (normalizedType === "production_photos") {
    if (program.production_photo_urls.length === 0) {
      return [] as ProgramPage[];
    }
    return [{ id: idBase, type: "photo_grid", title, photos: program.production_photo_urls }] satisfies ProgramPage[];
  }

  if (normalizedType === "sponsors") {
    const pages: ProgramPage[] = [];
    if (hasActfImage) {
      pages.push({ id: `${idBase}-image`, type: "image", title, imageUrl: program.actf_ad_image_url });
    }
    if (hasAcknowledgements) {
      pages.push({ id: `${idBase}-text`, type: "text", title, body: program.acknowledgements });
    }
    return pages;
  }

  if (normalizedType === "special_thanks") {
    if (!hasSpecialThanks) {
      return emptyPlaceholder(title, "Special Thanks module is enabled, but no Special Thanks content was added yet.");
    }
    return [{ id: idBase, type: "text", title, body: program.special_thanks }] satisfies ProgramPage[];
  }

  if (normalizedType === "acknowledgements") {
    if (!hasAcknowledgements) {
      return emptyPlaceholder(title, "Acknowledgements module is enabled, but no acknowledgements content was added yet.");
    }
    return [{ id: idBase, type: "text", title, body: program.acknowledgements }] satisfies ProgramPage[];
  }

  if (normalizedType === "back_cover") {
    const mode = getSettingString(module.settings, "mode") || "schedule";
    if (mode === "image") {
      if (hasActfImage) {
        return [{ id: idBase, type: "image", title, imageUrl: program.actf_ad_image_url }] satisfies ProgramPage[];
      }
      return [] as ProgramPage[];
    }

    if (mode === "auto") {
      if (hasSeasonCalendar) {
        return [{ id: idBase, type: "text", title, body: program.season_calendar }] satisfies ProgramPage[];
      }
      if (hasActfImage) {
        return [{ id: idBase, type: "image", title, imageUrl: program.actf_ad_image_url }] satisfies ProgramPage[];
      }
      return [] as ProgramPage[];
    }

    if (hasSeasonCalendar) {
      return [{ id: idBase, type: "text", title, body: program.season_calendar }] satisfies ProgramPage[];
    }
    return [] as ProgramPage[];
  }

  if (normalizedType === "billing" && hasBilling) {
    return [{ id: idBase, type: "text", title, body: resolvedBillingPage }] satisfies ProgramPage[];
  }

  if (normalizedType === "department_info" && hasDepartmentInfo) {
    return [{ id: idBase, type: "text", title, body: program.department_info }] satisfies ProgramPage[];
  }

  if (normalizedType === "custom_pages") {
    const pages: ProgramPage[] = [];
    const allowMultiplePages = Boolean(module.settings.allow_multiple_pages ?? true);
    for (let i = 0; i < program.custom_pages.length; i += 1) {
      pages.push(mapCustomPageToRenderable(program.custom_pages[i], i));
      if (!allowMultiplePages) {
        break;
      }
    }
    return pages;
  }

  if (normalizedType === "custom_text") {
    const body = sanitizeRichText(getSettingString(module.settings, "body"));
    if (!richTextHasContent(body)) {
      return [] as ProgramPage[];
    }
    return [{ id: idBase, type: "text", title, body }] satisfies ProgramPage[];
  }

  if (normalizedType === "custom_image") {
    const imageUrl = getSettingString(module.settings, "image_url");
    if (!isValidHttpUrl(imageUrl)) {
      return [] as ProgramPage[];
    }
    return [{ id: idBase, type: "image", title, imageUrl }] satisfies ProgramPage[];
  }

  return [] as ProgramPage[];
}

function buildRenderablePagesFromModules(
  program: {
    title: string;
    theatre_name: string;
    show_dates: string;
    performance_schedule: PerformanceRecord[];
    poster_image_url: string;
    director_notes: string;
    dramaturgical_note: string;
    music_director_note: string;
    billing_page: string;
    acts_songs: string;
    department_info: string;
    actf_ad_image_url: string;
    acknowledgements: string;
    special_thanks: string;
    season_calendar: string;
    production_photo_urls: string[];
    custom_pages: CustomPageRecord[];
  },
  rosterPeople: PersonRecord[],
  cast: PersonRecord[],
  production: PersonRecord[],
  showRoles: ShowRoleRecord[],
  modules: ProgramModuleRecord[],
  densityMode: DensityMode = "normal"
) {
  const pages: ProgramPage[] = [];
  const visibleModules = modules.filter((module) => module.visible).sort((a, b) => a.module_order - b.module_order);
  const stackBudget = getStackPageBudget(densityMode);
  let stackCounter = 0;
  let stackBuffer: Array<{ title: string; body: string; units: number; originalPage: ProgramPage }> = [];
  let stackUsed = 0;

  const flushStackBuffer = () => {
    if (stackBuffer.length === 0) {
      return;
    }
    if (stackBuffer.length === 1) {
      pages.push(stackBuffer[0].originalPage);
      stackBuffer = [];
      stackUsed = 0;
      return;
    }
    const firstTitle = stackBuffer.find((section) => section.title.trim())?.title ?? "Combined Sections";
    pages.push({
      id: `stacked-${stackCounter + 1}`,
      type: "stacked",
      title: firstTitle,
      sections: stackBuffer.map((section) => ({
        title: section.title,
        body: section.body
      }))
    });
    stackCounter += 1;
    stackBuffer = [];
    stackUsed = 0;
  };

  for (let index = 0; index < visibleModules.length; index += 1) {
    const module = visibleModules[index];
    const renderedPages = renderModulePages(module, index, program, rosterPeople, cast, production, showRoles, densityMode);
    if (renderedPages.length === 0) {
      continue;
    }

    const separatePage = Boolean(module.settings.separate_page ?? true);
    const keepTogether = Boolean(module.settings.keep_together ?? false);
    const canStackModule = !separatePage && !keepTogether && renderedPages.length === 1 && isStackablePage(renderedPages[0]);
    if (!canStackModule) {
      flushStackBuffer();
      pages.push(...renderedPages);
      continue;
    }

    const page = renderedPages[0];
    const units = estimateStackUnits(page);
    if (units > stackBudget) {
      flushStackBuffer();
      pages.push(page);
      continue;
    }

    const isBillingPage = isBillingStyledPage(page);
    const activeBudget = isBillingPage ? getBillingStackBudget(densityMode) : stackBudget;

    if (stackUsed > 0 && stackUsed + units > activeBudget) {
      flushStackBuffer();
    }

    if (page.type === "text" || page.type === "filler") {
      stackBuffer.push({
        title: page.title,
        body: page.body,
        units,
        originalPage: page
      });
      stackUsed += units;
    } else {
      flushStackBuffer();
      pages.push(page);
    }
  }
  flushStackBuffer();

  if (!modules.some((module) => module.visible && normalizeModuleType(module.module_type) === "custom_pages")) {
    for (let i = 0; i < program.custom_pages.length; i += 1) {
      pages.push(mapCustomPageToRenderable(program.custom_pages[i], i));
    }
  }

  return pages;
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

  const readText = (key: string) => formData.get(key)?.toString() ?? "";
  const parseResult = payloadSchema.safeParse({
    title: readText("title"),
    theatreName: readText("theatreName"),
    showDates: readText("showDates"),
    showDatesOverride: readText("showDatesOverride"),
    performanceSchedule: readText("performanceSchedule") || "[]",
    posterImageUrl: readText("posterImageUrl"),
    directorNotes: readText("directorNotes"),
      dramaturgicalNote: readText("dramaturgicalNote"),
      musicDirectorNote: readText("musicDirectorNote"),
    billingPage: readText("billingPage"),
    actsAndSongs: readText("actsAndSongs"),
    departmentInfo: readText("departmentInfo"),
    seasonCalendar: readText("seasonCalendar"),
    acknowledgements: readText("acknowledgements"),
    specialThanks: readText("specialThanks"),
    actfAdImageUrl: readText("actfAdImageUrl"),
    rosterLines: readText("rosterLines"),
    castLines: readText("castLines"),
    productionTeamLines: readText("productionTeamLines"),
    productionPhotoUrls: formData.get("productionPhotoUrls")?.toString(),
    customPages: formData.get("customPages")?.toString(),
    layoutOrder: readText("layoutOrder")
  });
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return redirectWithError("/programs/new", `Invalid ${issue?.path?.join(".") || "input"}: ${issue?.message ?? "check your form values."}`);
  }
  const parsed = parseResult.data;

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

  const posterImageUrl = (() => {
    try {
      return normalizeOptionalHttpUrl(parsed.posterImageUrl, "Poster image URL");
    } catch (error) {
      return redirectWithError("/programs/new", error instanceof Error ? error.message : "Invalid poster image URL.");
    }
  })();
  const actfAdImageUrl = (() => {
    try {
      return normalizeOptionalHttpUrl(parsed.actfAdImageUrl, "ACTF ad image URL");
    } catch (error) {
      return redirectWithError("/programs/new", error instanceof Error ? error.message : "Invalid ACTF ad image URL.");
    }
  })();
  const productionPhotoUrls = parseProductionPhotos(parsed.productionPhotoUrls);
  let customPages: CustomPageRecord[] = [];
  try {
    customPages = parseCustomPages(parsed.customPages);
  } catch (error) {
    return redirectWithError("/programs/new", error instanceof Error ? error.message : "Invalid custom pages format.");
  }

  const billingHtml = sanitizeRichText(parsed.billingPage);
  const resolvedBilling = richTextHasContent(billingHtml) ? billingHtml : generateAutoBilling(rosterPeople);

  const programsColumns = await getTableColumns(client, "programs");
  const rawProgramInsert: Record<string, unknown> = {
    title: parsed.title,
    slug,
    theatre_name: parsed.theatreName ?? "",
    show_dates: resolvedShowDates,
    performance_schedule: performanceSchedule,
    poster_image_url: posterImageUrl,
    director_notes: sanitizeRichText(parsed.directorNotes),
    dramaturgical_note: sanitizeRichText(parsed.dramaturgicalNote),
    music_director_note: sanitizeRichText(parsed.musicDirectorNote),
    billing_page: resolvedBilling,
    acts_songs: sanitizeRichText(parsed.actsAndSongs),
    department_info: sanitizeRichText(parsed.departmentInfo),
    actf_ad_image_url: actfAdImageUrl,
    acknowledgements: sanitizeRichText(parsed.acknowledgements),
    special_thanks: sanitizeRichText(parsed.specialThanks),
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
  const mergedPeopleRows = mergeRosterWithExisting(rosterPeople, []);
  const peopleRows = mergedPeopleRows.map((person) =>
    filterToColumns(
      {
        program_id: program.id,
        full_name: person.full_name,
        role_title: person.role_title,
        bio: person.bio,
        team_type: person.team_type,
        headshot_url: person.headshot_url,
        email: person.email,
        submission_status: person.submission_status,
        submitted_at: person.submitted_at
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
    music_director_note: string;
    billing_page: string;
    acts_songs: string;
    department_info: string;
    actf_ad_image_url: string;
    acknowledgements: string;
  season_calendar: string;
  production_photo_urls: string[];
  custom_pages: CustomPageRecord[];
  special_thanks: string;
  layout_order: LayoutToken[];
  },
  cast: PersonRecord[],
  production: PersonRecord[],
  densityMode: DensityMode = "normal"
) {
  const hasText = (value: string) => Boolean(value && value.trim().length > 0);
  const castWithBios = peopleWithBios(cast);
  const productionWithBios = peopleWithBios(production);
  const resolvedBillingPage = getResolvedBillingPage(program.billing_page, cast, production);
  const pageByToken: Record<Exclude<LayoutToken, "custom_pages" | "production_photos">, ProgramPage> = {
    poster: {
      id: "poster",
      type: "poster",
      title: program.title,
      subtitle: "",
      imageUrl: program.poster_image_url
    },
    director_note: { id: "director-note", type: "text", title: "Director's Note", body: program.director_notes },
    dramaturgical_note: {
      id: "dramaturgical-note",
      type: "text",
      title: "Dramaturgical Note",
      body: program.dramaturgical_note
    },
    music_director_note: {
      id: "music-director-note",
      type: "text",
      title: "Music Director's Note",
      body: program.music_director_note
    },
    billing: { id: "billing", type: "text", title: "Billing", body: resolvedBillingPage },
    acts_songs: { id: "acts-songs", type: "text", title: "Acts & Songs", body: program.acts_songs },
    cast_bios: { id: "cast-bios", type: "filler", title: "cast-bios", body: "" },
    team_bios: { id: "team-bios", type: "filler", title: "team-bios", body: "" },
    department_info: {
      id: "department-info",
      type: "text",
      title: "Producing Department / Company",
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
    special_thanks: {
      id: "special-thanks",
      type: "text",
      title: "Special Thanks",
      body: program.special_thanks
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
    if (token === "music_director_note" && !richTextHasContent(program.music_director_note)) {
      continue;
    }
    if (token === "billing" && !richTextHasContent(resolvedBillingPage)) {
      continue;
    }
    if (token === "acts_songs" && !richTextHasContent(program.acts_songs)) {
      continue;
    }
    if (token === "cast_bios" && castWithBios.length === 0) {
      continue;
    }
    if (token === "team_bios" && productionWithBios.length === 0) {
      continue;
    }
    if (token === "department_info" && !richTextHasContent(program.department_info)) {
      continue;
    }
    if (token === "acknowledgements" && !richTextHasContent(program.acknowledgements)) {
      continue;
    }
    if (token === "special_thanks" && !richTextHasContent(program.special_thanks)) {
      continue;
    }
    if (token === "season_calendar" && !richTextHasContent(program.season_calendar)) {
      continue;
    }

    if (token === "cast_bios") {
      pages.push(...paginateBios("Who's Who in the Cast", "cast-bios", castWithBios, densityMode));
      continue;
    }

    if (token === "team_bios") {
      pages.push(...paginateBios("Who's Who in the Production Team", "team-bios", productionWithBios, densityMode));
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

export async function getProgramBySlug(
  slug: string,
  options?: {
    forceVisibleModuleIds?: string[];
    previewModuleId?: string;
  }
) {
  try {
    // Use server write client for deterministic renderer reads across RLS policies.
    const client = getSupabaseWriteClient();

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

    let castPeople = normalizedPeople
      .filter((person) => person.team_type === "cast")
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    let productionPeople = normalizedPeople
      .filter((person) => person.team_type === "production")
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    const safeProgram = {
      title: String(program.title ?? "Untitled Show"),
      theatre_name: String(program.theatre_name ?? ""),
      show_dates: String(program.show_dates ?? ""),
      performance_schedule: Array.isArray(program.performance_schedule)
        ? (program.performance_schedule as PerformanceRecord[])
        : [],
      poster_image_url: String(program.poster_image_url ?? ""),
      director_notes: String(program.director_notes ?? ""),
      dramaturgical_note: String(program.dramaturgical_note ?? ""),
      music_director_note: String(program.music_director_note ?? ""),
      billing_page: String(program.billing_page ?? ""),
      acts_songs: String(program.acts_songs ?? ""),
      department_info: String(program.department_info ?? ""),
      actf_ad_image_url: String(program.actf_ad_image_url ?? ""),
      acknowledgements: String(program.acknowledgements ?? ""),
      special_thanks: String((program as Record<string, unknown>).special_thanks ?? ""),
      season_calendar: String(program.season_calendar ?? ""),
      production_photo_urls: Array.isArray(program.production_photo_urls) ? (program.production_photo_urls as string[]) : [],
      custom_pages: Array.isArray(program.custom_pages) ? (program.custom_pages as CustomPageRecord[]) : [],
      layout_order: Array.isArray(program.layout_order) ? (program.layout_order as LayoutToken[]) : [...layoutTokenValues]
    };

    let pageSequence: ProgramPage[] = [];
    let appliedDensityMode: DensityMode = "normal";
    let optimizationSteps: string[] = [];
    let fillerModulesUsed: string[] = [];
    let normalizedModules: ProgramModuleRecord[] = [];
    let showRoleAssignments: ShowRoleRecord[] = [];
    let modulePreviewPage: ProgramPage | null = null;
    const { data: show } = await client
      .from("shows")
      .select("id, season_id, start_date, end_date")
      .eq("program_id", String(program.id))
      .maybeSingle();

    if (show?.id) {
      try {
        const { data: roleRows } = await client
          .from("show_roles")
          .select("id, person_id, role_name, category, billing_order, bio_order")
          .eq("show_id", String(show.id));
        showRoleAssignments = (roleRows ?? []).map((row) => ({
          id: String(row.id ?? ""),
          person_id: String(row.person_id ?? ""),
          role_name: String(row.role_name ?? ""),
          category: String(row.category ?? "production"),
          billing_order: row.billing_order === null ? null : Number(row.billing_order ?? null),
          bio_order: row.bio_order === null ? null : Number(row.bio_order ?? null)
        }));
        if (showRoleAssignments.length > 0) {
          const derived = derivePeopleForBiosFromRoles(normalizedPeople, showRoleAssignments);
          castPeople = derived.castPeople;
          productionPeople = derived.productionPeople;
        }
      } catch {
        // keep legacy people-role data if show_roles table is unavailable
      }

      try {
        if (show.season_id) {
          const { data: events } = await client
            .from("season_events")
            .select("id, season_id, title, location, event_start_date, event_end_date, time_text, sort_order")
            .eq("season_id", String(show.season_id))
            .order("event_start_date", { ascending: true })
            .order("sort_order", { ascending: true });

          const cutoffSource = String(show.end_date ?? show.start_date ?? "").trim();
          const cutoff = cutoffSource ? new Date(`${cutoffSource}T00:00:00`) : null;
          const upcoming = (events ?? []).filter((event) => {
            if (!cutoff || Number.isNaN(cutoff.getTime())) return true;
            const start = new Date(`${String(event.event_start_date ?? "")}T00:00:00`);
            return !Number.isNaN(start.getTime()) && start.getTime() > cutoff.getTime();
          });
          safeProgram.season_calendar = buildSeasonCalendarHtml(
            upcoming.map((event) => ({
              id: String(event.id ?? ""),
              season_id: String(event.season_id ?? ""),
              title: String(event.title ?? ""),
              location: String(event.location ?? ""),
              event_start_date: String(event.event_start_date ?? ""),
              event_end_date: event.event_end_date ? String(event.event_end_date) : null,
              time_text: String(event.time_text ?? ""),
              sort_order: Number(event.sort_order ?? 0)
            }))
          );
        } else {
          safeProgram.season_calendar = "";
        }
      } catch {
        // Keep existing season calendar if season tables are not available yet.
      }

      try {
        const { data: bindings } = await client
          .from("show_departments")
          .select("department_id, sort_order")
          .eq("show_id", String(show.id))
          .order("sort_order", { ascending: true });
        const departmentIds = (bindings ?? []).map((row) => String(row.department_id ?? "")).filter(Boolean);
        if (departmentIds.length > 0) {
          const { data: departments } = await client
            .from("departments")
            .select("id, name, description, website, contact_email, contact_phone")
            .in("id", departmentIds);
          const order = new Map(departmentIds.map((id, index) => [id, index]));
          const orderedDepartments = (departments ?? [])
            .map((row) => ({
              id: String(row.id ?? ""),
              name: String(row.name ?? ""),
              description: String(row.description ?? ""),
              website: String(row.website ?? ""),
              contact_email: String(row.contact_email ?? ""),
              contact_phone: String(row.contact_phone ?? "")
            }))
            .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
          safeProgram.department_info = buildDepartmentInfoHtml(orderedDepartments);
        } else {
          safeProgram.department_info = "";
        }
      } catch {
        // Keep existing program.department_info if department tables are not available yet.
      }

      const { data: styleRow } = await client
        .from("show_style_settings")
        .select("density_mode")
        .eq("show_id", String(show.id))
        .maybeSingle();
      appliedDensityMode = normalizeDensityMode(styleRow?.density_mode);

      const { data: modules } = await client
        .from("program_modules")
        .select("id, module_type, display_title, module_order, visible, filler_eligible, settings")
        .eq("show_id", String(show.id))
        .order("module_order", { ascending: true });

      normalizedModules = (modules ?? []).map((module) => ({
        id: String(module.id),
        module_type: String(module.module_type ?? ""),
        display_title: String(module.display_title ?? ""),
        module_order: Number(module.module_order ?? 0),
        visible: Boolean(module.visible),
        filler_eligible: Boolean(module.filler_eligible),
        settings: (module.settings as Record<string, unknown>) ?? {}
      })) as ProgramModuleRecord[];
      const forcedVisible = new Set((options?.forceVisibleModuleIds ?? []).map((id) => String(id)));
      if (forcedVisible.size > 0) {
        normalizedModules = normalizedModules.map((module) =>
          forcedVisible.has(module.id) ? { ...module, visible: true } : module
        );
      }

      const previewModuleId = String(options?.previewModuleId ?? "").trim();
      if (previewModuleId) {
        const previewTarget = normalizedModules.find((module) => module.id === previewModuleId);
        if (previewTarget) {
          const previewRendered = renderModulePages(
            { ...previewTarget, visible: true },
            0,
            safeProgram,
            normalizedPeople,
            castPeople,
            productionPeople,
            showRoleAssignments,
            appliedDensityMode
          );
          modulePreviewPage = previewRendered[0] ?? null;
        }
      }

      pageSequence = buildRenderablePagesFromModules(
        safeProgram,
        normalizedPeople,
        castPeople,
        productionPeople,
        showRoleAssignments,
        normalizedModules,
        appliedDensityMode
      );
    }

    if (pageSequence.length === 0) {
      pageSequence = buildRenderablePages(safeProgram, castPeople, productionPeople, appliedDensityMode);
    }

    const getPaddingNeeded = (count: number) => (4 - (count % 4)) % 4;
    let currentPaddingNeeded = getPaddingNeeded(pageSequence.length);

    if (currentPaddingNeeded > 0 && appliedDensityMode !== "compact" && normalizedModules.length > 0) {
      const compactPages = buildRenderablePagesFromModules(
        safeProgram,
        normalizedPeople,
        castPeople,
        productionPeople,
        showRoleAssignments,
        normalizedModules,
        "compact"
      );
      if (compactPages.length > 0) {
        const compactPaddingNeeded = getPaddingNeeded(compactPages.length);
        if (compactPaddingNeeded < currentPaddingNeeded) {
          pageSequence = compactPages;
          appliedDensityMode = "compact";
          currentPaddingNeeded = compactPaddingNeeded;
          optimizationSteps.push("Applied compact density to reduce booklet padding.");
        }
      }
    }

    if (currentPaddingNeeded > 0 && normalizedModules.length > 0) {
      const fillerPool = normalizedModules
        .filter((module) => !module.visible && module.filler_eligible)
        .sort((a, b) => a.module_order - b.module_order);

      if (fillerPool.length > 0) {
        const candidatePages = [...pageSequence];
        const used: string[] = [];
        for (let index = 0; index < fillerPool.length; index += 1) {
          const module = fillerPool[index];
          const rendered = renderModulePages(
            module,
            normalizedModules.length + index,
            safeProgram,
            normalizedPeople,
            castPeople,
            productionPeople,
            showRoleAssignments,
            appliedDensityMode
          );
          if (rendered.length === 0) {
            continue;
          }
          candidatePages.push(...rendered);
          used.push(module.display_title || module.module_type);
          if (getPaddingNeeded(candidatePages.length) === 0) {
            break;
          }
        }

        if (candidatePages.length > pageSequence.length) {
          pageSequence = candidatePages;
          fillerModulesUsed = used;
          const nextPadding = getPaddingNeeded(pageSequence.length);
          if (nextPadding < currentPaddingNeeded) {
            optimizationSteps.push(`Used filler-eligible hidden modules: ${used.join(", ")}`);
          }
          currentPaddingNeeded = nextPadding;
        }
      }
    }

    const paddedPages = padToMultipleOf4<ProgramPage>(pageSequence, (index) => ({
      id: `filler-${index}`,
      type: "filler",
      title: "",
      body: ""
    }));
    const paddingNeeded = Math.max(0, paddedPages.length - pageSequence.length);
    if (paddingNeeded > 0) {
      optimizationSteps.push(`Still requires ${paddingNeeded} blank padding page${paddingNeeded === 1 ? "" : "s"}.`);
    }

    const bookletSpreads = buildBookletSpreads(paddedPages);
    const flattenedSpreadOrder = bookletSpreads.flatMap((spread) => [spread.left.content.id, spread.right.content.id]);
    const paddedOrder = paddedPages.map((page) => page.id);
    const parityMatches =
      flattenedSpreadOrder.length === paddedOrder.length &&
      flattenedSpreadOrder.every((id, index) => id === paddedOrder[index]);
    if (!parityMatches) {
      optimizationSteps.push("Warning: preview/export parity check flagged a page ordering mismatch.");
    }

    return {
      id: String(program.id),
      slug: String(program.slug),
      created_at: String(program.created_at ?? ""),
      ...safeProgram,
      castPeople,
      productionPeople,
      pageSequence,
      paddedPages,
      paddingNeeded,
      appliedDensityMode,
      fillerModulesUsed,
      optimizationSteps,
      modulePreviewPage,
      previewExportParityOk: parityMatches,
      bookletSpreads
    };
  } catch {
    return null;
  }
}

export async function getProgramsList() {
  try {
    const missingEnv = getMissingSupabaseEnvVars();
    if (missingEnv.length > 0) {
      return [] as ProgramSummary[];
    }

    const client = getSupabaseWriteClient();
    const { data, error } = await client
      .from("programs")
      .select("id, slug, title, show_dates, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [] as ProgramSummary[];
    }

    return data.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title ?? "Untitled Show"),
      show_dates: String(row.show_dates ?? ""),
      created_at: String(row.created_at ?? "")
    })) as ProgramSummary[];
  } catch {
    return [] as ProgramSummary[];
  }
}

function deriveProgramStatus(submitted: number, total: number): ProgramWorkspaceSummary["status"] {
  if (total === 0) {
    return "draft";
  }
  if (submitted === 0) {
    return "collecting";
  }
  if (submitted < total) {
    return "in_review";
  }
  return "locked";
}

export async function getProgramWorkspaceList() {
  const programs = await getProgramsList();
  if (programs.length === 0) {
    return [] as ProgramWorkspaceSummary[];
  }

  try {
    const missingEnv = getMissingSupabaseEnvVars();
    if (missingEnv.length > 0) {
      return programs.map((program) => ({
        ...program,
        submission_total: 0,
        submission_submitted: 0,
        status: "draft"
      }));
    }

    const client = getSupabaseWriteClient();
    const { data: peopleRows } = await client.from("people").select("program_id, submission_status");

    const summaryByProgram = new Map<string, { total: number; submitted: number }>();
    for (const row of peopleRows ?? []) {
      const programId = String(row.program_id ?? "");
      const current = summaryByProgram.get(programId) ?? { total: 0, submitted: 0 };
      current.total += 1;
      if (String(row.submission_status ?? "") === "submitted") {
        current.submitted += 1;
      }
      summaryByProgram.set(programId, current);
    }

    return programs.map((program) => {
      const summary = summaryByProgram.get(program.id) ?? { total: 0, submitted: 0 };
      return {
        ...program,
        submission_total: summary.total,
        submission_submitted: summary.submitted,
        status: deriveProgramStatus(summary.submitted, summary.total)
      };
    });
  } catch {
    return programs.map((program) => ({
      ...program,
      submission_total: 0,
      submission_submitted: 0,
      status: "draft"
    }));
  }
}

export async function updateProgram(slug: string, formData: FormData) {
  "use server";

  const readText = (key: string) => formData.get(key)?.toString() ?? "";
  const parseResult = payloadSchema.safeParse({
    title: readText("title"),
    theatreName: readText("theatreName"),
    showDates: readText("showDates"),
    showDatesOverride: readText("showDatesOverride"),
    performanceSchedule: readText("performanceSchedule") || "[]",
    posterImageUrl: readText("posterImageUrl"),
    directorNotes: readText("directorNotes"),
      dramaturgicalNote: readText("dramaturgicalNote"),
      musicDirectorNote: readText("musicDirectorNote"),
    billingPage: readText("billingPage"),
    actsAndSongs: readText("actsAndSongs"),
    departmentInfo: readText("departmentInfo"),
    seasonCalendar: readText("seasonCalendar"),
    acknowledgements: readText("acknowledgements"),
    specialThanks: readText("specialThanks"),
    actfAdImageUrl: readText("actfAdImageUrl"),
    rosterLines: readText("rosterLines"),
    castLines: readText("castLines"),
    productionTeamLines: readText("productionTeamLines"),
    productionPhotoUrls: formData.get("productionPhotoUrls")?.toString(),
    customPages: formData.get("customPages")?.toString(),
    layoutOrder: readText("layoutOrder")
  });
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return redirectWithError(`/programs/${slug}/edit`, `Invalid ${issue?.path?.join(".") || "input"}: ${issue?.message ?? "check your form values."}`);
  }
  const parsed = parseResult.data;

  const missingEnv = getMissingSupabaseEnvVars();
  if (missingEnv.length > 0) {
    redirectWithError(`/programs/${slug}/edit`, `Supabase is not configured: ${missingEnv.join(", ")}`);
  }

  const client = getSupabaseWriteClient();

  const { data: existingProgram, error: existingProgramError } = await client
    .from("programs")
    .select("id, slug, acts_songs, department_info, season_calendar, poster_image_url, show_dates, performance_schedule")
    .eq("slug", slug)
    .single();
  if (existingProgramError || !existingProgram) {
    redirectWithError("/programs", "Program not found.");
  }

  const { data: linkedShow } = await client
    .from("shows")
    .select("id")
    .eq("program_id", existingProgram.id)
    .maybeSingle();

  const { data: existingPeopleRows } = await client.from("people").select("*").eq("program_id", existingProgram.id);
  const existingPeople = normalizeExistingPeopleRows((existingPeopleRows ?? []) as Record<string, unknown>[]);

  const layoutOrderRaw = parsed.layoutOrder?.trim() ?? "";
  let layoutOrder: LayoutToken[] | null = null;
  if (layoutOrderRaw) {
    try {
      layoutOrder = parseLayoutOrder(layoutOrderRaw);
    } catch {
      return redirectWithError(`/programs/${slug}/edit`, "Layout order contains invalid section tokens.");
    }
  }
  const parsedPerformanceSchedule = parsePerformanceSchedule(parsed.performanceSchedule);
  const parsedAutoShowDates = parsedPerformanceSchedule.map((item) => formatPerformanceLabel(item)).filter(Boolean).join(" | ");
  const parsedShowDatesOverride = parsed.showDatesOverride && parsed.showDatesOverride.trim();
  const parsedResolvedShowDates = parsedShowDatesOverride || parsed.showDates || parsedAutoShowDates;
  const existingPerformanceSchedule = Array.isArray(existingProgram.performance_schedule)
    ? (existingProgram.performance_schedule as PerformanceRecord[])
    : [];
  const performanceSchedule = linkedShow ? existingPerformanceSchedule : parsedPerformanceSchedule;
  const resolvedShowDates = linkedShow ? String(existingProgram.show_dates ?? "") : parsedResolvedShowDates;
  if (!resolvedShowDates && !linkedShow) {
    redirectWithError(`/programs/${slug}/edit`, "At least one performance date is required.");
  }

  let rosterPeople: RosterPerson[] = [];
  try {
    const roster = parseRosterLines(parsed.rosterLines);
    if (roster.length === 0 && existingPeople.length > 0) {
      rosterPeople = existingPeople.map((person) => ({
        name: person.full_name,
        role: person.role_title,
        teamType: person.team_type,
        email: person.email,
        bio: person.bio,
        headshotUrl: person.headshot_url
      }));
    } else {
      rosterPeople = mergeRoster(roster);
    }
  } catch {
    redirectWithError(`/programs/${slug}/edit`, "Roster format is invalid. Use Name | Role | cast|production | optional@email.com.");
  }

  const mergedPeople = mergeRosterWithExisting(rosterPeople, existingPeople);
  const posterImageUrl = (() => {
    if (linkedShow) {
      return String(existingProgram.poster_image_url ?? "");
    }
    try {
      return normalizeOptionalHttpUrl(parsed.posterImageUrl, "Poster image URL");
    } catch (error) {
      return redirectWithError(`/programs/${slug}/edit`, error instanceof Error ? error.message : "Invalid poster image URL.");
    }
  })();
  const actfAdImageUrl = (() => {
    try {
      return normalizeOptionalHttpUrl(parsed.actfAdImageUrl, "ACTF ad image URL");
    } catch (error) {
      return redirectWithError(`/programs/${slug}/edit`, error instanceof Error ? error.message : "Invalid ACTF ad image URL.");
    }
  })();
  const productionPhotoUrls = parseProductionPhotos(parsed.productionPhotoUrls);
  let customPages: CustomPageRecord[] = [];
  try {
    customPages = parseCustomPages(parsed.customPages);
  } catch (error) {
    return redirectWithError(`/programs/${slug}/edit`, error instanceof Error ? error.message : "Invalid custom pages format.");
  }
  const billingHtml = sanitizeRichText(parsed.billingPage);
  const resolvedBilling = richTextHasContent(billingHtml) ? billingHtml : generateAutoBilling(rosterPeople);
  const resolvedActsAndSongs = linkedShow ? String(existingProgram.acts_songs ?? "") : sanitizeRichText(parsed.actsAndSongs);
  const resolvedDepartmentInfo = linkedShow ? String(existingProgram.department_info ?? "") : sanitizeRichText(parsed.departmentInfo);
  const resolvedSeasonCalendar = linkedShow ? String(existingProgram.season_calendar ?? "") : sanitizeRichText(parsed.seasonCalendar);

  const programsColumns = await getTableColumns(client, "programs");
  const programUpdate = filterToColumns(
    {
      title: parsed.title,
      theatre_name: parsed.theatreName ?? "",
      show_dates: resolvedShowDates,
      performance_schedule: performanceSchedule,
      poster_image_url: posterImageUrl,
      director_notes: sanitizeRichText(parsed.directorNotes),
      dramaturgical_note: sanitizeRichText(parsed.dramaturgicalNote),
      music_director_note: sanitizeRichText(parsed.musicDirectorNote),
      billing_page: resolvedBilling,
      acts_songs: resolvedActsAndSongs,
      department_info: resolvedDepartmentInfo,
      actf_ad_image_url: actfAdImageUrl,
      acknowledgements: sanitizeRichText(parsed.acknowledgements),
      special_thanks: sanitizeRichText(parsed.specialThanks),
      season_calendar: resolvedSeasonCalendar,
      production_photo_urls: productionPhotoUrls,
      custom_pages: customPages,
      ...(layoutOrder ? { layout_order: layoutOrder } : {})
    },
    programsColumns
  );

  const { error: programUpdateError } = await client.from("programs").update(programUpdate).eq("id", existingProgram.id);
  if (programUpdateError) {
    redirectWithError(`/programs/${slug}/edit`, programUpdateError.message);
  }

  const { error: deletePeopleError } = await client.from("people").delete().eq("program_id", existingProgram.id);
  if (deletePeopleError) {
    redirectWithError(`/programs/${slug}/edit`, deletePeopleError.message);
  }

  const peopleColumns = await getTableColumns(client, "people");
  if (mergedPeople.length > 0) {
    const peopleRows = mergedPeople.map((person) =>
      filterToColumns(
        {
          program_id: existingProgram.id,
          full_name: person.full_name,
          role_title: person.role_title,
          team_type: person.team_type,
          email: person.email,
          bio: person.bio,
          headshot_url: person.headshot_url,
          submission_status: person.submission_status,
          submitted_at: person.submitted_at
        },
        peopleColumns
      )
    );
    const { error: peopleInsertError } = await client.from("people").insert(peopleRows);
    if (peopleInsertError) {
      redirectWithError(`/programs/${slug}/edit`, peopleInsertError.message);
    }
  }

  redirect(`/programs/${existingProgram.slug}`);
}

export async function getProgramWorkspaceById(showId: string) {
  const workspace = await getProgramWorkspaceList();
  return workspace.find((item) => item.id === showId) ?? null;
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
  const currentStatus = String(targetPerson.submission_status ?? "pending");
  if (currentStatus === "locked" || currentStatus === "approved") {
    redirectWithError(`/programs/${slug}/submit`, "This submission is locked by the production team.");
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
