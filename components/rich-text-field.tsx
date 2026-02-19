"use client";

import { useMemo, useRef, useState } from "react";

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

  const apply = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    setValue(editorRef.current?.innerHTML ?? "");
  };

  const createLink = () => {
    const url = window.prompt("Enter URL (https://...)");
    if (!url) {
      return;
    }
    editorRef.current?.focus();
    document.execCommand("createLink", false, url);
    setValue(editorRef.current?.innerHTML ?? "");
  };

  const requiredAttr = useMemo(() => (required ? "true" : undefined), [required]);

  return (
    <label>
      {label}
      <div className="rich-toolbar">
        <button type="button" onClick={() => apply("bold")}>
          B
        </button>
        <button type="button" onClick={() => apply("italic")}>
          I
        </button>
        <button type="button" onClick={() => apply("underline")}>
          U
        </button>
        <button type="button" onClick={() => apply("insertUnorderedList")}>
          Bullets
        </button>
        <button type="button" onClick={() => apply("insertOrderedList")}>
          Numbered
        </button>
        <button type="button" onClick={createLink}>
          Link
        </button>
        <button type="button" onClick={() => apply("removeFormat")}>
          Clear
        </button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Start typing..."}
        data-required={requiredAttr}
        onInput={(event) => setValue(event.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: initialValue }}
      />
      <input type="hidden" name={name} value={value} required={required} />
    </label>
  );
}
