"use client";

import { useMemo, useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { ShowModule } from "@/lib/shows";

type ModuleItem = {
  id: string;
  module_type: string;
  display_title: string;
  visible: boolean;
  filler_eligible: boolean;
  settings: Record<string, unknown>;
};

const moduleTypeLabels: Record<string, string> = {
  cover: "Cover",
  production_info: "Production Info",
  cast_list: "Cast List",
  creative_team: "Creative Team",
  production_team: "Production Team",
  bios: "Bios",
  director_note: "Director Note",
  dramaturgical_note: "Dramaturgical Note",
  music_director_note: "Music Director Note",
  acts_scenes: "Acts/Scenes",
  songs: "Songs",
  department_info: "Producing Department / Company",
  headshots_grid: "Headshots Grid",
  production_photos: "Production Photos",
  sponsors: "Sponsors",
  acknowledgements: "Acknowledgements",
  special_thanks: "Special Thanks",
  back_cover: "Back Cover",
  custom_text: "Custom Text Section",
  custom_image: "Custom Image Section",
  custom_pages: "Custom Pages Collection"
};

const moduleTokenMap: Record<string, string[]> = {
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
  sponsors: ["acknowledgements"],
  acknowledgements: ["acknowledgements"],
  special_thanks: ["special_thanks"],
  back_cover: ["season_calendar"],
  custom_text: [],
  custom_image: [],
  custom_pages: ["custom_pages"]
};

const addableModuleTypes = [
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
  "production_photos",
  "sponsors",
  "acknowledgements",
  "special_thanks",
  "back_cover",
  "custom_text",
  "custom_image",
  "custom_pages"
];

function normalizeModules(modules: ShowModule[]): ModuleItem[] {
  return modules.map((mod) => ({
    id: mod.id,
    module_type: mod.module_type,
    display_title: mod.display_title || moduleTypeLabels[mod.module_type] || mod.module_type,
    visible: mod.visible,
    filler_eligible: mod.filler_eligible,
    settings: mod.settings || {}
  }));
}

function moveItem<T>(array: T[], from: number, to: number) {
  const next = [...array];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ModuleSettings({
  item,
  onUpdate
}: {
  item: ModuleItem;
  onUpdate: (next: Record<string, unknown>) => void;
}) {
  const setSetting = (key: string, value: unknown) => {
    onUpdate({ ...item.settings, [key]: value });
  };

  if (item.module_type === "bios") {
    return (
      <div className="module-settings-grid">
        <label>
          Sort mode
          <select
            value={String(item.settings.sort_mode ?? "alpha")}
            onChange={(e) => setSetting("sort_mode", e.target.value)}
          >
            <option value="alpha">Alphabetical</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={Boolean(item.settings.include_headshots ?? true)}
            onChange={(e) => setSetting("include_headshots", e.target.checked)}
          />
          Include headshots
        </label>
      </div>
    );
  }

  if (item.module_type === "cast_list") {
    return (
      <div className="module-settings-grid">
        <label>
          Grouping
          <select
            value={String(item.settings.group_by ?? "none")}
            onChange={(e) => setSetting("group_by", e.target.value)}
          >
            <option value="none">No grouping</option>
            <option value="act">Group by act</option>
          </select>
        </label>
      </div>
    );
  }

  if (item.module_type === "headshots_grid") {
    return (
      <div className="module-settings-grid">
        <label>
          Max per page
          <input
            type="number"
            min={2}
            max={24}
            value={Number(item.settings.max_per_page ?? 8)}
            onChange={(e) => setSetting("max_per_page", Number(e.target.value))}
          />
        </label>

        <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={Boolean(item.settings.show_names ?? true)}
            onChange={(e) => setSetting("show_names", e.target.checked)}
          />
          Show names
        </label>
      </div>
    );
  }

  if (item.module_type === "back_cover") {
    return (
      <div className="module-settings-grid">
        <label>
          Back cover mode
          <select
            value={String(item.settings.mode ?? "schedule")}
            onChange={(e) => setSetting("mode", e.target.value)}
          >
            <option value="schedule">Season schedule</option>
            <option value="image">Image</option>
            <option value="auto">Auto</option>
          </select>
        </label>
      </div>
    );
  }

  if (item.module_type === "custom_text") {
    return (
      <div className="module-settings-grid">
        <label>
          Section body
          <RichTextEditor
            label={`${item.display_title || "Custom Text"} body`}
            value={String(item.settings.body ?? "")}
            onChange={(next) => setSetting("body", next)}
            placeholder="Add rich text content for this custom section."
            minHeightPx={220}
          />
        </label>
      </div>
    );
  }

  if (item.module_type === "custom_image") {
    return (
      <div className="module-settings-grid">
        <label>
          Image URL
          <input
            value={String(item.settings.image_url ?? "")}
            onChange={(event) => setSetting("image_url", event.target.value)}
            placeholder="https://..."
          />
        </label>
      </div>
    );
  }

  return null;
}

export function ProgramPlanEditor({
  modules,
  onSubmitAction,
  previewModuleId,
  getModulePreviewHref
}: {
  modules: ShowModule[];
  onSubmitAction: (formData: FormData) => void;
  previewModuleId?: string;
  getModulePreviewHref?: (moduleId: string) => string;
}) {
  const [items, setItems] = useState<ModuleItem[]>(() => normalizeModules(modules));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newModuleType, setNewModuleType] = useState("custom_text");

  const update = <K extends keyof ModuleItem>(index: number, key: K, value: ModuleItem[K]) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const updateSettings = (index: number, nextSettings: Record<string, unknown>) => {
    update(index, "settings", nextSettings);
  };

  const setPageBehavior = (index: number, mode: "share" | "standalone") => {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const separate = mode === "standalone";
        return {
          ...item,
          settings: {
            ...item.settings,
            separate_page: separate,
            // Keep legacy flag aligned to avoid contradictory older records.
            keep_together: separate
          }
        };
      })
    );
  };

  const payload = useMemo(() => JSON.stringify(items), [items]);

  const addModule = () => {
    setItems((current) => [
      ...current,
      {
        id: `new-${newModuleType}-${Date.now()}`,
        module_type: newModuleType,
        display_title: moduleTypeLabels[newModuleType] || newModuleType,
        visible: true,
        filler_eligible: false,
        settings: {}
      }
    ]);
  };

  const isCustomModule = (moduleType: string) =>
    moduleType === "custom_text" || moduleType === "custom_image" || moduleType === "custom_pages";

  return (
    <form action={onSubmitAction} className="card-list" data-pending-label="Saving program plan..." data-preserve-scroll="true">
      <article className="card stack-sm">
        <strong>Program Plan Builder</strong>
        <p className="section-note">
          Reorder by drag-and-drop, or use Move Up/Move Down. Turn sections on or off with the Visible toggle.
        </p>
        <p className="section-note">
          Page behavior controls whether a module can share a page with other modules or must stay on its own page.
        </p>
        <p className="section-note">
          “Allow multiple pages” controls whether long sections can continue to another page.
        </p>
        <div className="top-actions">
          <label>
            Add section type
            <select value={newModuleType} onChange={(event) => setNewModuleType(event.target.value)}>
              {addableModuleTypes.map((type) => (
                <option key={type} value={type}>
                  {moduleTypeLabels[type] || type}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addModule}>
            Add Section
          </button>
        </div>
      </article>

      <input type="hidden" name="modulesPayload" value={payload} readOnly />
      {items.map((item, index) => (
        <article
          key={item.id}
          className="card grid draggable-module"
          style={{ gap: "0.55rem", opacity: draggingId === item.id ? 0.6 : 1 }}
          draggable
          onDragStart={(event) => {
            setDragIndex(index);
            setDraggingId(item.id);
            event.dataTransfer.effectAllowed = "move";
            const ghost = event.currentTarget.cloneNode(true) as HTMLElement;
            ghost.style.position = "absolute";
            ghost.style.top = "-9999px";
            ghost.style.left = "-9999px";
            ghost.style.width = `${event.currentTarget.clientWidth}px`;
            document.body.appendChild(ghost);
            event.dataTransfer.setDragImage(ghost, 20, 20);
            requestAnimationFrame(() => document.body.removeChild(ghost));
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex === null || dragIndex === index) {
              return;
            }
            setItems((current) => moveItem(current, dragIndex, index));
            setDragIndex(null);
            setDraggingId(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDraggingId(null);
          }}
        >
          <div className="row-between">
            <strong>
              <span className="drag-handle" aria-hidden>
                ::
              </span>{" "}
              {moduleTypeLabels[item.module_type] || item.module_type}
            </strong>
            <div className="top-actions">
              <button type="button" className="ghost-button" onClick={() => setItems((current) => moveItem(current, index, Math.max(0, index - 1)))} disabled={index === 0}>
                Move Up
              </button>
              <button type="button" className="ghost-button" onClick={() => setItems((current) => moveItem(current, index, Math.min(current.length - 1, index + 1)))} disabled={index === items.length - 1}>
                Move Down
              </button>
              {isCustomModule(item.module_type) ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  Remove Section
                </button>
              ) : null}
              {getModulePreviewHref ? (
                <a
                  className="ghost-button"
                  href={getModulePreviewHref(item.id)}
                  style={previewModuleId === item.id ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
                >
                  {previewModuleId === item.id ? "Previewing" : "Preview this module"}
                </a>
              ) : null}
              <span className="meta-text">Drag to reorder</span>
            </div>
          </div>

          <label>
            Module title
            <input value={item.display_title} onChange={(event) => update(index, "display_title", event.target.value)} />
          </label>

          <div className="row-wrap">
            <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={item.visible}
                onChange={(event) => update(index, "visible", event.target.checked)}
              />
              Visible
            </label>

            <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={Boolean(item.settings.show_header ?? true)}
                onChange={(event) => updateSettings(index, { ...item.settings, show_header: event.target.checked })}
              />
              Show section header
            </label>

            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
              <legend className="meta-text" style={{ marginRight: "0.25rem" }}>Page behavior</legend>
              <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <input
                  type="radio"
                  name={`page-behavior-${item.id}`}
                  checked={!Boolean(item.settings.separate_page ?? true)}
                  onChange={() => setPageBehavior(index, "share")}
                />
                Can share page with other modules
              </label>
              <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <input
                  type="radio"
                  name={`page-behavior-${item.id}`}
                  checked={Boolean(item.settings.separate_page ?? true)}
                  onChange={() => setPageBehavior(index, "standalone")}
                />
                Must remain by itself
              </label>
            </fieldset>

            <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={item.filler_eligible}
                onChange={(event) => update(index, "filler_eligible", event.target.checked)}
              />
              Filler eligible (auto-use when hidden)
            </label>

            <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={Boolean(item.settings.allow_multiple_pages ?? (item.module_type === "bios" || item.module_type === "custom_pages"))}
                onChange={(event) =>
                  updateSettings(index, { ...item.settings, allow_multiple_pages: event.target.checked })
                }
              />
              Allow multiple pages
            </label>
          </div>

          <div className="meta-text">
            Preview mapping:{" "}
            {(moduleTokenMap[item.module_type] ?? []).length > 0
              ? (moduleTokenMap[item.module_type] ?? []).join(", ")
              : "No direct token mapping yet (module stored for future renderer)."}
          </div>

          <ModuleSettings item={item} onUpdate={(next) => update(index, "settings", next)} />
        </article>
      ))}

      <button type="submit">Save Program Plan</button>
    </form>
  );
}
