"use client";

import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  initialValue?: string;
  draftNamespace?: string;
};

export function RichTextField({ name, label, placeholder, required = false, initialValue = "", draftNamespace }: Props) {
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
    <div className="stack-sm">
      <div style={{ fontWeight: 600 }}>{label}</div>
      <RichTextEditor
        label={label}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
      />
      <textarea name={name} value={value} onChange={() => {}} required={required} className="sr-only" />
    </div>
  );
}
