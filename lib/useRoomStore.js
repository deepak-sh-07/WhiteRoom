/**
 * useRoomStore.js
 * ---------------
 * Global Yjs-backed room store synced across all peers via y-webrtc.
 * Exposes reactive state + helpers for chat, room metadata, and shared objects.
 *
 * Usage:
 *   const { chat, roomMeta, addMessage, setMeta, connected } = useRoomStore(roomId);
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

/**
 * Optional: pass signalingServers to override defaults.
 * y-webrtc uses public wss://signaling.yjs.dev by default.
 * For production, host your own: https://github.com/yjs/y-webrtc
 */
const DEFAULT_SIGNALING = ["wss://signaling.yjs.dev"];

export function useRoomStore(roomId, { signalingServers = DEFAULT_SIGNALING } = {}) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);

  // ── Reactive state ──────────────────────────────────────────────
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [chat, setChat] = useState([]);          // Y.Array<ChatMessage>
  const [roomMeta, setRoomMetaState] = useState({}); // Y.Map<string, any>
  const [sharedState, setSharedState] = useState({}); // Y.Map – general KV store

  useEffect(() => {
    if (!roomId) return;

    // ── 1. Create the Y.Doc ──────────────────────────────────────
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // ── 2. Shared data structures ────────────────────────────────
    const ychat    = ydoc.getArray("chat");          // append-only message log
    const ymeta    = ydoc.getMap("room-meta");        // room name, created-at, etc.
    const ystate   = ydoc.getMap("room-state");       // arbitrary shared KV

    // ── 3. Connect via y-webrtc ──────────────────────────────────
    //    Room name = roomId  → only peers in the same room sync.
    //    password  = roomId  → basic signaling-level room isolation
    //    (layer your own AES encryption on top for true E2E)
    const provider = new WebrtcProvider(roomId, ydoc, {
      signaling: signalingServers,
      password: roomId,           // prevents cross-room data leakage on shared signal server
      maxConns: 20,
      filterBcConns: true,        // skip peers in the same browser tab (dev comfort)
    });
    providerRef.current = provider;

    // ── 4. Connection lifecycle ──────────────────────────────────
    provider.on("status", ({ connected: c }) => setConnected(c));
    provider.on("synced", ({ synced: s }) => setSynced(s));

    // ── 5. Observe Yjs shared structures → update React state ────
    const chatObserver = () => setChat(ychat.toArray());
    const metaObserver = () => setRoomMetaState(Object.fromEntries(ymeta.entries()));
    const stateObserver = () => setSharedState(Object.fromEntries(ystate.entries()));

    ychat.observe(chatObserver);
    ymeta.observe(metaObserver);
    ystate.observe(stateObserver);

    // seed initial state
    setChat(ychat.toArray());
    setRoomMetaState(Object.fromEntries(ymeta.entries()));
    setSharedState(Object.fromEntries(ystate.entries()));

    return () => {
      ychat.unobserve(chatObserver);
      ymeta.unobserve(metaObserver);
      ystate.unobserve(stateObserver);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
    };
  }, [roomId]);

  // ── Mutation helpers ─────────────────────────────────────────────

  /** Append a chat message. Automatically merged/ordered by all peers. */
  const addMessage = useCallback((text, sender) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    ydoc.getArray("chat").push([{
      id: crypto.randomUUID(),
      text,
      sender,
      timestamp: Date.now(),
    }]);
  }, []);

  /** Set a key on the shared room-meta map (e.g. room name, topic). */
  const setMeta = useCallback((key, value) => {
    ydocRef.current?.getMap("room-meta").set(key, value);
  }, []);

  /** Set a key on the general shared-state map. */
  const setState = useCallback((key, value) => {
    ydocRef.current?.getMap("room-state").set(key, value);
  }, []);

  /** Delete a key from shared state. */
  const deleteState = useCallback((key) => {
    ydocRef.current?.getMap("room-state").delete(key);
  }, []);

  /**
   * Transactional batch update — all changes appear atomically to peers.
   * cb receives { ychat, ymeta, ystate, ydoc }.
   */
  const transaction = useCallback((cb) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    ydoc.transact(() => {
      cb({
        ydoc,
        ychat:  ydoc.getArray("chat"),
        ymeta:  ydoc.getMap("room-meta"),
        ystate: ydoc.getMap("room-state"),
      });
    });
  }, []);

  return {
    // ── state ──
    connected,
    synced,
    chat,
    roomMeta,
    sharedState,

    // ── helpers ──
    addMessage,
    setMeta,
    setState,
    deleteState,
    transaction,

    // ── escape hatch ──
    ydoc: ydocRef,
    provider: providerRef,
  };
}