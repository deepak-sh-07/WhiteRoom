"use client";

/**
 * DocsPanel.jsx  (Week 8)
 * ─────────────────────────────────────────────────────────────────────
 * Collaborative rich-text editor using TipTap + Yjs.
 * Syncs document state via the existing encrypted DataChannel mesh.
 *
 * Props:
 *   ydocRef      — ref to the shared Y.Doc from page.jsx
 *   sendMessage  — (type, payload) => void  (DataChannel broadcast)
 *   role         — "host" | "peer"
 *   users        — awareness users array (for presence avatars)
 *   localName    — display name of local user
 *   localColor   — hex colour of local user
 */

import { useEffect, useRef, useCallback, memo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";

// ── Toolbar button helper ──────────────────────────────────────────
function ToolBtn({ active, disabled, onClick, title, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "30px", height: "30px", borderRadius: "7px", border: "none",
        cursor: disabled ? "default" : "pointer", flexShrink: 0,
        background: active ? "rgba(201,168,76,0.18)" : "transparent",
        color: active ? "#c9a84c" : disabled ? "#3a382f" : "#6b6659",
        fontFamily: "inherit", fontSize: "13px", fontWeight: "700",
        transition: "all 0.12s ease",
      }}
      onMouseEnter={e => { if (!disabled && !active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#f0ead8"; }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(201,168,76,0.18)" : "transparent"; e.currentTarget.style.color = active ? "#c9a84c" : disabled ? "#3a382f" : "#6b6659"; }}
    >
      {children}
    </button>
  );
}

// ── Divider ───────────────────────────────────────────────────────
const ToolDivider = () => (
  <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.07)", margin: "0 2px", flexShrink: 0 }} />
);

// ── Main component ────────────────────────────────────────────────
export const DocsPanel = memo(function DocsPanel({
  ydocRef,
  sendMessage,
  role,
  users = [],
  localName = "You",
  localColor = "#c9a84c",
}) {
  const isApplyingRef = useRef(false);
  const fragmentRef   = useRef(null);
  const [wordCount, setWordCount] = useState(0);

  // Get (or create) the shared Yjs XML fragment for this doc
  if (!fragmentRef.current && ydocRef.current) {
    fragmentRef.current = ydocRef.current.getXmlFragment("tiptap-doc");
  }

  // ── Editor setup ────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable StarterKit's built-in history — Yjs handles undo/redo
        history: false,
      }),
      Collaboration.configure({
        document: ydocRef.current,
        field: "tiptap-doc",
      }),
    ],
    editorProps: {
      attributes: {
        class: "wr-doc-editor",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      // Word count
      const text = editor.getText();
      setWordCount(text.trim() === "" ? 0 : text.trim().split(/\s+/).length);

      // Broadcast the Yjs update — Collaboration extension writes to ydoc,
      // the ydoc "update" listener in page.jsx will pick it up and broadcast
      // automatically, so we don't need to do anything extra here.
    },
  }, []);  // empty deps — editor is stable, Yjs handles all sync

  // ── Apply incoming Yjs updates from remote peers ──────────────
  //    page.jsx receives "yjs-update" → decrypts → calls Y.applyUpdate(ydoc, ...)
  //    The Collaboration extension listens to ydoc internally and updates the editor.
  //    Nothing extra needed here — Yjs + TipTap wire themselves together.

  // ── Expose a no-op _docsApply so page.jsx won't error if it tries ─
  useEffect(() => {
    if (ydocRef.current) {
      ydocRef.current._docsReady = true;
    }
    return () => {
      if (ydocRef.current) delete ydocRef.current._docsReady;
    };
  }, [ydocRef]);

  // ── Cleanup editor on unmount ─────────────────────────────────
  useEffect(() => {
    return () => { editor?.destroy(); };
  }, [editor]);

  if (!editor) return null;

  const activeUsers = users.filter(u => !u.isLocal);

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      background: "#0e0d0b", overflow: "hidden",
    }}>

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "2px",
        padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "#121110", flexShrink: 0, flexWrap: "wrap",
      }}>
        {/* Text style */}
        <ToolBtn title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolBtn>
        <ToolBtn title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} >
          <span style={{ fontStyle: "italic" }}>I</span>
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span style={{ textDecoration: "line-through" }}>S</span>
        </ToolBtn>
        <ToolBtn title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
          {"<>"}
        </ToolBtn>

        <ToolDivider />

        {/* Headings */}
        <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>

        <ToolDivider />

        {/* Lists */}
        <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          ≡
        </ToolBtn>
        <ToolBtn title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolBtn>
        <ToolBtn title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          "
        </ToolBtn>
        <ToolBtn title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          {"{ }"}
        </ToolBtn>

        <ToolDivider />

        {/* History */}
        <ToolBtn title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↩</ToolBtn>
        <ToolBtn title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↪</ToolBtn>

        {/* Spacer + presence avatars + word count */}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Active user avatars */}
          {activeUsers.slice(0, 5).map((u, i) => (
            <div key={u.clientId ?? i} title={u.name ?? u.role} style={{
              width: "22px", height: "22px", borderRadius: "6px",
              background: u.color ?? "#c9a84c",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "10px", fontWeight: "700", color: "#0c0b09",
              border: "2px solid #121110", marginLeft: i > 0 ? "-6px" : 0,
              flexShrink: 0,
            }}>
              {(u.name ?? u.role ?? "?").charAt(0).toUpperCase()}
            </div>
          ))}
          {activeUsers.length > 5 && (
            <span style={{ fontSize: "10px", color: "#6b6659", fontFamily: "monospace" }}>+{activeUsers.length - 5}</span>
          )}
          <ToolDivider />
          <span style={{ fontSize: "10px", color: "#3a382f", fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        </div>
      </div>

      {/* ── Editor area ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "720px", padding: "40px 48px 80px" }}>
          <style>{EDITOR_CSS}</style>
          <EditorContent editor={editor} />
        </div>
      </div>

    </div>
  );
});

// ── Editor prose styles ──────────────────────────────────────────
const EDITOR_CSS = `
  .wr-doc-editor {
    outline: none;
    min-height: 400px;
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 17px;
    line-height: 1.75;
    color: #d4cfc4;
    caret-color: #c9a84c;
  }
  .wr-doc-editor p { margin: 0 0 0.75em; }
  .wr-doc-editor p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #3a382f;
    pointer-events: none;
    float: left;
    height: 0;
    font-style: italic;
  }
  .wr-doc-editor h1 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 2em; font-weight: 400;
    color: #f0ead8; margin: 1.2em 0 0.4em;
    border-bottom: 1px solid rgba(201,168,76,0.15);
    padding-bottom: 0.3em; line-height: 1.2;
  }
  .wr-doc-editor h2 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 1.45em; font-weight: 400;
    color: #e8e2d4; margin: 1.1em 0 0.35em; line-height: 1.3;
  }
  .wr-doc-editor h3 {
    font-family: 'Syne', sans-serif;
    font-size: 1.05em; font-weight: 700;
    color: #c9a84c; margin: 1em 0 0.3em;
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .wr-doc-editor strong { color: #f0ead8; font-weight: 700; }
  .wr-doc-editor em { font-style: italic; color: #c4bfb4; }
  .wr-doc-editor s { color: #6b6659; }
  .wr-doc-editor code {
    font-family: 'DM Mono', monospace;
    font-size: 0.82em;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.15);
    border-radius: 4px; padding: 1px 6px;
    color: #c9a84c;
  }
  .wr-doc-editor pre {
    background: #1a1916; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 16px 20px; margin: 1em 0;
    overflow-x: auto;
  }
  .wr-doc-editor pre code {
    background: none; border: none; padding: 0;
    font-family: 'DM Mono', monospace;
    font-size: 13px; color: #a09a8e; line-height: 1.6;
  }
  .wr-doc-editor blockquote {
    border-left: 3px solid rgba(201,168,76,0.4);
    margin: 1em 0; padding: 4px 0 4px 18px;
    color: #6b6659; font-style: italic;
  }
  .wr-doc-editor ul, .wr-doc-editor ol {
    padding-left: 1.5em; margin: 0.5em 0 0.75em;
  }
  .wr-doc-editor li { margin: 0.25em 0; }
  .wr-doc-editor ul li::marker { color: #c9a84c; }
  .wr-doc-editor ol li::marker { color: #c9a84c; font-family: 'DM Mono', monospace; font-size: 0.85em; }
  .wr-doc-editor hr {
    border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 2em 0;
  }
  /* Yjs collaboration cursor */
  .collaboration-cursor__caret {
    border-left: 2px solid; border-right: 2px solid;
    margin-left: -1px; margin-right: -1px;
    pointer-events: none; word-break: normal;
  }
  .collaboration-cursor__label {
    border-radius: 3px 3px 3px 0; font-size: 11px;
    font-family: 'DM Mono', monospace; font-weight: 500;
    left: -1px; line-height: 1; padding: 2px 6px;
    position: absolute; top: -1.4em; white-space: nowrap;
    color: #0c0b09; pointer-events: none; user-select: none;
  }
`;