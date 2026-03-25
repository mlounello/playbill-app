"use client";

import { useEffect, useMemo, useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { sanitizeRichText } from "@/lib/rich-text";

type RichTextStats = {
  charCount: number;
  wordCount: number;
};

type CounterConfig = {
  mode: "characters" | "words";
  limit: number;
  disabled?: boolean;
  helperText?: string;
  toneClassName?: string;
};

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  initialValue?: string;
  draftNamespace?: string;
  previewTitle?: string;
  counter?: CounterConfig;
  onStatsChange?: (stats: RichTextStats) => void;
};

function stripRichTextToPlain(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function RichTextField({
  name,
  label,
  placeholder,
  required = false,
  initialValue = "",
  draftNamespace,
  previewTitle,
  counter,
  onStatsChange
}: Props) {
  const [value, setValue] = useState(() => {
    if (!draftNamespace || typeof window === "undefined") {
      return initialValue;
    }
    try {
      const saved = window.localStorage.getItem(`${draftNamespace}:rich:${name}`);
      return saved ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (!draftNamespace || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(`${draftNamespace}:rich:${name}`, value);
    } catch {
      // Ignore.
    }
  }, [draftNamespace, name, value]);

  const stats = useMemo(() => {
    const plain = stripRichTextToPlain(value);
    return {
      charCount: plain.length,
      wordCount: plain
        ? plain
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean).length
        : 0
    };
  }, [value]);

  useEffect(() => {
    onStatsChange?.(stats);
  }, [onStatsChange, stats]);

  const counterValue = counter?.mode === "words" ? stats.wordCount : stats.charCount;
  const counterLabel = counter
    ? `${counterValue} / ${counter.limit} ${counter.mode}`
    : "";
  const counterExceeded = counter ? !counter.disabled && counterValue > counter.limit : false;

  return (
    <div className="stack-sm rich-field-layout">
      <div className="stack-sm">
        <div style={{ fontWeight: 600 }}>{label}</div>
        <RichTextEditor
          label={label}
          value={value}
          onChange={setValue}
          placeholder={placeholder}
        />
        {counter ? (
          <div
            className={`rich-field-counter ${counterExceeded ? "rich-field-counter-danger" : ""} ${counter.toneClassName ?? ""}`.trim()}
            aria-live="polite"
          >
            <span>{counterLabel}</span>
            {counter.helperText ? <span>{counter.helperText}</span> : null}
          </div>
        ) : null}
      </div>
      <aside className="rich-live-preview">
        <div className="rich-live-preview-title">Live Preview (first page style)</div>
        {previewTitle ? <h3 className="playbill-title">{previewTitle}</h3> : null}
        <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }} />
      </aside>
      <textarea name={name} value={value} onChange={() => {}} required={required} className="sr-only" />
    </div>
  );
}
