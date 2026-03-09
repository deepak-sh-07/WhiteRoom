"use client";

/**
 * DocsPanel.jsx  (Week 8)
 * ─────────────────────────────────────────────────────────────────────
 * Collaborative rich-text editor using TipTap + Yjs.
 * Custom cursor overlay — no @tiptap/extension-collaboration-cursor needed.
 * Avoids tldraw/@tiptap version conflict.
 */

import { useEffect, useRef, memo, useState, useCallback } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// ── Toolbar button ─────────────────────────────────────────────────
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

const ToolDivider = () => (
  <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.07)", margin: "0 2px", flexShrink: 0 }} />
);

// ── ProseMirror plugin key for remote cursors ──────────────────────
const remoteCursorKey = new PluginKey("remoteCursors");

// ── TipTap extension: renders remote cursors as decorations ─────────
function RemoteCursorsExtension(getCursors) {
  return Extension.create({
    name: "remoteCursors",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: remoteCursorKey,
          state: {
            init: () => DecorationSet.empty,
            apply(tr, set) {
              const cursors = getCursors();
              if (!cursors.length) return DecorationSet.empty;

              const decos = [];
              const docSize = tr.doc.content.size;

              cursors.forEach(({ pos, name, color }) => {
                const safePos = Math.min(Math.max(pos, 0), docSize);
                const el = document.createElement("span");
                el.className = "remote-cursor-caret";
                el.style.cssText = `border-left: 2px solid ${color}; margin-left: -1px; position: relative; pointer-events: none;`;

                const label = document.createElement("span");
                label.className = "remote-cursor-label";
                label.textContent = name;
                label.style.cssText = `position: absolute; top: -1.5em; left: -1px; background: ${color}; color: #0c0b09; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px 3px 3px 0; white-space: nowrap; pointer-events: none; font-family: 'DM Mono', monospace;`;
                el.appendChild(label);

                decos.push(Decoration.widget(safePos, el, { side: -1, key: `cursor-${name}` }));
              });

              return DecorationSet.create(tr.doc, decos);
            },
          },
          props: {
            decorations(state) { return this.getState(state); },
          },
        }),
      ];
    },
  });
}

// ── Main component ────────────────────────────────────────────────
export const DocsPanel = memo(function DocsPanel({
  ydocRef,
  sendMessage,
  role,
  users = [],
  localName = "You",
  localColor = "#c9a84c",
  roomCode,               // ← needed to identify room in DB
}) {
  const fragmentRef     = useRef(null);
  const undoManagerRef  = useRef(null);
  const editorRef       = useRef(null);
  const remoteCursorsRef = useRef([]); // [{ pos, name, color }]
  const [wordCount, setWordCount] = useState(0);
  const [canUndo, setCanUndo]     = useState(false);
  const [canRedo, setCanRedo]     = useState(false);
  const [snapshots, setSnapshots]     = useState([]); // loaded from DB
  const [showHistory, setShowHistory] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);

  // Get shared Yjs XML fragment
  if (!fragmentRef.current && ydocRef.current) {
    fragmentRef.current = ydocRef.current.getXmlFragment("tiptap-doc");
  }

  // Stable getter for the plugin
  const getCursors = useCallback(() => remoteCursorsRef.current, []);

  // ── Y.UndoManager ────────────────────────────────────────────────
  useEffect(() => {
    if (!fragmentRef.current) return;
    const um = new Y.UndoManager(fragmentRef.current, { captureTimeout: 500 });
    undoManagerRef.current = um;

    const refresh = () => { setCanUndo(um.canUndo()); setCanRedo(um.canRedo()); };
    um.on("stack-item-added",  refresh);
    um.on("stack-item-popped", refresh);
    um.on("stack-cleared",     refresh);

    return () => {
      um.off("stack-item-added",  refresh);
      um.off("stack-item-popped", refresh);
      um.off("stack-cleared",     refresh);
      um.destroy();
      undoManagerRef.current = null;
    };
  }, []);

  // ── Broadcast local cursor position on selection change ──────────
  //    We store cursor pos in awareness state so peers can render it.
  const broadcastCursor = useCallback((pos) => {
    if (!ydocRef.current) return;
    // Reuse the existing awareness broadcast in page.jsx by writing
    // to the ydoc awareness — page.jsx already listens and broadcasts.
    const awareness = ydocRef.current._awareness;
    if (awareness) {
      const cur = awareness.getLocalState() ?? {};
      awareness.setLocalState({ ...cur, docCursor: pos });
    }
  }, [ydocRef]);

  // ── Load snapshots from DB on mount + poll every 10s for sync ───
  useEffect(() => {
    if (!roomCode) return;
    const load = () =>
      fetch(`/api/snapshots/${roomCode}`)
        .then(r => r.json())
        .then(({ snapshots }) => setSnapshots(snapshots ?? []))
        .catch(e => console.error("[snapshots] load error", e));

    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [roomCode]);

  // ── Save snapshot to DB ──────────────────────────────────────────
  const takeSnapshot = useCallback(async () => {
    if (!ydocRef.current || !roomCode) return;
    setSnapLoading(true);
    try {
      const update = Y.encodeStateAsUpdate(ydocRef.current);
      // Convert Uint8Array → base64 string for JSON transport
      const state  = btoa(String.fromCharCode(...update));
      const label  = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const res  = await fetch("/api/snapshots", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ roomCode, label, state }),
      });
      const { snapshot } = await res.json();
      setSnapshots(prev => [snapshot, ...prev]);
    } catch (e) {
      console.error("[snapshots] save error", e);
    } finally {
      setSnapLoading(false);
    }
  }, [ydocRef, roomCode]);

  // ── Restore snapshot from DB ─────────────────────────────────────
  const restoreSnapshot = useCallback((snap) => {
    if (!ydocRef.current) return;

    // Decode base64 → Uint8Array
    const binary = atob(snap.state);
    const update = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) update[i] = binary.charCodeAt(i);

    // Correct restore strategy:
    // 1. Create a fresh throwaway doc and apply the snapshot state to it
    // 2. Encode that doc's full state
    // 3. Clear our live doc's fragment completely
    // 4. Apply the clean state — no merge conflict since fragment is empty
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, update);

    // Get the clean XML content from the temp doc
    const tempFragment = tempDoc.getXmlFragment("tiptap-doc");
    const liveFragment = ydocRef.current.getXmlFragment("tiptap-doc");

    ydocRef.current.transact(() => {
      // Clear live fragment
      liveFragment.delete(0, liveFragment.length);
      // Clone each child from temp into live
      tempFragment.toArray().forEach(child => {
        liveFragment.push([child.clone()]);
      });
    });

    tempDoc.destroy();
    setShowHistory(false);
  }, [ydocRef]);

  // ── Delete snapshot ──────────────────────────────────────────────
  const deleteSnapshot = useCallback(async (id, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/snapshots/${roomCode}?id=${id}`, { method: "DELETE" });
      // Re-fetch from DB so all browsers stay in sync
      const res = await fetch(`/api/snapshots/${roomCode}`);
      const { snapshots } = await res.json();
      setSnapshots(snapshots ?? []);
    } catch (err) {
      console.error("[snapshots] delete error", err);
    }
  }, [roomCode]);


  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({
        document: ydocRef.current,
        field: "tiptap-doc",
      }),
      RemoteCursorsExtension(getCursors),
    ],
    editorProps: {
      attributes: { class: "wr-doc-editor", spellcheck: "true" },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setWordCount(text.trim() === "" ? 0 : text.trim().split(/\s+/).length);
    },
    onSelectionUpdate: ({ editor }) => {
      const pos = editor.state.selection.anchor;
      broadcastCursor(pos);
    },
  }, []);

  useEffect(() => { editorRef.current = editor; }, [editor]);

  // ── Sync remote cursors from users prop → decoration plugin ──────
  //    `users` comes from the awareness state in page.jsx.
  //    Each user may carry a `docCursor` field (absolute ProseMirror pos).
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;

    remoteCursorsRef.current = users
      .filter(u => !u.isLocal && u.docCursor != null)
      .map(u => ({
        pos:   u.docCursor,
        name:  u.name ?? u.role ?? "?",
        color: u.color ?? "#c9a84c",
      }));

    // Force plugin to re-render decorations
    ed.view?.dispatch(ed.state.tr.setMeta(remoteCursorKey, true));
  }, [users]);

  // ── Expose ready flag ────────────────────────────────────────────
  useEffect(() => {
    if (ydocRef.current) ydocRef.current._docsReady = true;
    return () => { if (ydocRef.current) delete ydocRef.current._docsReady; };
  }, [ydocRef]);

  useEffect(() => { return () => { editor?.destroy(); }; }, [editor]);

  if (!editor) return null;

  const activeUsers = users.filter(u => !u.isLocal);

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      background: "#0e0d0b", overflow: "hidden",
    }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "2px",
        padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "#121110", flexShrink: 0, flexWrap: "wrap",
      }}>
        <ToolBtn title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolBtn>
        <ToolBtn title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span style={{ fontStyle: "italic" }}>I</span>
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span style={{ textDecoration: "line-through" }}>S</span>
        </ToolBtn>
        <ToolBtn title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>{"<>"}</ToolBtn>

        <ToolDivider />

        <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>

        <ToolDivider />

        <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>≡</ToolBtn>
        <ToolBtn title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolBtn>
        <ToolBtn title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</ToolBtn>
        <ToolBtn title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"{ }"}</ToolBtn>

        <ToolDivider />

        <ToolBtn title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => undoManagerRef.current?.undo()}>↩</ToolBtn>
        <ToolBtn title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => undoManagerRef.current?.redo()}>↪</ToolBtn>

        <ToolDivider />

        {/* Snapshot save */}
        <ToolBtn title="Save snapshot" disabled={snapLoading} onClick={takeSnapshot}>
          {snapLoading ? "…" : "⊙"}
        </ToolBtn>

        {/* History toggle — only show if snapshots exist */}
        {snapshots.length > 0 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            title="View snapshot history"
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "3px 10px", borderRadius: "7px", border: "none",
              cursor: "pointer", fontSize: "11px", fontWeight: "700",
              fontFamily: "inherit",
              background: showHistory ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)",
              color: showHistory ? "#c9a84c" : "#6b6659",
              transition: "all 0.12s",
              flexShrink: 0,
            }}
          >
            ⏱ {snapshots.length}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Presence avatars */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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

      {/* ── Editor + history sidebar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Editor area */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "720px", padding: "40px 48px 80px" }}>
            <style>{EDITOR_CSS}</style>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* History sidebar */}
        {showHistory && (
          <div style={{
            width: "200px", flexShrink: 0,
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            background: "#0c0b09", overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)",
              fontSize: "10px", fontWeight: "700", color: "#3a382f",
              textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace",
            }}>
              Snapshots
            </div>
            <div style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {snapshots.map((snap, i) => (
                <div
                  key={snap.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "8px 10px", borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                  }}
                  onClick={() => restoreSnapshot(snap)}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(201,168,76,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#c9a84c", fontFamily: "'DM Mono', monospace" }}>
                      #{snapshots.length - i}
                    </div>
                    <div style={{ fontSize: "10px", color: "#6b6659", fontFamily: "'DM Mono', monospace" }}>
                      {snap.label}
                    </div>
                    <div style={{ fontSize: "10px", color: "#3a382f", marginTop: "2px" }}>
                      Tap to restore
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => deleteSnapshot(snap.id, e)}
                    title="Delete snapshot"
                    style={{
                      width: "20px", height: "20px", borderRadius: "5px",
                      border: "none", background: "transparent",
                      color: "#3a382f", cursor: "pointer", fontSize: "12px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "#ef4444"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#3a382f"; }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
});

export default DocsPanel;

// ── Styles ────────────────────────────────────────────────────────
const EDITOR_CSS = `
  .wr-doc-editor {
    outline: none; min-height: 400px;
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 17px; line-height: 1.75;
    color: #d4cfc4; caret-color: #c9a84c;
  }
  .wr-doc-editor p { margin: 0 0 0.75em; }
  .wr-doc-editor p.is-editor-empty:first-child::before {
    content: attr(data-placeholder); color: #3a382f;
    pointer-events: none; float: left; height: 0; font-style: italic;
  }
  .wr-doc-editor h1 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 2em; font-weight: 400; color: #f0ead8;
    margin: 1.2em 0 0.4em; border-bottom: 1px solid rgba(201,168,76,0.15);
    padding-bottom: 0.3em; line-height: 1.2;
  }
  .wr-doc-editor h2 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 1.45em; font-weight: 400; color: #e8e2d4;
    margin: 1.1em 0 0.35em; line-height: 1.3;
  }
  .wr-doc-editor h3 {
    font-family: 'Syne', sans-serif; font-size: 1.05em; font-weight: 700;
    color: #c9a84c; margin: 1em 0 0.3em;
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .wr-doc-editor strong { color: #f0ead8; font-weight: 700; }
  .wr-doc-editor em { font-style: italic; color: #c4bfb4; }
  .wr-doc-editor s { color: #6b6659; }
  .wr-doc-editor code {
    font-family: 'DM Mono', monospace; font-size: 0.82em;
    background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.15);
    border-radius: 4px; padding: 1px 6px; color: #c9a84c;
  }
  .wr-doc-editor pre {
    background: #1a1916; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 16px 20px; margin: 1em 0; overflow-x: auto;
  }
  .wr-doc-editor pre code {
    background: none; border: none; padding: 0;
    font-family: 'DM Mono', monospace; font-size: 13px; color: #a09a8e; line-height: 1.6;
  }
  .wr-doc-editor blockquote {
    border-left: 3px solid rgba(201,168,76,0.4);
    margin: 1em 0; padding: 4px 0 4px 18px; color: #6b6659; font-style: italic;
  }
  .wr-doc-editor ul, .wr-doc-editor ol { padding-left: 1.5em; margin: 0.5em 0 0.75em; }
  .wr-doc-editor li { margin: 0.25em 0; }
  .wr-doc-editor ul li::marker { color: #c9a84c; }
  .wr-doc-editor ol li::marker { color: #c9a84c; font-family: 'DM Mono', monospace; font-size: 0.85em; }
  .wr-doc-editor hr { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 2em 0; }
  .remote-cursor-caret { border-left: 2px solid; margin-left: -1px; position: relative; pointer-events: none; }
  .remote-cursor-label { position: absolute; top: -1.5em; left: -1px; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px 3px 3px 0; white-space: nowrap; pointer-events: none; font-family: 'DM Mono', monospace; color: #0c0b09; }
`;