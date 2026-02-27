"use client";

/**
 * WhiteboardPanel.jsx  (Week 7)
 * ------------------------------
 * Collaborative whiteboard using tldraw.
 * Syncs canvas state via Yjs Y.Map over the existing encrypted DataChannel.
 * No extra server needed — piggybacks on Week 5/6 infrastructure.
 *
 * Props:
 *   ydocRef        — ref to the Y.Doc from page.jsx
 *   sendMessage    — function(type, payload) to send over DataChannel
 *   roomKeyRef     — ref to AES key for encryption
 *   role           — "host" | "peer"
 *   users          — awareness users array (for cursor display)
 *   localUser      — local awareness state
 */

import { useEffect, useRef, useCallback, memo } from "react";
import { Tldraw, createTLStore, defaultShapeUtils } from "tldraw";
import "tldraw/tldraw.css";
import * as Y from "yjs";

export const WhiteboardPanel = memo(function WhiteboardPanel({
  ydocRef,
  sendMessage,
  role,
  users = [],
}) {
  const storeRef = useRef(null);
  const isApplyingRemoteRef = useRef(false); // prevent echo loops

  // ── 1. Create tldraw store once ──────────────────────────────────
  if (!storeRef.current) {
    storeRef.current = createTLStore({ shapeUtils: defaultShapeUtils });
  }

  // ── 2. Subscribe to local tldraw changes → encrypt → DataChannel ─
  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;

    const unsubscribe = store.listen(
      async ({ changes }) => {
        // skip if this change came from a remote peer (prevent echo)
        if (isApplyingRemoteRef.current) return;
        // Serialize only the diff (added/updated/removed records)
        const diff = {
          added:   Object.values(changes.added   ?? {}),
          updated: Object.values(changes.updated ?? {}).map(([, next]) => next),
          removed: Object.keys(changes.removed   ?? {}),
        };

        if (
          diff.added.length === 0 &&
          diff.updated.length === 0 &&
          diff.removed.length === 0
        ) return;

        try {
          sendMessage("whiteboard-update", diff); // no encryption needed — DataChannel is DTLS secured
        } catch (e) {
          console.error("Whiteboard send error", e);
        }
      },
      { source: "user", scope: "document" } // only user-initiated changes
    );

    return () => unsubscribe();
  }, [sendMessage]);

  // ── 3. Apply incoming remote whiteboard updates ──────────────────
  //    Called from page.jsx handleMessage for type "whiteboard-update"
  const applyRemoteUpdate = useCallback(async (diff) => {
    try {
      const store = storeRef.current;
      if (!store) return;

      isApplyingRemoteRef.current = true;
      store.mergeRemoteChanges(() => {
        // Put added + updated records
        const toPut = [...(diff.added ?? []), ...(diff.updated ?? [])];
        if (toPut.length > 0) store.put(toPut);

        // Remove deleted records
        if (diff.removed?.length > 0) store.remove(diff.removed);
      });
      isApplyingRemoteRef.current = false;
    } catch (e) {
      isApplyingRemoteRef.current = false;
      console.error("Whiteboard decrypt/apply error", e);
    }
  }, []);

  // ── 4. Expose applyRemoteUpdate so page.jsx can call it ──────────
  useEffect(() => {
    if (ydocRef.current) {
      // Store the handler on the ydoc so page.jsx can access it
      ydocRef.current._whiteboardApply = applyRemoteUpdate;
    }
    return () => {
      if (ydocRef.current) {
        delete ydocRef.current._whiteboardApply;
      }
    };
  }, [applyRemoteUpdate, ydocRef]);

  // ── 5. Render ────────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative">
      <Tldraw
        store={storeRef.current}
        onMount={(editor) => {
          // Set user color from awareness if available
          editor.user.updateUserPreferences({
            colorScheme: "light",
          });
        }}
      />

      {/* Peer cursors on canvas — from awareness */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {users
          .filter(u => !u.isLocal && u.canvasCursor)
          .map(u => (
            <div
              key={u.clientId}
              className="absolute transition-all duration-75"
              style={{ left: u.canvasCursor.x, top: u.canvasCursor.y }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 2l12 7-6.5 1.5L8 17z"
                  fill={u.color ?? "#a78bfa"}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="absolute top-5 left-4 text-xs font-bold px-2 py-0.5 rounded-full shadow whitespace-nowrap text-white"
                style={{ background: u.color ?? "#a78bfa" }}
              >
                {u.name ?? u.role}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
);