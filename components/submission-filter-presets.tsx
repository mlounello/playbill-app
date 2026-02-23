"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Preset = {
  id: string;
  name: string;
  filter: string;
  sort: string;
  query: string;
  view: "table" | "cards";
};

const STORAGE_KEY = "playbill_submission_presets";

function readPresets(): Preset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Preset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresets(items: Preset[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function SubmissionFilterPresets({
  filter,
  sort,
  query,
  view
}: {
  filter: string;
  sort: string;
  query: string;
  view: "table" | "cards";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPresets(readPresets());
  }, []);

  const selected = useMemo(() => presets.find((item) => item.id === selectedId) ?? null, [presets, selectedId]);

  const applyPreset = (preset: Preset) => {
    const params = new URLSearchParams();
    params.set("tab", "submissions");
    params.set("submissionFilter", preset.filter);
    params.set("submissionSort", preset.sort);
    params.set("submissionQuery", preset.query);
    params.set("submissionView", preset.view);
    router.push(`${pathname}?${params.toString()}`);
  };

  const buildLink = (preset: Pick<Preset, "filter" | "sort" | "query" | "view">) => {
    const params = new URLSearchParams();
    params.set("tab", "submissions");
    params.set("submissionFilter", preset.filter);
    params.set("submissionSort", preset.sort);
    params.set("submissionQuery", preset.query);
    params.set("submissionView", preset.view);
    return `${window.location.origin}${pathname}?${params.toString()}`;
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
      window.setTimeout(() => setMessage(""), 2200);
    } catch {
      setMessage("Could not copy link.");
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  const applyImportedLink = () => {
    const raw = importUrl.trim();
    if (!raw) return;
    try {
      const parsed = raw.startsWith("http://") || raw.startsWith("https://")
        ? new URL(raw)
        : new URL(raw.startsWith("?") ? `${window.location.origin}${pathname}${raw}` : `${window.location.origin}${pathname}?${raw}`);
      const params = parsed.searchParams;
      if (!params.get("tab")) {
        params.set("tab", "submissions");
      }
      router.push(`${pathname}?${params.toString()}`);
      setImportUrl("");
    } catch {
      setMessage("Invalid link or query string.");
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  return (
    <div className="stack-sm">
      <div className="preset-row">
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            const name = window.prompt("Preset name?");
            if (!name) return;
            const next: Preset[] = [
              ...presets.filter((item) => item.name.toLowerCase() !== name.toLowerCase()),
              { id: crypto.randomUUID(), name, filter, sort, query, view }
            ];
            setPresets(next);
            writePresets(next);
          }}
        >
          Save Current Filters
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => copyToClipboard(buildLink({ filter, sort, query, view }), "Current filter link copied.")}
        >
          Copy Current Link
        </button>

        {presets.length > 0 ? (
          <>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Select preset</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button type="button" className="ghost-button" onClick={() => (selected ? applyPreset(selected) : null)} disabled={!selected}>
              Apply Preset
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => (selected ? copyToClipboard(buildLink(selected), "Preset link copied.") : null)}
              disabled={!selected}
            >
              Copy Preset Link
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                if (!selected) return;
                const next = presets.filter((item) => item.id !== selected.id);
                setPresets(next);
                writePresets(next);
                setSelectedId("");
              }}
              disabled={!selected}
            >
              Delete Preset
            </button>
          </>
        ) : null}
      </div>

      <div className="preset-row">
        <input
          value={importUrl}
          onChange={(event) => setImportUrl(event.target.value)}
          placeholder="Paste preset URL or query string to import"
        />
        <button type="button" className="ghost-button" onClick={applyImportedLink}>
          Import Link
        </button>
      </div>

      {message ? <div className="meta-text">{message}</div> : null}
    </div>
  );
}
