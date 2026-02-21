"use client";

import { useMemo, useState } from "react";
import type { ShowModule } from "@/lib/shows";

type ModuleItem = {
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
  acts_scenes: "Acts/Scenes",
  songs: "Songs",
  headshots_grid: "Headshots Grid",
  sponsors: "Sponsors",
  special_thanks: "Special Thanks",
  back_cover: "Back Cover"
};

function normalizeModules(modules: ShowModule[]): ModuleItem[] {
  return modules.map((mod) => ({
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

  return (
    <details>
      <summary>Advanced settings (JSON)</summary>
      <textarea
        className="rich-textarea"
        value={JSON.stringify(item.settings || {}, null, 2)}
        onChange={(event) => {
          try {
            onUpdate(JSON.parse(event.target.value));
          } catch {
            // keep typing permissive
          }
        }}
      />
    </details>
  );
}

export function ProgramPlanEditor({
  modules,
  onSubmitAction
}: {
  modules: ShowModule[];
  onSubmitAction: (formData: FormData) => void;
}) {
  const [items, setItems] = useState<ModuleItem[]>(() => normalizeModules(modules));
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const update = <K extends keyof ModuleItem>(index: number, key: K, value: ModuleItem[K]) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const payload = useMemo(() => JSON.stringify(items), [items]);

  return (
    <form action={onSubmitAction} className="grid" style={{ gap: "0.75rem" }}>
      <input type="hidden" name="modulesPayload" value={payload} readOnly />
      {items.map((item, index) => (
        <article
          key={`${item.module_type}-${index}`}
          className="card grid draggable-module"
          style={{ gap: "0.55rem" }}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex === null || dragIndex === index) {
              return;
            }
            setItems((current) => moveItem(current, dragIndex, index));
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
            <strong>
              <span className="drag-handle" aria-hidden>
                ::
              </span>{" "}
              {moduleTypeLabels[item.module_type] || item.module_type}
            </strong>
            <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Drag to reorder</span>
          </div>

          <label>
            Module title
            <input value={item.display_title} onChange={(event) => update(index, "display_title", event.target.value)} />
          </label>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
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
                checked={item.filler_eligible}
                onChange={(event) => update(index, "filler_eligible", event.target.checked)}
              />
              Filler eligible
            </label>
          </div>

          <ModuleSettings item={item} onUpdate={(next) => update(index, "settings", next)} />
        </article>
      ))}

      <button type="submit">Save Program Plan</button>
    </form>
  );
}
