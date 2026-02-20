"use client";

import { useRef } from "react";

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  initialValue?: string;
};

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  fallbackSelectedText = "text"
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || fallbackSelectedText;
  const next = `${textarea.value.slice(0, start)}${before}${selected}${after}${textarea.value.slice(end)}`;
  textarea.value = next;

  const cursor = start + before.length + selected.length + after.length;
  textarea.selectionStart = cursor;
  textarea.selectionEnd = cursor;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

export function RichTextField({ name, label, placeholder, required = false, initialValue = "" }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  return (
    <label>
      {label}
      <div className="rich-toolbar">
        <button type="button" onClick={() => ref.current && wrapSelection(ref.current, "<strong>", "</strong>")}>
          Bold
        </button>
        <button type="button" onClick={() => ref.current && wrapSelection(ref.current, "<em>", "</em>")}>
          Italic
        </button>
        <button type="button" onClick={() => ref.current && wrapSelection(ref.current, "<u>", "</u>")}>
          Underline
        </button>
        <button type="button" onClick={() => ref.current && wrapSelection(ref.current, "<ul>\n<li>", "</li>\n</ul>", "item") }>
          Bullets
        </button>
        <button type="button" onClick={() => ref.current && wrapSelection(ref.current, "<a href=\"https://\" target=\"_blank\">", "</a>", "link") }>
          Link
        </button>
      </div>
      <textarea
        ref={ref}
        className="rich-textarea"
        name={name}
        required={required}
        placeholder={placeholder ?? "Type here..."}
        defaultValue={initialValue}
      />
    </label>
  );
}
