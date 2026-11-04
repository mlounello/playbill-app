"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SongProgramPageView } from "@/components/song-program-page";
import { buildSongMeasurementHtml, normalizeSongRows, normalizeSongShortNames, paginateSongs, readSongMeasurements, resolveSongs, SONG_PAGE_CSS, type SongCastOption, type SongCredit, type SongMeasurements, type SongProgramPage, type SongRow } from "@/lib/songs";

function move<T>(rows: T[], index: number, offset: number) {
  const next = [...rows];
  const target = index + offset;
  if (target < 0 || target >= rows.length) return rows;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function SongPreview({ page }: { page: SongProgramPage }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / 528)));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={frame} className="song-preview-frame" style={{ height: 816 * scale }}>
    <div className="song-preview-paper" style={{ transform: `scale(${scale})` }}>
      <SongProgramPageView page={{ ...page, warnings: [] }} />
    </div>
  </div>;
}

export function SongsEditor({ settings, onUpdate, cast, title }: {
  settings: Record<string, unknown>;
  onUpdate: (settings: Record<string, unknown>) => void;
  cast: SongCastOption[];
  title: string;
}) {
  const songs = normalizeSongRows(settings.songs);
  const shortNames = normalizeSongShortNames(settings.song_character_names);
  const twoColumns = settings.songs_layout === "two_columns";
  const printTitle = settings.show_header === false ? "" : title;
  const resolved = resolveSongs(songs, cast, shortNames);
  const measurementHtml = buildSongMeasurementHtml(resolved, printTitle, twoColumns);
  const measurementRoot = useRef<HTMLDivElement>(null);
  const [measurements, setMeasurements] = useState<SongMeasurements>();
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled || !measurementRoot.current) return;
      setMeasurements(readSongMeasurements(measurementRoot.current) ?? undefined);
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => { cancelled = true; };
  }, [measurementHtml]);
  const pages = paginateSongs(resolved, { idBase: "song-editor", title: printTitle, twoColumns }, measurements);
  const previewIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const saveSongs = (next: SongRow[]) => onUpdate({ ...settings, songs: next });
  const updateSong = (id: string, patch: Partial<SongRow>) => saveSongs(songs.map((song) => song.id === id ? { ...song, ...patch } : song));
  const updateCredit = (song: SongRow, id: string, patch: Partial<SongCredit>) => updateSong(song.id, { credits: song.credits.map((credit) => credit.id === id ? { ...credit, ...patch } : credit) });
  const addCredit = (song: SongRow, kind: SongCredit["kind"], label = "") => updateSong(song.id, { credits: [...song.credits, {
    id: crypto.randomUUID(), kind, label, roleId: "", personId: "", displayName: "", useCharacterName: false
  }] });
  const people = [...new Map(cast.filter((role) => role.person_id).map((role) => [role.person_id, role.full_name])).entries()];
  const acts = [...new Set(songs.map((song) => song.act).filter(Boolean))];
  const dataListId = useId();

  return <div className="songs-builder module-settings-wide">
    <style>{SONG_PAGE_CSS}</style>
    <p className="section-note">Add songs, choose their act, and build credits in the order you want them printed. Custom characters and group labels only apply here; they do not change your cast list.</p>
    <label>Program layout
      <select aria-label="Program layout" value={twoColumns ? "two_columns" : "single_column"} onChange={(event) => onUpdate({ ...settings, songs_layout: event.target.value })}>
        <option value="single_column">Single column with dotted leaders</option>
        <option value="two_columns">Two columns: acts side by side</option>
      </select>
      <span className="meta-text">Acts follow their first appearance below. With two columns, the first two acts start side by side; additional acts use the next page.</span>
    </label>
    <details className="program-section-details">
      <summary>Short character names for song credits</summary>
      <p className="section-note">Set Roger Davis to Roger, for example. These names apply throughout this song section. A song-specific override takes priority. Main cast names stay unchanged.</p>
      {cast.length ? <div className="song-short-names">{cast.map((role) => <label key={role.id}>
        {role.role_title}{role.full_name ? ` - ${role.full_name}` : " (vacant)"}
        <input value={shortNames[role.id] ?? ""} placeholder={role.short_name || role.role_title} onChange={(event) => onUpdate({ ...settings, song_character_names: { ...shortNames, [role.id]: event.target.value } })} />
      </label>)}</div> : <p className="meta-text">No cast roles yet. You can still add custom characters and group labels below.</p>}
    </details>
    <div className="songs-builder-layout">
      <div className="song-module-editor">
        <datalist id={dataListId}>{acts.map((act) => <option key={act} value={act} />)}</datalist>
        {!songs.length ? <div className="empty-state-card">No songs yet. Add your first song, then choose an act and optional credits.</div> : null}
        {songs.map((song, songIndex) => <article key={song.id} className="song-module-row">
          <div className="song-module-row-header">
            <strong>Song {songIndex + 1}</strong>
            <div className="song-editor-actions">
              <button type="button" className="ghost-button" disabled={!songIndex} aria-label={`Move song ${songIndex + 1} up`} onClick={() => saveSongs(move(songs, songIndex, -1))}>Up</button>
              <button type="button" className="ghost-button" disabled={songIndex === songs.length - 1} aria-label={`Move song ${songIndex + 1} down`} onClick={() => saveSongs(move(songs, songIndex, 1))}>Down</button>
              <button type="button" className="ghost-button ghost-button-danger" onClick={() => {
                if (window.confirm(`Remove "${song.title || "Untitled song"}"?`)) saveSongs(songs.filter((row) => row.id !== song.id));
              }}>Remove song</button>
            </div>
          </div>
          <div className="module-settings-grid">
            <label>Act<input list={dataListId} value={song.act} placeholder="Act I" onChange={(event) => updateSong(song.id, { act: event.target.value })} /></label>
            <label>Song title<input value={song.title} placeholder="Opening number" onChange={(event) => updateSong(song.id, { title: event.target.value })} /></label>
          </div>
          <strong>Credits</strong>
          {!song.credits.length ? <p className="meta-text">No credits will print. You can leave this blank for an instrumental.</p> : null}
          {song.credits.map((credit, creditIndex) => <div key={credit.id} className="song-credit-row">
            <div className="song-module-row-header">
              <span className="meta-text">Credit {creditIndex + 1}: {credit.kind === "role" ? "Cast character" : credit.kind === "person" ? "Cast performer" : credit.kind === "group" ? "Group label" : "Custom character"}</span>
              <div className="song-editor-actions">
                <button type="button" className="ghost-button" disabled={!creditIndex} aria-label={`Move credit ${creditIndex + 1} up`} onClick={() => updateSong(song.id, { credits: move(song.credits, creditIndex, -1) })}>Up</button>
                <button type="button" className="ghost-button" disabled={creditIndex === song.credits.length - 1} aria-label={`Move credit ${creditIndex + 1} down`} onClick={() => updateSong(song.id, { credits: move(song.credits, creditIndex, 1) })}>Down</button>
                <button type="button" className="ghost-button" onClick={() => updateSong(song.id, { credits: song.credits.filter((row) => row.id !== credit.id) })}>Remove credit</button>
              </div>
            </div>
            {credit.kind === "role" ? <label>Cast character
              <select value={credit.roleId} onChange={(event) => updateCredit(song, credit.id, { roleId: event.target.value, personId: cast.find((role) => role.id === event.target.value)?.person_id ?? "" })}>
                <option value="">Choose a character</option>
                {credit.roleId && !cast.some((role) => role.id === credit.roleId) ? <option value={credit.roleId}>Unavailable character - choose a replacement</option> : null}
                {cast.map((role) => <option key={role.id} value={role.id}>{role.role_title} - {role.full_name || "Vacant"}</option>)}
              </select>
            </label> : credit.kind === "person" ? <label>Cast performer
              <select value={credit.personId} onChange={(event) => updateCredit(song, credit.id, { personId: event.target.value })}>
                <option value="">Choose a performer</option>
                {credit.personId && !people.some(([id]) => id === credit.personId) ? <option value={credit.personId}>Unavailable performer - choose a replacement</option> : null}
                {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label> : <>
              <label>{credit.kind === "group" ? "Group label" : "Character name"}<input value={credit.label} placeholder={credit.kind === "group" ? "Ensemble" : "Waiter"} onChange={(event) => updateCredit(song, credit.id, { label: event.target.value })} /></label>
              {credit.kind === "custom" ? <label>Link to a cast performer (optional)
                <select value={credit.personId} onChange={(event) => updateCredit(song, credit.id, { personId: event.target.value })}>
                  <option value="">No performer link</option>
                  {credit.personId && !people.some(([id]) => id === credit.personId) ? <option value={credit.personId}>Previously linked performer</option> : null}
                  {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <span className="meta-text">The character name prints; the link is kept without changing the performer's main role.</span>
              </label> : null}
            </>}
            {credit.kind === "role" || credit.kind === "person" ? <label>Display name for this song (optional)
              <input value={credit.displayName} placeholder={credit.kind === "person" && !credit.useCharacterName ? "Use the performer's name" : "Use the short character name above, or the full name"} onChange={(event) => updateCredit(song, credit.id, { displayName: event.target.value })} />
            </label> : null}
            {credit.kind === "person" ? <label className="checkbox-inline">
              <input type="checkbox" checked={credit.useCharacterName} onChange={(event) => updateCredit(song, credit.id, { useCharacterName: event.target.checked })} />
              <span>Print their character name instead of their performer name</span>
            </label> : null}
          </div>)}
          <div className="song-editor-actions">
            <button type="button" className="ghost-button" onClick={() => addCredit(song, "role")}>Add cast character</button>
            <button type="button" className="ghost-button" onClick={() => addCredit(song, "person")}>Add performer</button>
            <button type="button" className="ghost-button" onClick={() => addCredit(song, "custom")}>Add custom character</button>
            <button type="button" className="ghost-button" onClick={() => addCredit(song, "group", "Ensemble")}>Add group / ensemble</button>
          </div>
        </article>)}
        <button type="button" className="ghost-button" onClick={() => saveSongs([...songs, {
          id: crypto.randomUUID(), act: songs.at(-1)?.act || "Act I", title: "", credits: [], singerIds: [], singerRoleIds: [], includeCompany: false, includeEnsemble: false
        }])}>Add song</button>
      </div>
      <aside className="song-live-preview">
        <div className="card-toolbar"><strong>Program preview</strong><span className="meta-text">5.5 x 8.5 inches</span></div>
        <p className="meta-text">Changes appear here immediately. Save Sections and Order to apply them to your program.</p>
        <p className="meta-text">Song text automatically shrinks to fit, down to approximately 8pt. Longer content wraps or continues onto another page.</p>
        {pages.length ? <>
          <div className="song-editor-actions">
            <button type="button" className="ghost-button" disabled={previewIndex === 0} onClick={() => setPageIndex(previewIndex - 1)}>Previous page</button>
            <span>Page {previewIndex + 1} of {pages.length}</span>
            <button type="button" className="ghost-button" disabled={previewIndex === pages.length - 1} onClick={() => setPageIndex(previewIndex + 1)}>Next page</button>
          </div>
          {(pages[previewIndex].fontScale ?? 1) < 1 ? <span className="meta-text">Auto-fit: {Math.round((pages[previewIndex].fontScale ?? 1) * 100)}% text size</span> : null}
          {pages[previewIndex].warnings.map((warning) => <p key={warning} className="alert" role="status">{warning}</p>)}
          <SongPreview page={pages[previewIndex]} />
        </> : <div className="empty-state-card">Your song layout will appear here.</div>}
      </aside>
    </div>
    <div ref={measurementRoot} className="songs-measurement-root hide-print" aria-hidden="true" dangerouslySetInnerHTML={{ __html: measurementHtml }} />
  </div>;
}
