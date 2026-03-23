"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeightPx?: number;
};

type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  block: string;
  fontSize: string;
  foreColor: string;
};

const blockOptions = [
  { value: "P", label: "Paragraph" },
  { value: "H3", label: "Heading" },
  { value: "H4", label: "Subheading" },
  { value: "BLOCKQUOTE", label: "Quote" }
];

const fontSizeOptions = [
  { value: "2", label: "Small" },
  { value: "3", label: "Normal" },
  { value: "4", label: "Large" },
  { value: "5", label: "XL" },
  { value: "6", label: "XXL" }
];

function normalizeColor(value: string) {
  const match = value.trim().match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  if (!match) {
    return value || "#000000";
  }
  const [, r, g, b] = match;
  return `#${[r, g, b]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function ModuleHtmlEditor({ label, value, onChange, placeholder, minHeightPx = 280 }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [format, setFormat] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
    orderedList: false,
    block: "P",
    fontSize: "3",
    foreColor: "#000000"
  });

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const refreshFormatState = () => {
    const nextBlock = String(document.queryCommandValue("formatBlock") || "P").replace(/[<>]/g, "").toUpperCase();
    const fontSize = String(document.queryCommandValue("fontSize") || "3");
    const foreColor = normalizeColor(String(document.queryCommandValue("foreColor") || "#000000"));
    setFormat({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      unorderedList: document.queryCommandState("insertUnorderedList"),
      orderedList: document.queryCommandState("insertOrderedList"),
      block: nextBlock || "P",
      fontSize,
      foreColor
    });
  };

  const run = (command: string, arg?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg);
    onChange(editorRef.current.innerHTML);
    refreshFormatState();
  };

  const toolbar = useMemo(
    () => (
      <div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <div className="rich-toolbar-group">
          <label className="rich-toolbar-select-wrap">
            <span className="sr-only">Text style</span>
            <select
              className="rich-toolbar-select"
              value={format.block}
              onChange={(event) => run("formatBlock", event.target.value)}
              aria-label="Text style"
            >
              {blockOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rich-toolbar-select-wrap">
            <span className="sr-only">Font size</span>
            <select
              className="rich-toolbar-select"
              value={format.fontSize}
              onChange={(event) => run("fontSize", event.target.value)}
              aria-label="Font size"
            >
              {fontSizeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rich-toolbar-select-wrap">
            <span className="sr-only">Text color</span>
            <input
              type="color"
              value={format.foreColor}
              onChange={(event) => run("foreColor", event.target.value)}
              aria-label="Text color"
              style={{ width: "2.6rem", height: "2.1rem", padding: "0.2rem" }}
            />
          </label>
        </div>

        <div className="rich-toolbar-group">
          <button type="button" className={`rich-tool-button ${format.bold ? "is-active" : ""}`} onClick={() => run("bold")} aria-pressed={format.bold}>
            B
          </button>
          <button type="button" className={`rich-tool-button ${format.italic ? "is-active" : ""}`} onClick={() => run("italic")} aria-pressed={format.italic}>
            I
          </button>
          <button type="button" className={`rich-tool-button ${format.underline ? "is-active" : ""}`} onClick={() => run("underline")} aria-pressed={format.underline}>
            U
          </button>
        </div>

        <div className="rich-toolbar-group">
          <button
            type="button"
            className={`rich-tool-button ${format.unorderedList ? "is-active" : ""}`}
            onClick={() => run("insertUnorderedList")}
            aria-pressed={format.unorderedList}
          >
            Bullets
          </button>
          <button
            type="button"
            className={`rich-tool-button ${format.orderedList ? "is-active" : ""}`}
            onClick={() => run("insertOrderedList")}
            aria-pressed={format.orderedList}
          >
            Numbered
          </button>
        </div>

        <div className="rich-toolbar-group">
          <button type="button" className="rich-tool-button" onClick={() => run("justifyLeft")}>
            Left
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("justifyCenter")}>
            Center
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("justifyRight")}>
            Right
          </button>
        </div>

        <div className="rich-toolbar-group">
          <button type="button" className="rich-tool-button" onClick={() => run("undo")}>
            Undo
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("redo")}>
            Redo
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("removeFormat")}>
            Clear
          </button>
        </div>
      </div>
    ),
    [format, label]
  );

  return (
    <div className="stack-sm">
      {toolbar}
      <div
        ref={editorRef}
        className="rich-editor rich-editor-live"
        style={{ minHeight: `${minHeightPx}px` }}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Type here..."}
        onInput={() => {
          if (!editorRef.current) return;
          onChange(editorRef.current.innerHTML);
          refreshFormatState();
        }}
        onKeyUp={refreshFormatState}
        onMouseUp={refreshFormatState}
      />
    </div>
  );
}
