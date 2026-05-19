"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

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
};

const blockOptions = [
  { value: "P", label: "Paragraph" },
  { value: "H3", label: "Heading" },
  { value: "H4", label: "Subheading" },
  { value: "BLOCKQUOTE", label: "Quote" }
];

export function RichTextEditor({ label, value, onChange, placeholder, minHeightPx = 180 }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceDraft, setSourceDraft] = useState("");
  const [format, setFormat] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
    orderedList: false,
    block: "P"
  });

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  useEffect(() => {
    if (!sourceOpen) return;
    window.setTimeout(() => sourceTextareaRef.current?.focus(), 0);
  }, [sourceOpen]);

  const refreshFormatState = () => {
    const nextBlock = String(document.queryCommandValue("formatBlock") || "P").replace(/[<>]/g, "").toUpperCase();
    setFormat({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      unorderedList: document.queryCommandState("insertUnorderedList"),
      orderedList: document.queryCommandState("insertOrderedList"),
      block: nextBlock || "P"
    });
  };

  const run = (command: string, arg?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg);
    onChange(editorRef.current.innerHTML);
    refreshFormatState();
  };

  const openSource = () => {
    const html = editorRef.current?.innerHTML ?? value;
    setSourceDraft(sanitizeRichText(html));
    setSourceOpen(true);
  };

  const saveSource = () => {
    const nextHtml = sanitizeRichText(sourceDraft);
    onChange(nextHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = nextHtml;
    }
    setSourceOpen(false);
    window.setTimeout(() => {
      editorRef.current?.focus();
      refreshFormatState();
    }, 0);
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
        </div>

        <div className="rich-toolbar-group">
          <button type="button" className={`rich-tool-button rich-tool-button-icon ${format.bold ? "is-active" : ""}`} onClick={() => run("bold")} aria-pressed={format.bold} title="Bold">
            B
          </button>
          <button type="button" className={`rich-tool-button rich-tool-button-icon ${format.italic ? "is-active" : ""}`} onClick={() => run("italic")} aria-pressed={format.italic} title="Italic">
            I
          </button>
          <button type="button" className={`rich-tool-button rich-tool-button-icon ${format.underline ? "is-active" : ""}`} onClick={() => run("underline")} aria-pressed={format.underline} title="Underline">
            U
          </button>
        </div>

        <div className="rich-toolbar-group">
          <button
            type="button"
            className={`rich-tool-button ${format.unorderedList ? "is-active" : ""}`}
            onClick={() => run("insertUnorderedList")}
            aria-pressed={format.unorderedList}
            title="Bulleted list"
          >
            Bullets
          </button>
          <button
            type="button"
            className={`rich-tool-button ${format.orderedList ? "is-active" : ""}`}
            onClick={() => run("insertOrderedList")}
            aria-pressed={format.orderedList}
            title="Numbered list"
          >
            Numbered
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("outdent")} title="Decrease indent">
            Outdent
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("indent")} title="Increase indent">
            Indent
          </button>
        </div>

        <div className="rich-toolbar-group">
          <button type="button" className="rich-tool-button" onClick={() => run("undo")} title="Undo">
            Undo
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("redo")} title="Redo">
            Redo
          </button>
        </div>

        <div className="rich-toolbar-group">
          <button
            type="button"
            className="rich-tool-button"
            onClick={() => {
              const url = window.prompt("Link URL (https://...)");
              if (url?.trim()) run("createLink", url.trim());
            }}
            title="Create link"
          >
            Link
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("unlink")} title="Remove link">
            Unlink
          </button>
          <button type="button" className="rich-tool-button" onClick={() => run("removeFormat")} title="Clear formatting">
            Clear
          </button>
        </div>

        <div className="rich-toolbar-group">
          <button type="button" className="rich-tool-button rich-tool-source-button" onClick={openSource} title="Edit HTML source">
            Source
          </button>
        </div>
      </div>
    ),
    [format, label, value]
  );

  return (
    <>
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
      {sourceOpen ? (
        <div
          className="rich-source-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSourceOpen(false);
            }
          }}
        >
          <section className="rich-source-modal" role="dialog" aria-modal="true" aria-label={`${label} source code`}>
            <div className="rich-source-modal-header">
              <strong>Source Code</strong>
              <button type="button" className="rich-source-close" onClick={() => setSourceOpen(false)} aria-label="Close source editor">
                x
              </button>
            </div>
            <textarea
              ref={sourceTextareaRef}
              className="rich-source-textarea"
              value={sourceDraft}
              onChange={(event) => setSourceDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setSourceOpen(false);
                }
              }}
              spellCheck={false}
            />
            <div className="rich-source-modal-actions">
              <button type="button" className="rich-source-cancel" onClick={() => setSourceOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={saveSource}>
                Save
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
