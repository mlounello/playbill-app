"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  formId: string;
  draftNamespace: string;
};

type DraftPayload = {
  fields: Record<string, string>;
  savedAt: string;
};

function loadDraft(key: string): DraftPayload | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.fields || typeof parsed.fields !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function ProgramEditDraftManager({ formId, draftNamespace }: Props) {
  const storageKey = useMemo(() => `${draftNamespace}:form`, [draftNamespace]);
  const [restoredAt, setRestoredAt] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) {
      return;
    }

    const existing = loadDraft(storageKey);
    if (existing) {
      for (const [name, value] of Object.entries(existing.fields)) {
        const elements = form.elements.namedItem(name);
        if (!elements) continue;

        if (elements instanceof RadioNodeList) {
          const first = elements[0] as HTMLInputElement | undefined;
          if (!first) continue;
          if (first.type === "radio") {
            for (let i = 0; i < elements.length; i += 1) {
              const radio = elements[i] as HTMLInputElement;
              radio.checked = radio.value === value;
            }
            continue;
          }
          const node = first as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          node.value = value;
          node.dispatchEvent(new Event("input", { bubbles: true }));
          node.dispatchEvent(new Event("change", { bubbles: true }));
          continue;
        }

        const node = elements as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (node.type === "checkbox") {
          (node as HTMLInputElement).checked = value === "1";
        } else {
          node.value = value;
        }
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setRestoredAt(existing.savedAt || new Date().toISOString());
      setLastSavedAt(existing.savedAt || new Date().toISOString());
    }

    let timer: number | undefined;
    const persist = () => {
      const fields: Record<string, string> = {};
      const controls = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input[name], textarea[name], select[name]");
      controls.forEach((control) => {
        if (!control.name) return;
        if (control instanceof HTMLInputElement && control.type === "file") return;
        if (control instanceof HTMLInputElement && control.type === "radio" && !control.checked) return;
        if (control instanceof HTMLInputElement && control.type === "checkbox") {
          fields[control.name] = control.checked ? "1" : "0";
          return;
        }
        fields[control.name] = control.value;
      });
      const savedAt = new Date().toISOString();
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ fields, savedAt }));
        setLastSavedAt(savedAt);
      } catch {
        // Ignore draft storage failures (private mode/storage quota).
      }
    };

    const onInput = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(persist, 350);
    };

    const onSubmit = () => {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore.
      }
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(`${draftNamespace}:`) && key !== storageKey) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // Ignore.
      }
    };

    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    form.addEventListener("submit", onSubmit);

    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      form.removeEventListener("submit", onSubmit);
    };
  }, [draftNamespace, formId, storageKey]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(storageKey);
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(`${draftNamespace}:`) && key !== storageKey) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Ignore.
    }
    window.location.reload();
  };

  if (!restoredAt) {
    return (
      <div className="card stack-sm">
        <strong>Draft Autosave</strong>
        <div className="meta-text">Draft autosave is enabled for this page.</div>
        <div className="meta-text">
          Last saved: {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Not yet"}
        </div>
      </div>
    );
  }

  return (
    <div className="card stack-sm">
      <strong>Draft Restored</strong>
      <div className="meta-text">Recovered local draft from {new Date(restoredAt).toLocaleString()}.</div>
      <div className="meta-text">
        Last saved: {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Not yet"}
      </div>
      <div>
        <button type="button" className="ghost-button" onClick={clearDraft}>
          Discard Local Draft
        </button>
      </div>
    </div>
  );
}
