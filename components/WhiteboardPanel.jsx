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
  const lastCursorRef       = useRef({ x: 0, y: 0 });
  const rafRef              = useRef(null);

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



  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── 6. Convert remote canvas coords → screen coords for overlay ──
  //    Called per-render so cursors stay correct when camera pans/zooms.
  const toScreen = useCallback((canvasX, canvasY) => {
    const editor = editorRef.current;
    if (!editor) return { x: canvasX, y: canvasY };
    try {
      return editor.pageToScreen({ x: canvasX, y: canvasY });
    } catch {
      return { x: canvasX, y: canvasY };
    }
  }, []);

  // ── 7. Render ────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <style>{TLDRAW_DARK_CSS}</style>

      <Tldraw
        store={storeRef.current}
        onMount={(editor) => {
          editorRef.current = editor;
          editor.user.updateUserPreferences({ colorScheme: "dark" });

          // Track cursor in canvas space via tldraw's pointer events
          // This runs inside tldraw's own event loop — no perf impact on strokes
          editor.on("event", (e) => {
            if (!onCursorMove) return;
            if (e.type !== "pointer" && e.type !== "move") return;

            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
              try {
                const { x, y } = editor.inputs.currentPagePoint;
                const rx = Math.round(x);
                const ry = Math.round(y);
                const last = lastCursorRef.current;
                if (Math.abs(rx - last.x) > 3 || Math.abs(ry - last.y) > 3) {
                  lastCursorRef.current = { x: rx, y: ry };
                  onCursorMove(rx, ry);
                }
              } catch {}
            });
          });
        }}
      />

      {/* Remote peer cursors overlay — converted to screen space */}
      <div style={{ pointerEvents: "none", position: "absolute", inset: 0, zIndex: 10 }}>
        {users
          .filter(u => !u.isLocal && u.canvasCursor)
          .map(u => {
            const screen = toScreen(u.canvasCursor.x, u.canvasCursor.y);
            return (
              <div
                key={u.clientId}
                style={{
                  position: "absolute",
                  left: screen.x,
                  top:  screen.y,
                  transition: "left 60ms linear, top 60ms linear",
                  willChange: "left, top",
                  pointerEvents: "none",
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
            );
          })}
      </div>
    </div>
  );
});