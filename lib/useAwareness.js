/**
 * useAwareness.js
 * ---------------
 * Reactive Yjs Awareness hook.
 * Tracks per-peer ephemeral state: cursor position, user name/color, status.
 *
 * Works with y-webrtc's built-in awareness protocol — no extra server needed.
 *
 * Usage:
 *   const { users, localUser, setLocalUser, setCursor } = useAwareness(providerRef);
 */

import { useEffect, useState, useCallback, useRef } from "react";

/** Generate a deterministic color from a string (username / socket id). */
function stringToColor(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 55%)`;
}

/**
 * @param {React.MutableRefObject} providerRef  – ref from useRoomStore
 * @param {object} initialUser  – { name, role, color? }
 */
export function useAwareness(providerRef, initialUser = {}) {
  const [users, setUsers] = useState([]);
  const [localClientId, setLocalClientId] = useState(null);
  const pendingRef = useRef(initialUser); // cache initial user until provider is ready

  // ── subscribe to awareness changes ───────────────────────────────
  useEffect(() => {
    let awareness = null;

    const attach = () => {
      if (!providerRef.current) return;
      awareness = providerRef.current.awareness;
      setLocalClientId(awareness.clientID);

      // Apply any pending local state
      awareness.setLocalState({
        user: {
          name:   pendingRef.current.name  ?? "Anonymous",
          role:   pendingRef.current.role  ?? "guest",
          color:  pendingRef.current.color ?? stringToColor(pendingRef.current.name ?? String(awareness.clientID)),
        },
        cursor: null,
        status: "online",
      });

      const onChange = () => {
        const states = Array.from(awareness.getStates().entries()).map(
          ([clientId, state]) => ({
            clientId,
            isLocal: clientId === awareness.clientID,
            ...state,
          })
        );
        setUsers(states);
      };

      awareness.on("change", onChange);
      onChange(); // seed immediately

      return () => awareness.off("change", onChange);
    };

    // Provider may not exist on first render; poll briefly
    if (providerRef.current) {
      const cleanup = attach();
      return cleanup;
    } else {
      const id = setInterval(() => {
        if (providerRef.current) {
          clearInterval(id);
          attach();
        }
      }, 50);
      return () => clearInterval(id);
    }
  }, [providerRef]);

  // ── mutation helpers ─────────────────────────────────────────────

  /** Update your own user metadata (name, role, color…). */
  const setLocalUser = useCallback((patch) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    const awareness = providerRef.current?.awareness;
    if (!awareness) return;
    const current = awareness.getLocalState() ?? {};
    awareness.setLocalState({
      ...current,
      user: { ...current.user, ...patch },
    });
  }, [providerRef]);

  /**
   * Broadcast your cursor position.
   * @param {{ x: number, y: number } | null} position
   */
  const setCursor = useCallback((position) => {
    const awareness = providerRef.current?.awareness;
    if (!awareness) return;
    const current = awareness.getLocalState() ?? {};
    awareness.setLocalState({ ...current, cursor: position });
  }, [providerRef]);

  /** Set your connection status ("online" | "away" | "busy"). */
  const setStatus = useCallback((status) => {
    const awareness = providerRef.current?.awareness;
    if (!awareness) return;
    const current = awareness.getLocalState() ?? {};
    awareness.setLocalState({ ...current, status });
  }, [providerRef]);

  /** Clear local awareness state (call on disconnect / unmount). */
  const clearLocalState = useCallback(() => {
    providerRef.current?.awareness.setLocalState(null);
  }, [providerRef]);

  // ── derived helpers ──────────────────────────────────────────────
  const localUser  = users.find(u => u.isLocal) ?? null;
  const remoteUsers = users.filter(u => !u.isLocal);
  const onlineCount = users.length;

  return {
    users,           // all peers (including self)
    localUser,       // your own awareness state
    remoteUsers,     // other peers only
    onlineCount,
    localClientId,
    setLocalUser,
    setCursor,
    setStatus,
    clearLocalState,
    stringToColor,   // export util so callers can stay consistent
  };
}