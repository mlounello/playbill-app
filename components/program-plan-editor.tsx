"use client";

import { useMemo, useState } from "react";
import { ModuleHtmlEditor } from "@/components/module-html-editor";
import { ProgramImageUpload } from "@/components/program-image-upload";
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

type PlanMode = "sections" | "order";

const moduleTypeLabels: Record<string, string> = {
  cover: "Cover",
  production_info: "Production Info",
  cast_list: "Cast List",
  creative_team: "Creative Team",
  production_team: "Production Team",
  bios: "Bio Collection",
  director_note: "Contributor Note",
  dramaturgical_note: "Contributor Note",
  music_director_note: "Contributor Note",
  acts_scenes: "Acts / Scenes",
  songs: "Songs",
  department_info: "Producing Organization",
  headshots_grid: "Headshot Grid",
  production_photos: "Photo Grid",
  sponsors: "Sponsors",
  actf_sponsorship: "ACTF Sponsorship",
  acknowledgements: "Acknowledgements",
  special_thanks: "Special Thanks",
  season_calendar: "Season Calendar",
  back_cover: "Back Cover",
  custom_text: "Formatted Text",
  custom_image: "Image / Ad Page",
  custom_pages: "Custom Page Collection"
};

const moduleTypeDescriptions: Record<string, string> = {
  cover: "Uses the show poster and core production details.",
  production_info: "Production details and show metadata.",
  cast_list: "Printed cast list from people and roles.",
  creative_team: "Creative team list from people and roles.",
  production_team: "Production team list from people and roles.",
  bios: "Collected bios from requested submissions.",
  director_note: "Legacy note slot. Phase 5 will turn this into flexible contributor notes.",
  dramaturgical_note: "Legacy note slot. Phase 5 will turn this into flexible contributor notes.",
  music_director_note: "Legacy note slot. Phase 5 will turn this into flexible contributor notes.",
  acts_scenes: "Uses the Acts & Songs content source.",
  songs: "Uses the Acts & Songs content source.",
  department_info: "Selected producing profiles and department information.",
  headshots_grid: "A grid of submitted headshots.",
  production_photos: "Production photo pages.",
  sponsors: "Uses the sponsorship content source.",
  actf_sponsorship: "A dedicated full-page formatted sponsor insert.",
  acknowledgements: "Uses the acknowledgements content source.",
  special_thanks: "Uses the special thanks content source.",
  season_calendar: "Season calendar selected in settings.",
  back_cover: "Back cover content, usually season schedule or image.",
  custom_text: "Flexible WYSIWYG page for special thanks, sponsors, notes, dedications, and one-off content.",
  custom_image: "Flexible image page for ads, sponsor art, back-cover art, and inserts.",
  custom_pages: "Existing custom page collection from the legacy editor."
};

const addableModuleTypes = [
  "custom_text",
  "custom_image",
  "bios",
  "cast_list",
  "creative_team",
  "production_team",
  "director_note",
  "dramaturgical_note",
  "music_director_note",
  "acts_scenes",
  "songs",
  "department_info",
  "headshots_grid",
  "production_photos",
  "sponsors",
  "actf_sponsorship",
  "acknowledgements",
  "special_thanks",
  "season_calendar",
  "cover",
  "production_info",
  "back_cover",
  "custom_pages"
];

function isDefaultIsolated(moduleType: string) {
  const isolated = new Set([
    "cover",
    "bios",
    "headshots_grid",
    "production_photos",
    "actf_sponsorship",
    "custom_image",
    "back_cover"
  ]);
  return isolated.has(moduleType);
}

function normalizeModules(modules: ShowModule[]): ModuleItem[] {
  return modules.map((mod) => ({
    id: mod.id,
    module_type: mod.module_type,
    display_title:
      mod.module_type === "actf_sponsorship"
        ? "ACTF Sponsorship"
        : mod.display_title || moduleTypeLabels[mod.module_type] || mod.module_type,
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

function getPlacementLabel(item: ModuleItem) {
  const isolated =
    String(item.settings.placement_mode ?? "").toLowerCase() === "isolated" ||
    Boolean(item.settings.separate_page ?? isDefaultIsolated(item.module_type));
  return isolated ? "Own page" : "Can flow with nearby sections";
}

function ModuleSettings({
  item,
  onUpdate,
  showId,
  programSlug
}: {
  item: ModuleItem;
  onUpdate: (next: Record<string, unknown>) => void;
  showId?: string;
  programSlug?: string | null;
}) {
  const setSetting = (key: string, value: unknown) => {
    onUpdate({ ...item.settings, [key]: value });
  };

  if (item.module_type === "bios") {
    return (
      <div className="module-settings-grid">
        <label>
          Bio order
          <select
            value={String(item.settings.sort_mode ?? "alpha")}
            onChange={(e) => setSetting("sort_mode", e.target.value)}
          >
            <option value="alpha">Alphabetical</option>
            <option value="custom">Custom order</option>
          </select>
        </label>

        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={Boolean(item.settings.include_headshots ?? true)}
            onChange={(e) => setSetting("include_headshots", e.target.checked)}
          />
          <span>Include headshots with bios</span>
        </label>
      </div>
    );
  }

  if (item.module_type === "cast_list") {
    return (
      <div className="module-settings-grid">
        <label>
          Cast grouping
          <select
            value={String(item.settings.group_by ?? "none")}
            onChange={(e) => setSetting("group_by", e.target.value)}
          >
            <option value="none">No grouping</option>
            <option value="act">Group by act</option>
          </select>
        </label>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={Boolean(item.settings.role_list_grouping_enabled ?? true)}
            onChange={(e) => {
              const enabled = e.target.checked;
              onUpdate({
                ...item.settings,
                role_list_grouping_enabled: enabled,
                placement_mode: enabled ? "flow" : "isolated",
                separate_page: !enabled,
                keep_together: !enabled
              });
            }}
          />
          <span>Let this list share a page when there is room</span>
        </label>
      </div>
    );
  }

  if (item.module_type === "creative_team" || item.module_type === "production_team") {
    return (
      <div className="module-settings-grid">
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={Boolean(item.settings.role_list_grouping_enabled ?? true)}
            onChange={(e) => {
              const enabled = e.target.checked;
              onUpdate({
                ...item.settings,
                role_list_grouping_enabled: enabled,
                placement_mode: enabled ? "flow" : "isolated",
                separate_page: !enabled,
                keep_together: !enabled
              });
            }}
          />
          <span>Let this list share a page when there is room</span>
        </label>
      </div>
    );
  }

  if (item.module_type === "headshots_grid") {
    return (
      <div className="module-settings-grid">
        <label>
          Headshots per page
          <input
            type="number"
            min={2}
            max={24}
            value={Number(item.settings.max_per_page ?? 8)}
            onChange={(e) => setSetting("max_per_page", Number(e.target.value))}
          />
        </label>

        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={Boolean(item.settings.show_names ?? true)}
            onChange={(e) => setSetting("show_names", e.target.checked)}
          />
          <span>Show names under headshots</span>
        </label>
      </div>
    );
  }

  if (item.module_type === "back_cover") {
    return (
      <div className="module-settings-grid">
        <label>
          Back cover content
          <select
            value={String(item.settings.mode ?? "schedule")}
            onChange={(e) => setSetting("mode", e.target.value)}
          >
            <option value="schedule">Season schedule</option>
            <option value="image">Image</option>
            <option value="auto">Choose automatically</option>
          </select>
        </label>
      </div>
    );
  }

  if (item.module_type === "custom_text") {
    return (
      <div className="module-settings-grid module-settings-wide">
        <RichTextEditor
          label={`${item.display_title || "Formatted Text"} content`}
          value={String(item.settings.body ?? "")}
          onChange={(next) => setSetting("body", next)}
          placeholder="Add formatted text for this section."
          minHeightPx={220}
        />
      </div>
    );
  }

  if (item.module_type === "custom_image") {
    const imageInputId = `custom-image-${item.id}`;
    return (
      <div className="module-settings-grid">
        <div className="stack-sm">
          <label>
            Image URL
            <input
              id={imageInputId}
              value={String(item.settings.image_url ?? "")}
              onChange={(event) => setSetting("image_url", event.target.value)}
              placeholder="https://..."
            />
          </label>
          {programSlug ? (
            <ProgramImageUpload
              programSlug={programSlug}
              showId={showId}
              assetType="custom"
              targetInputId={imageInputId}
              label="Upload image"
              onUploadedUrl={(url) => setSetting("image_url", url)}
            />
          ) : null}
          <div className="meta-text">
            Uploaded images are optimized automatically and scaled to fit the page.
          </div>
        </div>
      </div>
    );
  }

  if (item.module_type === "actf_sponsorship") {
    const imageInputId = `actf-sponsorship-image-${item.id}`;
    return (
      <div className="module-settings-grid module-settings-wide">
        <div className="stack-sm">
          <label>
            Header image URL
            <input
              id={imageInputId}
              value={String(item.settings.image_url ?? "")}
              onChange={(event) => setSetting("image_url", event.target.value)}
              placeholder="https://..."
            />
          </label>
          {programSlug ? (
            <ProgramImageUpload
              programSlug={programSlug}
              showId={showId}
              assetType="sponsor"
              targetInputId={imageInputId}
              label="Upload header image"
              onUploadedUrl={(url) => setSetting("image_url", url)}
            />
          ) : null}
          <div className="row-wrap">
            <label>
              Page background
              <input
                type="color"
                value={String(item.settings.background_color ?? "#fffef9")}
                onChange={(event) => setSetting("background_color", event.target.value)}
              />
            </label>
            <label>
              Spacing
              <select
                value={String(item.settings.spacing ?? "normal")}
                onChange={(event) => setSetting("spacing", event.target.value)}
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="relaxed">Relaxed</option>
              </select>
            </label>
            <label>
              Header image size
              <select
                value={String(item.settings.image_size ?? "medium")}
                onChange={(event) => setSetting("image_size", event.target.value)}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="full">Full width</option>
              </select>
            </label>
          </div>
        </div>

        <ModuleHtmlEditor
          label={`${item.display_title || "ACTF Sponsorship"} body`}
          value={String(item.settings.body ?? "")}
          onChange={(next) => setSetting("body", next)}
          placeholder="Add ACTF sponsorship copy here."
          minHeightPx={320}
        />
      </div>
    );
  }

  return (
    <div className="module-settings-empty">
      This section uses content from the show setup or people pages. There are no extra settings here yet.
    </div>
  );
}

export function ProgramPlanEditor({
  modules,
  onSubmitAction,
  previewModuleId,
  previewBasePath,
  paddingSimIds,
  showId,
  programSlug
}: {
  modules: ShowModule[];
  onSubmitAction: (formData: FormData) => void;
  previewModuleId?: string;
  previewBasePath?: string;
  paddingSimIds?: string[];
  showId?: string;
  programSlug?: string | null;
}) {
  const [items, setItems] = useState<ModuleItem[]>(() => normalizeModules(modules));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newModuleType, setNewModuleType] = useState("custom_text");
  const [mode, setMode] = useState<PlanMode>("sections");

  const visibleItems = useMemo(() => items.filter((item) => item.visible), [items]);
  const hiddenItems = useMemo(() => items.filter((item) => !item.visible), [items]);
  const flexibleCount = useMemo(
    () => items.filter((item) => item.module_type === "custom_text" || item.module_type === "custom_image").length,
    [items]
  );

  const update = <K extends keyof ModuleItem>(index: number, key: K, value: ModuleItem[K]) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const updateById = <K extends keyof ModuleItem>(id: string, key: K, value: ModuleItem[K]) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const updateSettingsById = (id: string, nextSettings: Record<string, unknown>) => {
    updateById(id, "settings", nextSettings);
  };

  const setPageBehavior = (id: string, modeValue: "share" | "standalone") => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const separate = modeValue === "standalone";
        return {
          ...item,
          settings: {
            ...item.settings,
            placement_mode: separate ? "isolated" : "flow",
            separate_page: separate,
            keep_together: separate
          }
        };
      })
    );
  };

  const moveVisibleItem = (fromVisibleIndex: number, toVisibleIndex: number) => {
    setItems((current) => {
      const visible = current.filter((item) => item.visible);
      const reorderedVisible = moveItem(visible, fromVisibleIndex, toVisibleIndex);
      let visiblePointer = 0;
      return current.map((item) => {
        if (!item.visible) return item;
        const nextItem = reorderedVisible[visiblePointer];
        visiblePointer += 1;
        return nextItem;
      });
    });
  };

  const payload = useMemo(
    () =>
      JSON.stringify(
        items.map((item) =>
          item.module_type === "actf_sponsorship"
            ? {
                ...item,
                display_title: "ACTF Sponsorship"
              }
            : item
        )
      ),
    [items]
  );

  const addModule = () => {
    setItems((current) => [
      ...current,
      {
        id: `new-${newModuleType}-${Date.now()}`,
        module_type: newModuleType,
        display_title: newModuleType === "actf_sponsorship" ? "ACTF Sponsorship" : moduleTypeLabels[newModuleType] || newModuleType,
        visible: true,
        filler_eligible: false,
        settings: {
          placement_mode: isDefaultIsolated(newModuleType) ? "isolated" : "flow",
          separate_page: isDefaultIsolated(newModuleType),
          show_header: true,
          allow_multiple_pages: newModuleType === "bios" || newModuleType === "custom_pages",
          ...(newModuleType === "actf_sponsorship"
            ? {
                background_color: "#fffef9",
                spacing: "normal"
              }
            : {})
        }
      }
    ]);
    setMode("sections");
  };

  const isRemovableModule = (moduleType: string) =>
    moduleType === "custom_text" || moduleType === "custom_image" || moduleType === "custom_pages";

  const buildPreviewHref = (moduleId: string) => {
    const params = new URLSearchParams();
    params.set("tab", "program-plan");
    params.set("modulePreviewId", moduleId);
    if ((paddingSimIds ?? []).length > 0) {
      params.set("paddingSim", (paddingSimIds ?? []).join(","));
    }
    if (previewBasePath && previewBasePath.includes("?")) {
      return `${previewBasePath.split("?")[0]}?${params.toString()}`;
    }
    return `${previewBasePath ?? ""}?${params.toString()}`;
  };

  return (
    <form action={onSubmitAction} className="program-plan-workbench" data-pending-label="Saving sections and order..." data-preserve-scroll="true">
      <input type="hidden" name="modulesPayload" value={payload} readOnly />

      <article className="card program-plan-hero">
        <div className="program-plan-hero-copy">
          <span className="eyebrow">Program Builder</span>
          <h2>Build the playbill in production-friendly steps.</h2>
          <p>
            Set up the sections you want, then switch to Program Order to arrange only the sections that will appear in the final playbill.
          </p>
        </div>
        <div className="program-plan-stats" aria-label="Program section summary">
          <div>
            <strong>{visibleItems.length}</strong>
            <span>included</span>
          </div>
          <div>
            <strong>{hiddenItems.length}</strong>
            <span>hidden</span>
          </div>
          <div>
            <strong>{flexibleCount}</strong>
            <span>flexible</span>
          </div>
        </div>
      </article>

      <article className="card program-plan-toolbar">
        <div className="segmented-control" aria-label="Program plan mode">
          <button
            type="button"
            className={mode === "sections" ? "is-active" : ""}
            onClick={() => setMode("sections")}
          >
            Section Setup
          </button>
          <button
            type="button"
            className={mode === "order" ? "is-active" : ""}
            onClick={() => setMode("order")}
          >
            Program Order
          </button>
        </div>
        <div className="program-add-section">
          <label>
            Add a section
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

      {mode === "sections" ? (
        <section className="program-section-list" aria-label="Section setup">
          {items.map((item, index) => {
            const includedLabel = item.visible ? "Included in playbill" : "Hidden for now";
            return (
              <article
                key={item.id}
                className={`program-section-card ${item.visible ? "is-visible" : "is-hidden"}`}
              >
                <div className="program-section-card-header">
                  <div>
                    <div className="program-section-kicker">
                      <span className={`status-dot ${item.visible ? "is-live" : ""}`} aria-hidden />
                      {moduleTypeLabels[item.module_type] || item.module_type}
                    </div>
                    <h3>{item.display_title || moduleTypeLabels[item.module_type] || "Untitled section"}</h3>
                    <p>{moduleTypeDescriptions[item.module_type] || "Program section content and layout settings."}</p>
                  </div>
                  <div className="program-section-actions">
                    {previewBasePath ? (
                      <a
                        className="ghost-button"
                        href={buildPreviewHref(item.id)}
                        style={previewModuleId === item.id ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
                      >
                        {previewModuleId === item.id ? "Previewing" : "Preview"}
                      </a>
                    ) : null}
                    {isRemovableModule(item.module_type) ? (
                      <button
                        type="button"
                        className="ghost-button ghost-button-danger"
                        onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="program-section-fields">
                  {item.module_type === "actf_sponsorship" ? (
                    <div className="readonly-field">
                      <span>Section title</span>
                      <strong>ACTF Sponsorship</strong>
                    </div>
                  ) : (
                    <label>
                      Section title shown in the playbill
                      <input value={item.display_title} onChange={(event) => update(index, "display_title", event.target.value)} />
                    </label>
                  )}
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={item.visible}
                      onChange={(event) => update(index, "visible", event.target.checked)}
                    />
                    <span>
                      <strong>{includedLabel}</strong>
                      <small>{item.visible ? "This section appears in Program Order." : "Keep content saved without printing it yet."}</small>
                    </span>
                  </label>
                </div>

                <details className="program-section-details" open={item.module_type === "custom_text" || item.module_type === "custom_image"}>
                  <summary>Content and section options</summary>
                  <ModuleSettings item={item} onUpdate={(next) => update(index, "settings", next)} showId={showId} programSlug={programSlug} />
                </details>

                <details className="program-section-details">
                  <summary>Advanced layout controls</summary>
                  <div className="advanced-layout-grid">
                    {item.module_type === "actf_sponsorship" ? (
                      <div className="module-settings-empty">ACTF Sponsorship always renders as a dedicated full page.</div>
                    ) : (
                      <label className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={Boolean(item.settings.show_header ?? true)}
                          onChange={(event) => updateSettingsById(item.id, { ...item.settings, show_header: event.target.checked })}
                        />
                        <span>Show this section title in the playbill</span>
                      </label>
                    )}

                    <fieldset className="plain-fieldset">
                      <legend>Page placement</legend>
                      <label className="checkbox-inline">
                        <input
                          type="radio"
                          name={`page-behavior-${item.id}`}
                          disabled={item.module_type === "actf_sponsorship"}
                          checked={
                            String(item.settings.placement_mode ?? "").toLowerCase() === "flow" ||
                            !Boolean(item.settings.separate_page ?? isDefaultIsolated(item.module_type))
                          }
                          onChange={() => setPageBehavior(item.id, "share")}
                        />
                        <span>Flow with nearby sections when there is room</span>
                      </label>
                      <label className="checkbox-inline">
                        <input
                          type="radio"
                          name={`page-behavior-${item.id}`}
                          disabled={item.module_type === "actf_sponsorship"}
                          checked={
                            String(item.settings.placement_mode ?? "").toLowerCase() === "isolated" ||
                            Boolean(item.settings.separate_page ?? isDefaultIsolated(item.module_type))
                          }
                          onChange={() => setPageBehavior(item.id, "standalone")}
                        />
                        <span>Start this section on its own page</span>
                      </label>
                    </fieldset>

                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={item.filler_eligible}
                        onChange={(event) => update(index, "filler_eligible", event.target.checked)}
                      />
                      <span>Use this hidden section as optional filler if the booklet needs pages</span>
                    </label>

                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={Boolean(item.settings.allow_multiple_pages ?? (item.module_type === "bios" || item.module_type === "custom_pages"))}
                        onChange={(event) =>
                          updateSettingsById(item.id, { ...item.settings, allow_multiple_pages: event.target.checked })
                        }
                      />
                      <span>Let this section continue onto another page if it runs long</span>
                    </label>
                  </div>
                </details>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="program-order-board" aria-label="Program order">
          <article className="program-order-intro">
            <div>
              <span className="eyebrow">Program Order</span>
              <h3>Arrange the sections your audience will actually see.</h3>
              <p>Hidden sections stay out of this list so the order is easier to understand. Use Section Setup to include or hide sections.</p>
            </div>
            {hiddenItems.length > 0 ? (
              <div className="hidden-summary">{hiddenItems.length} hidden section{hiddenItems.length === 1 ? "" : "s"}</div>
            ) : null}
          </article>

          {visibleItems.length === 0 ? (
            <div className="empty-state-card">
              No sections are currently included. Switch to Section Setup and include at least one section.
            </div>
          ) : (
            <div className="program-order-list">
              {visibleItems.map((item, visibleIndex) => (
                <article
                  key={`order-${item.id}`}
                  className="program-order-item"
                  style={{ opacity: draggingId === item.id ? 0.55 : 1 }}
                  draggable
                  onDragStart={(event) => {
                    setDragIndex(visibleIndex);
                    setDraggingId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex === null || dragIndex === visibleIndex) {
                      return;
                    }
                    moveVisibleItem(dragIndex, visibleIndex);
                    setDragIndex(null);
                    setDraggingId(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDraggingId(null);
                  }}
                >
                  <div className="program-order-grip" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="program-order-number">{visibleIndex + 1}</div>
                  <div className="program-order-copy">
                    <strong>{item.display_title || moduleTypeLabels[item.module_type] || item.module_type}</strong>
                    <span>{moduleTypeLabels[item.module_type] || item.module_type} • {getPlacementLabel(item)}</span>
                  </div>
                  <div className="program-order-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => moveVisibleItem(visibleIndex, Math.max(0, visibleIndex - 1))}
                      disabled={visibleIndex === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => moveVisibleItem(visibleIndex, Math.min(visibleItems.length - 1, visibleIndex + 1))}
                      disabled={visibleIndex === visibleItems.length - 1}
                    >
                      Down
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {hiddenItems.length > 0 ? (
            <details className="program-hidden-list">
              <summary>Show hidden sections</summary>
              <div className="chip-row">
                {hiddenItems.map((item) => (
                  <button
                    key={`hidden-${item.id}`}
                    type="button"
                    className="tab-chip"
                    onClick={() => updateById(item.id, "visible", true)}
                  >
                    Include {item.display_title || moduleTypeLabels[item.module_type] || item.module_type}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      )}

      <div className="program-plan-savebar">
        <div>
          <strong>Ready to save?</strong>
          <span>Changes are not applied until you save sections and order.</span>
        </div>
        <button type="submit">Save Sections and Order</button>
      </div>
    </form>
  );
}
