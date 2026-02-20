"use client";

import { useMemo, useState } from "react";

type Item = {
  token: string;
  label: string;
  enabled: boolean;
};

const defaults: Item[] = [
  { token: "poster", label: "Poster", enabled: true },
  { token: "director_note", label: "Director's Note", enabled: true },
  { token: "dramaturgical_note", label: "Dramaturgical Note", enabled: true },
  { token: "billing", label: "Billing", enabled: true },
  { token: "acts_songs", label: "Acts & Songs", enabled: true },
  { token: "cast_bios", label: "Cast Bios", enabled: true },
  { token: "team_bios", label: "Production Team Bios", enabled: true },
  { token: "department_info", label: "Department Information", enabled: true },
  { token: "actf_ad", label: "ACTF Ad", enabled: true },
  { token: "acknowledgements", label: "Acknowledgements", enabled: true },
  { token: "season_calendar", label: "Season Calendar", enabled: true },
  { token: "production_photos", label: "Production Photos", enabled: true },
  { token: "custom_pages", label: "Custom Pages", enabled: true }
];

function parseInitialTokens(initialValue?: string) {
  if (!initialValue) {
    return defaults;
  }

  const tokens = initialValue
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const seen = new Set(tokens);
  const ordered = tokens
    .map((token) => defaults.find((item) => item.token === token))
    .filter((item): item is Item => Boolean(item))
    .map((item) => ({ ...item, enabled: true }));

  const rest = defaults
    .filter((item) => !seen.has(item.token))
    .map((item) => ({ ...item, enabled: false }));

  return [...ordered, ...rest];
}

export function SectionOrderBuilder({ initialValue }: { initialValue?: string }) {
  const [items, setItems] = useState<Item[]>(() => parseInitialTokens(initialValue));

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

  const toggle = (index: number) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, enabled: !item.enabled } : item)));
  };

  const serialized = useMemo(
    () =>
      items
        .filter((item) => item.enabled)
        .map((item) => item.token)
        .join("\n"),
    [items]
  );

  return (
    <label>
      Section Order
      <div className="card grid">
        {items.map((item, index) => (
          <div key={item.token} className="order-row">
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 500 }}>
              <input type="checkbox" checked={item.enabled} onChange={() => toggle(index)} />
              {item.label}
            </label>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button type="button" onClick={() => move(index, -1)}>
                Up
              </button>
              <button type="button" onClick={() => move(index, 1)}>
                Down
              </button>
            </div>
          </div>
        ))}
      </div>
      <input type="hidden" name="layoutOrder" value={serialized} readOnly />
    </label>
  );
}
