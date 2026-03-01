"use client";

import { useEffect, useRef, useCallback, memo } from "react";
import { Tldraw, createTLStore, defaultShapeUtils } from "tldraw";
import "tldraw/tldraw.css";

const TLDRAW_DARK_CSS = `
  .tl-background { background: #0e0d0b !important; }
  .tl-canvas { background: #0e0d0b !important; }
  .tl-grid { --tl-grid-color: rgba(255,255,255,0.04) !important; }
`;

export const WhiteboardPanel = memo(function WhiteboardPanel({
  ydocRef,
  sendMessage,
  role,
  users = [],
  onCursorMove,
}) {
  const storeRef            = useRef(null);
  const isApplyingRemoteRef = useRef(false);
  const editorRef           = useRef(null);

  // ── 1. Create store once ─────────────────────────────────────────
  if (!storeRef.current) {
    storeRef.current = createTLStore({ shapeUtils: defaultShapeUtils });
  }

  // ── 2. Local changes → DataChannel ───────────────────────────────
  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;

    const unsubscribe = store.listen(
      ({ changes }) => {
        if (isApplyingRemoteRef.current) return;

        const diff = {
          added:   Object.values(changes.added   ?? {}),
          updated: Object.values(changes.updated ?? {}).map(([, next]) => next),
          // Send the full removed record objects so the receiver can
          // identify them reliably regardless of tldraw version quirks
          removed: Object.values(changes.removed ?? {}),
        };

        if (!diff.added.length && !diff.updated.length && !diff.removed.length) return;

        try {
          sendMessage("whiteboard-update", diff);
        } catch (e) {
          console.error("[wb] send error", e);
        }
      },
      { source: "user", scope: "document" }
    );

    return () => unsubscribe();
  }, [sendMessage]);

  // ── 3. Apply incoming remote updates ─────────────────────────────
  const applyRemoteUpdate = useCallback((diff) => {
    const store = storeRef.current;
    if (!store) return;

    try {
      isApplyingRemoteRef.current = true;
      store.mergeRemoteChanges(() => {
        const toPut = [...(diff.added ?? []), ...(diff.updated ?? [])];
        if (toPut.length) store.put(toPut);

        if (diff.removed?.length) {
          // tldraw store.remove() accepts either:
          //   - an array of record objects (with .id property)
          //   - an array of id strings
          // We send full record objects now, but guard both formats for safety.
          const toRemove = diff.removed.map(r =>
            typeof r === "string" ? r : r.id
          );
          store.remove(toRemove);
        }
      });
    } catch (e) {
      console.error("[wb] apply error", e);
    } finally {
      isApplyingRemoteRef.current = false;
    }
  }, []);

  // ── 4. Expose handler on ydoc so page.jsx can call it ────────────
  useEffect(() => {
    if (!ydocRef.current) return;
    ydocRef.current._whiteboardApply = applyRemoteUpdate;
    return () => {
      if (ydocRef.current) delete ydocRef.current._whiteboardApply;
    };
  }, [applyRemoteUpdate, ydocRef]);

  // ── 5. Render ────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <style>{TLDRAW_DARK_CSS}</style>

      <Tldraw
        store={storeRef.current}
        onMount={(editor) => {
          editorRef.current = editor;
          editor.user.updateUserPreferences({ colorScheme: "dark" });

          // Broadcast cursor position via presence store listener
          editor.store.listen(({ changes }) => {
            const entries = Object.values(changes.updated ?? {});
            for (const [, next] of entries) {
              if (
                next?.typeName === "instance_presence" &&
                next?.userId === editor.user.getId()
              ) {
                if (next?.cursor && onCursorMove) {
                  onCursorMove(next.cursor.x, next.cursor.y);
                }
                break;
              }
            }
          }, { source: "user", scope: "presence" });
        }}
      />

      {/* Remote peer cursors overlay */}
      <div style={{ pointerEvents: "none", position: "absolute", inset: 0, zIndex: 10 }}>
        {users
          .filter(u => !u.isLocal && u.canvasCursor)
          .map(u => (
            <div
              key={u.clientId}
              style={{
                position: "absolute",
                left: u.canvasCursor.x,
                top:  u.canvasCursor.y,
                transition: "left 75ms linear, top 75ms linear",
                willChange: "left, top",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 2l12 7-6.5 1.5L8 17z"
                  fill={u.color ?? "#c9a84c"}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{
                position: "absolute",
                top: "18px", left: "14px",
                fontSize: "10px", fontWeight: "700",
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.04em",
                padding: "2px 7px", borderRadius: "4px",
                whiteSpace: "nowrap",
                color: "#0c0b09",
                background: u.color ?? "#c9a84c",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}>
                {u.name && u.name !== "?" ? u.name : u.role}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
});