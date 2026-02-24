import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { sanitizeRichText } from "@/lib/rich-text";
import { getMissingSupabaseEnvVars, getSupabaseWriteClient } from "@/lib/supabase";

export type SeasonRecord = {
  id: string;
  name: string;
};

export type SeasonEventRecord = {
  id: string;
  season_id: string;
  title: string;
  location: string;
  event_start_date: string;
  event_end_date: string | null;
  time_text: string;
  sort_order: number;
};

type SeasonModuleData = {
  seasons: SeasonRecord[];
  selectedSeasonId: string;
  selectedSeasonName: string;
  events: SeasonEventRecord[];
};

type SeasonLibraryData = {
  seasons: SeasonRecord[];
  selectedSeasonId: string;
  selectedSeasonName: string;
  selectedSeasonEvents: SeasonEventRecord[];
  linkedShowCount: number;
};

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}?${qp.toString()}`);
}

function monthToken(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).toUpperCase();
}

function dayToken(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return String(date.getDate());
}

function formatDateBadge(startDate: string, endDate: string | null) {
  const startMonth = monthToken(startDate);
  const startDay = dayToken(startDate);
  if (!startMonth || !startDay) {
    return "";
  }

  if (!endDate) {
    return `${startMonth} ${startDay}`;
  }

  const endMonth = monthToken(endDate);
  const endDay = dayToken(endDate);
  if (!endMonth || !endDay) {
    return `${startMonth} ${startDay}`;
  }

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

function cutoffDateForShow(startDate: string | null, endDate: string | null) {
  const source = (endDate && endDate.trim()) || (startDate && startDate.trim()) || null;
  if (!source) {
    return null;
  }
  const parsed = new Date(`${source}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function buildSeasonCalendarHtml(events: SeasonEventRecord[]) {
  if (events.length === 0) {
    return "";
  }

  const body = events
    .map((event) => {
      const badge = formatDateBadge(event.event_start_date, event.event_end_date);
      const detailLine = [event.location.trim(), event.time_text.trim()].filter(Boolean).join(" at ");
      return `<section><h3>${badge}</h3><p><strong>${event.title}</strong><br/>${detailLine || "Location & Time TBD"}</p></section>`;
    })
    .join("");

  return sanitizeRichText(`<h3>Upcoming Creative Arts Events</h3>${body}`);
}

async function refreshSeasonCalendarForShow(showId: string) {
  const client = getSupabaseWriteClient();
  const { data: show, error: showError } = await client
    .from("shows")
    .select("id, program_id, season_id, start_date, end_date")
    .eq("id", showId)
    .single();
  if (showError || !show) {
    throw new Error("Show not found.");
  }
  if (!show.program_id) {
    return;
  }

  if (!show.season_id) {
    const { error: clearError } = await client
      .from("programs")
      .update({ season_calendar: "" })
      .eq("id", String(show.program_id));
    if (clearError) {
      throw new Error(clearError.message);
    }
    return;
  }

  const { data: events, error: eventsError } = await client
    .from("season_events")
    .select("id, season_id, title, location, event_start_date, event_end_date, time_text, sort_order")
    .eq("season_id", String(show.season_id))
    .order("event_start_date", { ascending: true })
    .order("sort_order", { ascending: true });
  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const cutoff = cutoffDateForShow(
    show.start_date ? String(show.start_date) : null,
    show.end_date ? String(show.end_date) : null
  );
  const upcoming = (events ?? []).filter((event) => {
    if (!cutoff) return true;
    const start = new Date(`${String(event.event_start_date ?? "")}T00:00:00`);
    return !Number.isNaN(start.getTime()) && start.getTime() > cutoff.getTime();
  }) as SeasonEventRecord[];

  const calendarHtml = buildSeasonCalendarHtml(upcoming);
  const { error: updateError } = await client
    .from("programs")
    .update({ season_calendar: calendarHtml })
    .eq("id", String(show.program_id));
  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function refreshSeasonCalendarsForSeason(seasonId: string) {
  const client = getSupabaseWriteClient();
  const { data: shows, error } = await client
    .from("shows")
    .select("id")
    .eq("season_id", seasonId);
  if (error) {
    throw new Error(error.message);
  }
  for (const show of shows ?? []) {
    const showId = String(show.id ?? "");
    if (showId) {
      await refreshSeasonCalendarForShow(showId);
    }
  }
}

export async function getSeasonLibraryData(selectedSeasonId = ""): Promise<SeasonLibraryData> {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return {
      seasons: [],
      selectedSeasonId: "",
      selectedSeasonName: "",
      selectedSeasonEvents: [],
      linkedShowCount: 0
    };
  }

  try {
    const client = getSupabaseWriteClient();
    const { data: seasons } = await client.from("seasons").select("id, name").order("name", { ascending: true });
    const allSeasons = (seasons ?? []).map((season) => ({
      id: String(season.id),
      name: String(season.name ?? "")
    }));
    const resolvedSeasonId = selectedSeasonId || allSeasons[0]?.id || "";
    const selectedSeasonName = allSeasons.find((season) => season.id === resolvedSeasonId)?.name ?? "";

    const { data: events } = resolvedSeasonId
      ? await client
          .from("season_events")
          .select("id, season_id, title, location, event_start_date, event_end_date, time_text, sort_order")
          .eq("season_id", resolvedSeasonId)
          .order("event_start_date", { ascending: true })
          .order("sort_order", { ascending: true })
      : { data: [] as Array<Record<string, unknown>> };

    const { count } = resolvedSeasonId
      ? await client
          .from("shows")
          .select("id", { count: "exact", head: true })
          .eq("season_id", resolvedSeasonId)
      : { count: 0 };

    return {
      seasons: allSeasons,
      selectedSeasonId: resolvedSeasonId,
      selectedSeasonName,
      selectedSeasonEvents: (events ?? []).map((event) => ({
        id: String(event.id),
        season_id: String(event.season_id),
        title: String(event.title ?? ""),
        location: String(event.location ?? ""),
        event_start_date: String(event.event_start_date ?? ""),
        event_end_date: event.event_end_date ? String(event.event_end_date) : null,
        time_text: String(event.time_text ?? ""),
        sort_order: Number(event.sort_order ?? 0)
      })),
      linkedShowCount: Number(count ?? 0)
    };
  } catch {
    return {
      seasons: [],
      selectedSeasonId: "",
      selectedSeasonName: "",
      selectedSeasonEvents: [],
      linkedShowCount: 0
    };
  }
}

export async function getSeasonModuleData(showId: string): Promise<SeasonModuleData> {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    return { seasons: [], selectedSeasonId: "", selectedSeasonName: "", events: [] };
  }

  try {
    const client = getSupabaseWriteClient();
    const { data: seasons } = await client.from("seasons").select("id, name").order("name", { ascending: true });
    const { data: show } = await client.from("shows").select("season_id").eq("id", showId).maybeSingle();
    const selectedSeasonId = show?.season_id ? String(show.season_id) : "";
    const selectedSeasonName =
      (seasons ?? []).find((season) => String(season.id) === selectedSeasonId)?.name?.toString() ?? "";
    const { data: events } = selectedSeasonId
      ? await client
          .from("season_events")
          .select("id, season_id, title, location, event_start_date, event_end_date, time_text, sort_order")
          .eq("season_id", selectedSeasonId)
          .order("event_start_date", { ascending: true })
          .order("sort_order", { ascending: true })
      : { data: [] as Array<Record<string, unknown>> };

    return {
      seasons: (seasons ?? []).map((season) => ({
        id: String(season.id),
        name: String(season.name ?? "")
      })),
      selectedSeasonId,
      selectedSeasonName,
      events: (events ?? []).map((event) => ({
        id: String(event.id),
        season_id: String(event.season_id),
        title: String(event.title ?? ""),
        location: String(event.location ?? ""),
        event_start_date: String(event.event_start_date ?? ""),
        event_end_date: event.event_end_date ? String(event.event_end_date) : null,
        time_text: String(event.time_text ?? ""),
        sort_order: Number(event.sort_order ?? 0)
      }))
    };
  } catch {
    return { seasons: [], selectedSeasonId: "", selectedSeasonName: "", events: [] };
  }
}

export async function createSeasonLibraryEntry(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/seasons", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    withError("/app/seasons", "Season name is required.");
  }

  const client = getSupabaseWriteClient();
  const { data, error } = await client.from("seasons").insert({ name }).select("id").single();
  if (error || !data?.id) {
    withError("/app/seasons", error?.message ?? "Could not create season.");
  }

  const qp = new URLSearchParams({
    seasonId: String(data.id),
    success: "Season created."
  });
  redirect(`/app/seasons?${qp.toString()}`);
}

export async function updateSeasonLibraryEntry(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/seasons", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!seasonId || !name) {
    withError("/app/seasons", "Season id and name are required.");
  }

  const client = getSupabaseWriteClient();
  const { error } = await client
    .from("seasons")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", seasonId);
  if (error) {
    const qp = new URLSearchParams({ seasonId, error: error.message });
    redirect(`/app/seasons?${qp.toString()}`);
  }

  const qp = new URLSearchParams({ seasonId, success: "Season updated." });
  redirect(`/app/seasons?${qp.toString()}`);
}

export async function deleteSeasonLibraryEntry(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/seasons", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  if (!seasonId) {
    withError("/app/seasons", "Season id is required.");
  }

  const client = getSupabaseWriteClient();
  const { error } = await client.from("seasons").delete().eq("id", seasonId);
  if (error) {
    const qp = new URLSearchParams({ seasonId, error: error.message });
    redirect(`/app/seasons?${qp.toString()}`);
  }

  redirect(`/app/seasons?${new URLSearchParams({ success: "Season deleted." }).toString()}`);
}

export async function upsertSeasonLibraryEvent(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/seasons", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const eventId = String(formData.get("eventId") ?? "").trim();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const eventStartDate = String(formData.get("eventStartDate") ?? "").trim();
  const eventEndDate = String(formData.get("eventEndDate") ?? "").trim();
  const timeText = String(formData.get("timeText") ?? "").trim();
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0"));

  if (!seasonId) {
    withError("/app/seasons", "Select a season before adding events.");
  }
  if (!title || !eventStartDate) {
    const qp = new URLSearchParams({ seasonId, error: "Event title and start date are required." });
    redirect(`/app/seasons?${qp.toString()}`);
  }

  const client = getSupabaseWriteClient();
  const payload = {
    season_id: seasonId,
    title,
    location,
    event_start_date: eventStartDate,
    event_end_date: eventEndDate || null,
    time_text: timeText,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    updated_at: new Date().toISOString()
  };

  if (eventId) {
    const { error } = await client.from("season_events").update(payload).eq("id", eventId);
    if (error) {
      const qp = new URLSearchParams({ seasonId, error: error.message });
      redirect(`/app/seasons?${qp.toString()}`);
    }
  } else {
    const { error } = await client.from("season_events").insert(payload);
    if (error) {
      const qp = new URLSearchParams({ seasonId, error: error.message });
      redirect(`/app/seasons?${qp.toString()}`);
    }
  }

  try {
    await refreshSeasonCalendarsForSeason(seasonId);
  } catch (refreshError) {
    const qp = new URLSearchParams({
      seasonId,
      error: refreshError instanceof Error ? refreshError.message : "Could not refresh linked shows."
    });
    redirect(`/app/seasons?${qp.toString()}`);
  }

  const qp = new URLSearchParams({
    seasonId,
    success: eventId ? "Season event updated." : "Season event added."
  });
  redirect(`/app/seasons?${qp.toString()}`);
}

export async function deleteSeasonLibraryEvent(formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError("/app/seasons", `Supabase is not configured: ${missing.join(", ")}`);
  }

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId || !seasonId) {
    withError("/app/seasons", "Season id and event id are required.");
  }

  const client = getSupabaseWriteClient();
  const { error } = await client.from("season_events").delete().eq("id", eventId);
  if (error) {
    const qp = new URLSearchParams({ seasonId, error: error.message });
    redirect(`/app/seasons?${qp.toString()}`);
  }

  try {
    await refreshSeasonCalendarsForSeason(seasonId);
  } catch (refreshError) {
    const qp = new URLSearchParams({
      seasonId,
      error: refreshError instanceof Error ? refreshError.message : "Could not refresh linked shows."
    });
    redirect(`/app/seasons?${qp.toString()}`);
  }

  const qp = new URLSearchParams({ seasonId, success: "Season event deleted." });
  redirect(`/app/seasons?${qp.toString()}`);
}

export async function createSeason(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    withError(`/app/shows/${showId}?tab=settings`, "Season name is required.");
  }

  const client = getSupabaseWriteClient();
  const { data: season, error } = await client.from("seasons").insert({ name }).select("id").single();
  if (error || !season) {
    withError(`/app/shows/${showId}?tab=settings`, error?.message ?? "Could not create season.");
  }

  const { error: showUpdateError } = await client
    .from("shows")
    .update({ season_id: String(season.id), updated_at: new Date().toISOString() })
    .eq("id", showId);
  if (showUpdateError) {
    withError(`/app/shows/${showId}?tab=settings`, showUpdateError.message);
  }

  try {
    await refreshSeasonCalendarForShow(showId);
  } catch (refreshError) {
    withError(`/app/shows/${showId}?tab=settings`, refreshError instanceof Error ? refreshError.message : "Could not refresh season calendar.");
  }

  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Season created and assigned to show.")}`);
}

export async function assignSeasonToShow(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const client = getSupabaseWriteClient();
  const { error: showUpdateError } = await client
    .from("shows")
    .update({ season_id: seasonId || null, updated_at: new Date().toISOString() })
    .eq("id", showId);
  if (showUpdateError) {
    withError(`/app/shows/${showId}?tab=settings`, showUpdateError.message);
  }

  try {
    await refreshSeasonCalendarForShow(showId);
  } catch (refreshError) {
    withError(`/app/shows/${showId}?tab=settings`, refreshError instanceof Error ? refreshError.message : "Could not refresh season calendar.");
  }

  redirect(
    `/app/shows/${showId}?tab=settings&success=${encodeURIComponent(
      seasonId ? "Season assigned to show." : "Season unassigned from show."
    )}`
  );
}

export async function upsertSeasonEvent(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const eventId = String(formData.get("eventId") ?? "").trim();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const eventStartDate = String(formData.get("eventStartDate") ?? "").trim();
  const eventEndDate = String(formData.get("eventEndDate") ?? "").trim();
  const timeText = String(formData.get("timeText") ?? "").trim();
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0"));

  if (!seasonId) {
    withError(`/app/shows/${showId}?tab=settings`, "Assign a season before adding events.");
  }
  if (!title || !eventStartDate) {
    withError(`/app/shows/${showId}?tab=settings`, "Event title and start date are required.");
  }

  const client = getSupabaseWriteClient();
  const payload = {
    season_id: seasonId,
    title,
    location,
    event_start_date: eventStartDate,
    event_end_date: eventEndDate || null,
    time_text: timeText,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    updated_at: new Date().toISOString()
  };

  if (eventId) {
    const { error } = await client.from("season_events").update(payload).eq("id", eventId);
    if (error) {
      withError(`/app/shows/${showId}?tab=settings`, error.message);
    }
  } else {
    const { error } = await client.from("season_events").insert(payload);
    if (error) {
      withError(`/app/shows/${showId}?tab=settings`, error.message);
    }
  }

  try {
    await refreshSeasonCalendarForShow(showId);
  } catch (refreshError) {
    withError(`/app/shows/${showId}?tab=settings`, refreshError instanceof Error ? refreshError.message : "Could not refresh season calendar.");
  }

  redirect(
    `/app/shows/${showId}?tab=settings&success=${encodeURIComponent(
      eventId ? "Season event updated." : "Season event added."
    )}`
  );
}

export async function deleteSeasonEvent(showId: string, formData: FormData) {
  "use server";

  await requireRole(["owner", "admin", "editor"]);
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    withError(`/app/shows/${showId}?tab=settings`, `Supabase is not configured: ${missing.join(", ")}`);
  }

  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId) {
    withError(`/app/shows/${showId}?tab=settings`, "Event id is required.");
  }

  const client = getSupabaseWriteClient();
  const { error } = await client.from("season_events").delete().eq("id", eventId);
  if (error) {
    withError(`/app/shows/${showId}?tab=settings`, error.message);
  }

  try {
    await refreshSeasonCalendarForShow(showId);
  } catch (refreshError) {
    withError(`/app/shows/${showId}?tab=settings`, refreshError instanceof Error ? refreshError.message : "Could not refresh season calendar.");
  }

  redirect(`/app/shows/${showId}?tab=settings&success=${encodeURIComponent("Season event deleted.")}`);
}
