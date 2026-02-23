"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  initialValue?: string;
};

export function RichTextField({ name, label, placeholder, required = false, initialValue = "" }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const run = (command: string, arg?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg);
    setValue(editorRef.current.innerHTML);
  };

  const onInput = () => {
    if (!editorRef.current) return;
    setValue(editorRef.current.innerHTML);
  };

  return (
    <label>
      {label}
      <div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <button type="button" onClick={() => run("bold")}>
          Bold
        </button>
        <button type="button" onClick={() => run("italic")}>
          Italic
        </button>
        <button type="button" onClick={() => run("underline")}>
          Underline
        </button>
        <button type="button" onClick={() => run("insertUnorderedList")}>
          Bullets
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Link URL (https://...)");
            if (url) run("createLink", url);
          }}
        >
          Link
        </button>
        <button type="button" className="ghost-button" onClick={() => run("removeFormat")}>
          Clear format
        </button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor rich-editor-live"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Type here..."}
        onInput={onInput}
      />
      <textarea name={name} value={value} onChange={() => {}} required={required} className="sr-only" />
    </label>
  );
}

