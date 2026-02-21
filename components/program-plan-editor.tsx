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

export function ProgramPlanEditor({
  modules,
  onSubmitAction
}: {
  modules: ShowModule[];
  onSubmitAction: (formData: FormData) => void;
}) {
  const [items, setItems] = useState<ModuleItem[]>(() => normalizeModules(modules));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) {
      return;
    }

    setItems((current) => {
      const next = [...current];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const update = <K extends keyof ModuleItem>(index: number, key: K, value: ModuleItem[K]) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const payload = useMemo(() => JSON.stringify(items), [items]);

  return (
    <form action={onSubmitAction} className="grid" style={{ gap: "0.75rem" }}>
      <input type="hidden" name="modulesPayload" value={payload} readOnly />
      {items.map((item, index) => (
        <article key={`${item.module_type}-${index}`} className="card grid" style={{ gap: "0.55rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
            <strong>{moduleTypeLabels[item.module_type] || item.module_type}</strong>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button type="button" onClick={() => move(index, -1)}>
                Up
              </button>
              <button type="button" onClick={() => move(index, 1)}>
                Down
              </button>
            </div>
          </div>

          <label>
            Module title
            <input
              value={item.display_title}
              onChange={(event) => update(index, "display_title", event.target.value)}
            />
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

          <label>
            Module settings (JSON)
            <textarea
              className="rich-textarea"
              value={JSON.stringify(item.settings || {}, null, 2)}
              onChange={(event) => {
                try {
                  update(index, "settings", JSON.parse(event.target.value));
                } catch {
                  // ignore invalid JSON while typing
                }
              }}
            />
          </label>
        </article>
      ))}

      <button type="submit">Save Program Plan</button>
    </form>
  );
}
