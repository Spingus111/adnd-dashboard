"use client";

import { useEffect, useRef } from "react";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function noteHtml(value: string) {
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  return value.split("\n").map((line) => `<div>${escapeHtml(line) || "<br>"}</div>`).join("");
}

export default function MarkdownNotes({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const editor = useRef<HTMLDivElement>(null);
  const editing = useRef(false);

  useEffect(() => {
    if (!editor.current || editing.current) return;
    const next = noteHtml(value);
    if (editor.current.innerHTML !== next) editor.current.innerHTML = next;
  }, [value]);

  function command(name: string, argument?: string) {
    editor.current?.focus();
    document.execCommand(name, false, argument);
    if (editor.current) onChange(editor.current.innerHTML);
  }

  return <div className="wysiwyg-notes-editor">
    <div className="wysiwyg-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      <button type="button" title="Bold" aria-label="Bold" onMouseDown={(event) => { event.preventDefault(); command("bold"); }}><b>B</b></button>
      <button type="button" title="Italic" aria-label="Italic" onMouseDown={(event) => { event.preventDefault(); command("italic"); }}><i>I</i></button>
      <button type="button" title="Heading" aria-label="Heading" onMouseDown={(event) => { event.preventDefault(); command("formatBlock", "h3"); }}>H</button>
      <button type="button" title="Bullet list" aria-label="Bullet list" onMouseDown={(event) => { event.preventDefault(); command("insertUnorderedList"); }}>• List</button>
      <button type="button" title="Add link" aria-label="Add link" onMouseDown={(event) => { event.preventDefault(); const href = window.prompt("Link URL"); if (/^https?:\/\//i.test(href ?? "")) command("createLink", href); }}>Link</button>
      <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={(event) => { event.preventDefault(); command("removeFormat"); }}>Clear</button>
    </div>
    <div
      ref={editor}
      className="wysiwyg-notes-field"
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Notes…"
      onFocus={() => { editing.current = true; }}
      onInput={() => { if (editor.current) onChange(editor.current.innerHTML); }}
      onBlur={() => {
        editing.current = false;
        if (editor.current) onChange(editor.current.innerHTML);
      }}
    />
  </div>;
}
