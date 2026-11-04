export type SongCredit = {
  id: string;
  kind: "role" | "person" | "custom" | "group";
  roleId: string;
  personId: string;
  label: string;
  displayName: string;
  useCharacterName: boolean;
};

export type SongRow = {
  id: string;
  act: string;
  title: string;
  credits: SongCredit[];
  singerIds: string[];
  singerRoleIds: string[];
  includeCompany: boolean;
  includeEnsemble: boolean;
};

export type SongCastOption = {
  id: string;
  person_id: string;
  role_title: string;
  full_name: string;
  short_name?: string;
};
export type ResolvedSong = { id: string; title: string; act: string; credits: string[] };
export type SongAct = { title: string; songs: ResolvedSong[]; continued: boolean };
export type SongProgramPage = {
  id: string;
  type: "songs";
  title: string;
  columns: Array<SongAct | null>;
  warnings: string[];
  layout?: "single_column" | "two_columns";
  fontScale?: number;
};
export type SongMeasurements = {
  availableHeight: number;
  heights: number[][];
  bodyHeight?: number;
  headingHeights?: number[];
  fontScale?: number;
  rowGap?: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function normalizeSongRows(value: unknown): SongRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const row = record(entry);
    const songId = String(row.id ?? `song-${index}`);
    const legacyCredits = [
      ...ids(row.singerRoleIds ?? row.singer_role_ids).map((roleId) => ({ kind: "role", roleId })),
      ...ids(row.singerIds ?? row.singer_ids).map((personId) => ({ kind: "person", personId, useCharacterName: true })),
      ...(row.includeCompany ?? row.include_company ? [{ kind: "group", label: "Company" }] : []),
      ...(row.includeEnsemble ?? row.include_ensemble ? [{ kind: "group", label: "Ensemble" }] : [])
    ];
    const credits: SongCredit[] = (Array.isArray(row.credits) ? row.credits : legacyCredits).map((value, creditIndex) => {
      const credit = record(value);
      const kind = ["role", "person", "custom", "group"].includes(String(credit.kind)) ? credit.kind as SongCredit["kind"] : "custom";
      return {
        id: String(credit.id ?? `${songId}-credit-${creditIndex}`), kind,
        roleId: String(credit.roleId ?? ""), personId: String(credit.personId ?? ""),
        label: String(credit.label ?? ""), displayName: String(credit.displayName ?? ""),
        useCharacterName: Boolean(credit.useCharacterName)
      };
    });
    return {
      id: songId, act: String(row.act ?? ""), title: String(row.title ?? ""), credits,
      singerIds: credits.filter((c) => c.kind === "person").map((c) => c.personId).filter(Boolean),
      singerRoleIds: credits.filter((c) => c.kind === "role").map((c) => c.roleId).filter(Boolean),
      includeCompany: credits.some((c) => c.kind === "group" && c.label === "Company"),
      includeEnsemble: credits.some((c) => c.kind === "group" && c.label === "Ensemble")
    };
  });
}

export function normalizeSongShortNames(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(record(value)).filter(([, name]) => typeof name === "string").map(([id, name]) => [id, String(name)]));
}

export function resolveSongs(songs: SongRow[], cast: SongCastOption[], shortNames: Record<string, string> = {}): ResolvedSong[] {
  const roles = new Map(cast.map((role) => [role.id, role]));
  const roleName = (role: SongCastOption) => shortNames[role.id]?.trim() || role.short_name?.trim() || role.role_title.trim();
  return songs.filter((song) => song.title.trim() || song.credits.length).map((song) => ({
    id: song.id, act: song.act.trim() || "Songs", title: song.title.trim() || "Untitled song",
    credits: song.credits.map((credit) => {
      if (credit.displayName.trim()) return credit.displayName.trim();
      if (credit.kind === "custom" || credit.kind === "group") return credit.label.trim();
      if (credit.kind === "role") {
        const role = roles.get(credit.roleId);
        return role ? roleName(role) : "[Unavailable character]";
      }
      const matches = cast.filter((role) => role.person_id === credit.personId);
      if (!credit.useCharacterName) return matches[0]?.full_name.trim() || "[Unavailable performer]";
      const names = [...new Set(matches.map(roleName).filter(Boolean))];
      return names.join(" & ") || matches[0]?.full_name.trim() || "[Unavailable performer]";
    }).filter(Boolean)
  }));
}

export function groupSongActs(songs: ResolvedSong[]): SongAct[] {
  const acts = new Map<string, ResolvedSong[]>();
  for (const song of songs) {
    const rows = acts.get(song.act) ?? [];
    rows.push(song);
    acts.set(song.act, rows);
  }
  return [...acts].map(([title, rows]) => ({ title, songs: rows, continued: false }));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderSongEntryHtml(song: ResolvedSong) {
  return `<div class="song-entry"><div class="song-title">${escapeHtml(song.title)}</div>${song.credits.length ? `<span class="song-leader" aria-hidden="true"></span><div class="song-credits">${song.credits.map(escapeHtml).join(", ")}</div>` : ""}</div>`;
}

export function renderSongPageHtml(page: SongProgramPage) {
  const twoColumns = page.layout ? page.layout === "two_columns" : page.columns.length === 2;
  const scale = Number.isFinite(page.fontScale) ? Math.min(1, Math.max(.85, page.fontScale!)) : 1;
  return `<div class="songs-content" style="--song-font-scale:${scale}">${page.title ? `<h2 class="songs-page-title">${escapeHtml(page.title)}</h2>` : ""}<div class="songs-columns ${twoColumns ? "songs-two-columns" : "songs-single-column"}">${page.columns.map((act) => `<section class="songs-act">${act ? `<h3 class="songs-act-title">${escapeHtml(act.title)}${act.continued ? " (cont.)" : ""}</h3><div class="songs-song-list">${act.songs.map(renderSongEntryHtml).join("")}</div>` : ""}</section>`).join("")}</div></div>`;
}

// Shared by editor, published pages, print, and browser-based pagination measurements.
export const SONG_PAGE_CSS = `
.songs-print-page { box-sizing:border-box; width:5.5in; height:8.5in; padding:.36in; background:#fff; color:#000; overflow:hidden; font-family:"Merriweather",Georgia,serif; }
.songs-print-page .songs-page-title { margin:0 0 .14in; font:700 14pt/1.2 "Oswald",sans-serif; text-align:center; color:#006b54; overflow-wrap:anywhere; }
.songs-columns { display:grid; grid-template-columns:minmax(0,1fr); gap:.22in; align-items:start; }
.songs-two-columns { grid-template-columns:repeat(2,minmax(0,1fr)); }
.songs-act { min-width:0; }
.songs-print-page .songs-act-title { margin:0 0 .14in; font:700 13pt/1.2 "Oswald",sans-serif; text-align:center; color:#006b54; overflow-wrap:anywhere; }
.songs-song-list { display:grid; gap:calc(.12in * var(--song-font-scale,1)); }
.song-entry { min-width:0; text-align:center; overflow-wrap:anywhere; word-break:normal; break-inside:avoid; }
.songs-print-page .song-title { font-size:calc(10pt * var(--song-font-scale,1)); font-weight:700; line-height:1.35; white-space:normal; }
.songs-print-page .song-credits { margin:.025in 0 0; font-size:calc(9.5pt * var(--song-font-scale,1)); font-weight:400; line-height:1.35; white-space:normal; }
.song-leader { display:none; }
.songs-single-column .song-entry { display:flex; align-items:baseline; gap:.035in; text-align:left; }
.songs-single-column .song-title { flex:0 1 auto; min-width:0; }
.songs-single-column .song-credits { flex:0 1 auto; min-width:0; margin:0; text-align:right; }
.songs-single-column .song-leader { display:block; flex:1 0 .12in; border-bottom:1px dotted #006b54; transform:translateY(-.18em); }
`;

export function paginateSongs(songs: ResolvedSong[], options: { idBase: string; title: string; twoColumns: boolean }, measurements?: SongMeasurements): SongProgramPage[] {
  const acts = groupSongActs(songs);
  const twoColumns = options.twoColumns && acts.length > 1;
  const bodyHeight = measurements?.bodyHeight ?? (measurements?.availableHeight ? measurements.availableHeight + 34 : options.title ? 680 : 716);
  const headingHeight = (index: number) => measurements?.headingHeights?.[index] ?? 34;
  const estimateRow = (song: ResolvedSong, scale: number) => {
    const width = twoColumns ? 219 : 459;
    const titleWidth = Math.max(1, song.title.length * 7.3 * scale);
    const creditsWidth = song.credits.join(", ").length * 6.9 * scale;
    if (!twoColumns) return Math.ceil((titleWidth + creditsWidth + (creditsWidth ? 20 : 0)) / width) * 20 * scale + 3;
    return Math.ceil(titleWidth / width) * 20 * scale + (creditsWidth ? Math.ceil(creditsWidth / width) * 19 * scale + 3 : 0);
  };
  const fitsAt = (scale: number) => {
    const heights = acts.map((act, index) => headingHeight(index) + act.songs.reduce((sum, song) => sum + estimateRow(song, scale) * 1.08, 0) + Math.max(0, act.songs.length - 1) * 11.52 * scale);
    const vertical = twoColumns ? heights.every((height) => height <= bodyHeight) : heights.reduce((sum, height) => sum + height, 0) + Math.max(0, acts.length - 1) * 21.12 <= bodyHeight;
    const horizontal = twoColumns || songs.every((song) => (song.title.length * 7.3 + song.credits.join(", ").length * 6.9) * scale + 20 <= 459);
    return vertical && horizontal;
  };
  const fontScale = measurements?.fontScale ?? [1, .975, .95, .925, .9, .875, .85].find(fitsAt) ?? .85;
  const gap = measurements?.rowGap ?? 11.52 * fontScale;
  const rowHeight = (song: ResolvedSong, actIndex: number, songIndex: number) =>
    (measurements?.heights[actIndex]?.[songIndex] ?? estimateRow(song, fontScale)) * 1.08;
  const warnings = new Set<string>();
  const result: SongProgramPage[] = [];
  const addPage = (columns: Array<SongAct | null>) => result.push({
    id: `${options.idBase}-${result.length + 1}`, type: "songs", title: options.title, columns, warnings: [],
    layout: twoColumns ? "two_columns" : "single_column", fontScale
  });
  const warn = (song: ResolvedSong, height: number, available: number) => {
    if (height > available) warnings.add(`"${song.title}" is too long for one page at the smallest readable font. Shorten its credits${twoColumns ? " or use a single column" : ""}.`);
    if (song.credits.some((credit) => credit.startsWith("[Unavailable"))) warnings.add(`Check the missing character or performer selection for "${song.title}".`);
  };

  if (!twoColumns) {
    let sections: SongAct[] = [];
    let used = 0;
    for (const [actIndex, act] of acts.entries()) {
      let section: SongAct | undefined;
      let continued = false;
      for (const [songIndex, song] of act.songs.entries()) {
        const height = rowHeight(song, actIndex, songIndex);
        const overhead = section ? gap : headingHeight(actIndex) + (sections.length ? 21.12 : 0);
        if (sections.length && used + overhead + height > bodyHeight) {
          addPage(sections); sections = []; used = 0;
          continued = Boolean(section); section = undefined;
        }
        if (!section) {
          section = { ...act, songs: [], continued };
          used += headingHeight(actIndex) + (sections.length ? 21.12 : 0);
          sections.push(section);
        } else used += gap;
        warn(song, height, bodyHeight - headingHeight(actIndex));
        section.songs.push(song); used += height;
      }
    }
    if (sections.length) addPage(sections);
    return result.map((page) => ({ ...page, warnings: [...warnings] }));
  }

  const height = measurements?.availableHeight ?? bodyHeight - 34;
  const chunks = acts.map((act, actIndex) => {
    const pages: SongAct[] = [];
    let rows: ResolvedSong[] = [];
    let used = 0;
    for (const [songIndex, song] of act.songs.entries()) {
      const size = rowHeight(song, actIndex, songIndex);
      if (rows.length && used + gap + size > height) {
        pages.push({ ...act, songs: rows, continued: pages.length > 0 });
        rows = []; used = 0;
      }
      warn(song, size, height);
      used += (rows.length ? gap : 0) + size;
      rows.push(song);
    }
    if (rows.length) pages.push({ ...act, songs: rows, continued: pages.length > 0 });
    return pages;
  });
  for (let i = 0; i < chunks.length; i += 2) {
    const count = Math.max(chunks[i].length, chunks[i + 1]?.length ?? 0);
    for (let pageIndex = 0; pageIndex < count; pageIndex++) {
      const columns: Array<SongAct | null> = [chunks[i][pageIndex] ?? null];
      if (i + 1 < chunks.length) columns.push(chunks[i + 1][pageIndex] ?? null);
      addPage(columns);
    }
  }
  return result.map((page) => ({ ...page, warnings: [...warnings] }));
}

export function buildSongMeasurementHtml(songs: ResolvedSong[], title: string, twoColumns: boolean) {
  const acts = groupSongActs(songs);
  return acts.map((act) => `<article class="songs-print-page">${renderSongPageHtml({
    id: "measure", type: "songs", title, warnings: [],
    layout: twoColumns && acts.length > 1 ? "two_columns" : "single_column",
    columns: twoColumns && acts.length > 1 ? [{ ...act, continued: true }, null] : [{ ...act, continued: true }]
  })}</article>`).join("");
}

export function readSongMeasurements(root: ParentNode): SongMeasurements | null {
  const articles = [...root.querySelectorAll<HTMLElement>(".songs-print-page")];
  if (!articles.length) return null;
  const twoColumns = Boolean(root.querySelector(".songs-two-columns"));
  const context = document.createElement("canvas").getContext("2d");
  let result: SongMeasurements | null = null;
  // This function also runs by serialization in the PDF measurement browser; keep it self-contained.
  for (const scale of [1, .975, .95, .925, .9, .875, .85]) {
    for (const article of articles) article.querySelector<HTMLElement>(".songs-content")?.style.setProperty("--song-font-scale", String(scale));
    const available: number[] = [], bodies: number[] = [], headings: number[] = [], totals: number[] = [];
    const heights: number[][] = [];
    let horizontalFits = true;
    let rowGap = 11.52 * scale;
    for (const article of articles) {
      const list = article.querySelector<HTMLElement>(".songs-song-list");
      const columns = article.querySelector<HTMLElement>(".songs-columns");
      const act = article.querySelector<HTMLElement>(".songs-act");
      if (!list || !columns || !act) continue;
      const bottom = article.getBoundingClientRect().bottom - parseFloat(getComputedStyle(article).paddingBottom) - 16;
      const body = bottom - columns.getBoundingClientRect().top;
      const heading = list.getBoundingClientRect().top - act.getBoundingClientRect().top;
      rowGap = parseFloat(getComputedStyle(list).rowGap) || rowGap;
      const entries = [...list.querySelectorAll<HTMLElement>(".song-entry")];
      const sizes = entries.map((row) => row.getBoundingClientRect().height);
      if (!twoColumns && context) for (const entry of entries) {
        const title = entry.querySelector<HTMLElement>(".song-title");
        const credits = entry.querySelector<HTMLElement>(".song-credits");
        const naturalWidth = [title, credits].reduce((sum, element) => {
          if (!element) return sum;
          const style = getComputedStyle(element);
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          return sum + context.measureText(element.textContent ?? "").width;
        }, 0);
        const leaderWidth = credits ? 20 : 0;
        if (naturalWidth + leaderWidth > entry.getBoundingClientRect().width) horizontalFits = false;
      }
      bodies.push(body); available.push(body - heading); headings.push(heading); heights.push(sizes);
      totals.push(heading + sizes.reduce((sum, size) => sum + size * 1.08, 0) + Math.max(0, sizes.length - 1) * rowGap);
    }
    if (!heights.length) return null;
    const bodyHeight = Math.min(...bodies);
    const verticalFits = twoColumns ? totals.every((total) => total <= bodyHeight) : totals.reduce((sum, total) => sum + total, 0) + Math.max(0, totals.length - 1) * 21.12 <= bodyHeight;
    result = { availableHeight: Math.min(...available), bodyHeight, headingHeights: headings, heights, fontScale: scale, rowGap };
    if (horizontalFits && verticalFits) break;
  }
  return result;
}
