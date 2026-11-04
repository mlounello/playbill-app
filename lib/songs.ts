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
};
export type SongMeasurements = { availableHeight: number; heights: number[][] };

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
  return `<div class="song-entry"><div class="song-title">${escapeHtml(song.title)}</div>${song.credits.length ? `<div class="song-credits">${song.credits.map(escapeHtml).join(", ")}</div>` : ""}</div>`;
}

export function renderSongPageHtml(page: SongProgramPage) {
  return `${page.title ? `<h2 class="songs-page-title">${escapeHtml(page.title)}</h2>` : ""}<div class="songs-columns ${page.columns.length === 2 ? "songs-two-columns" : "songs-single-column"}">${page.columns.map((act) => `<section class="songs-act">${act ? `<h3 class="songs-act-title">${escapeHtml(act.title)}${act.continued ? " (cont.)" : ""}</h3><div class="songs-song-list">${act.songs.map(renderSongEntryHtml).join("")}</div>` : ""}</section>`).join("")}</div>`;
}

// Shared by editor, published pages, print, and browser-based pagination measurements.
export const SONG_PAGE_CSS = `
.songs-print-page { box-sizing:border-box; width:5.5in; height:8.5in; padding:.36in; background:#fff; color:#000; overflow:hidden; font-family:"Merriweather",Georgia,serif; }
.songs-print-page .songs-page-title { margin:0 0 .14in; font:700 14pt/1.2 "Oswald",sans-serif; text-align:center; color:#006b54; overflow-wrap:anywhere; }
.songs-columns { display:grid; grid-template-columns:minmax(0,1fr); gap:.22in; align-items:start; }
.songs-two-columns { grid-template-columns:repeat(2,minmax(0,1fr)); }
.songs-act { min-width:0; }
.songs-print-page .songs-act-title { margin:0 0 .14in; font:700 13pt/1.2 "Oswald",sans-serif; text-align:center; color:#006b54; overflow-wrap:anywhere; }
.songs-song-list { display:grid; gap:.12in; }
.song-entry { min-width:0; text-align:center; overflow-wrap:anywhere; word-break:normal; break-inside:avoid; }
.songs-print-page .song-title { font-size:10pt; font-weight:700; line-height:1.35; white-space:normal; }
.songs-print-page .song-credits { margin:.025in 0 0; font-size:9.5pt; font-weight:400; line-height:1.35; white-space:normal; }
`;

export function paginateSongs(songs: ResolvedSong[], options: { idBase: string; title: string; twoColumns: boolean }, measurements?: SongMeasurements): SongProgramPage[] {
  const acts = groupSongActs(songs);
  const twoColumns = options.twoColumns && acts.length > 1;
  const height = measurements?.availableHeight ?? 620;
  const charsPerLine = twoColumns ? 23 : 50;
  const gap = 11.52;
  const warnings = new Set<string>();
  const chunks = acts.map((act, actIndex) => {
    const pages: SongAct[] = [];
    let rows: ResolvedSong[] = [];
    let used = 0;
    for (const [songIndex, song] of act.songs.entries()) {
      const estimate = Math.ceil(song.title.length / charsPerLine) * 20 +
        (song.credits.length ? Math.ceil(song.credits.join(", ").length / charsPerLine) * 19 + 3 : 0) + 8;
      const measured = measurements?.heights[actIndex]?.[songIndex];
      const rowHeight = measured === undefined ? estimate : measured * 1.12;
      if (rows.length && used + gap + rowHeight > height) {
        pages.push({ ...act, songs: rows, continued: pages.length > 0 });
        rows = []; used = 0;
      }
      if (rowHeight > height) warnings.add(`"${song.title}" is too long for one page. Shorten its credits or use a single column.`);
      if (song.credits.some((credit) => credit.startsWith("[Unavailable"))) warnings.add(`Check the missing character or performer selection for "${song.title}".`);
      used += (rows.length ? gap : 0) + rowHeight;
      rows.push(song);
    }
    if (rows.length) pages.push({ ...act, songs: rows, continued: pages.length > 0 });
    return pages;
  });
  const result: SongProgramPage[] = [];
  const width = twoColumns ? 2 : 1;
  for (let i = 0; i < chunks.length; i += width) {
    const count = Math.max(chunks[i].length, chunks[i + 1]?.length && twoColumns ? chunks[i + 1].length : 0);
    for (let pageIndex = 0; pageIndex < count; pageIndex++) {
      const columns: Array<SongAct | null> = [chunks[i][pageIndex] ?? null];
      if (twoColumns && i + 1 < chunks.length) columns.push(chunks[i + 1][pageIndex] ?? null);
      result.push({ id: `${options.idBase}-${result.length + 1}`, type: "songs", title: options.title, columns, warnings: [...warnings] });
    }
  }
  return result;
}

export function buildSongMeasurementHtml(songs: ResolvedSong[], title: string, twoColumns: boolean) {
  const acts = groupSongActs(songs);
  return acts.map((act) => `<article class="songs-print-page">${renderSongPageHtml({
    id: "measure", type: "songs", title, warnings: [],
    columns: twoColumns && acts.length > 1 ? [{ ...act, continued: true }, null] : [{ ...act, continued: true }]
  })}</article>`).join("");
}

export function readSongMeasurements(root: ParentNode): SongMeasurements | null {
  const articles = [...root.querySelectorAll<HTMLElement>(".songs-print-page")];
  if (!articles.length) return null;
  const available: number[] = [];
  const heights: number[][] = [];
  for (const article of articles) {
    const list = article.querySelector<HTMLElement>(".songs-song-list");
    if (!list) continue;
    const bottom = article.getBoundingClientRect().bottom - parseFloat(getComputedStyle(article).paddingBottom);
    available.push(bottom - list.getBoundingClientRect().top - 16);
    heights.push([...list.querySelectorAll<HTMLElement>(".song-entry")].map((row) => row.getBoundingClientRect().height));
  }
  return available.length ? { availableHeight: Math.min(...available), heights } : null;
}
