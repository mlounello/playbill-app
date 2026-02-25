"use client";

import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { sanitizeRichText } from "@/lib/rich-text";

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  initialValue?: string;
  draftNamespace?: string;
  previewTitle?: string;
};

export function RichTextField({
  name,
  label,
  placeholder,
  required = false,
  initialValue = "",
  draftNamespace,
  previewTitle
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
