/**
 * RoomContext.jsx
 * ---------------
 * Single provider that initialises Yjs, y-webrtc, and awareness.
 * Wrap your room page with <RoomProvider roomId="..." user={...}>.
 * Consume with useRoom() anywhere in the tree.
 *
 * Example:
 *   <RoomProvider roomId={params.roomId} user={{ name: "Alice", role: "host" }}>
 *     <Room />
 *   </RoomProvider>
 */

"use client";

import { createContext, useContext, useEffect } from "react";
import { useRoomStore } from "./useRoomStore";
import { useAwareness } from "./useAwareness";

const RoomContext = createContext(null);

export function RoomProvider({ roomId, user = {}, children }) {
  const store = useRoomStore(roomId);

  const awareness = useAwareness(store.provider, {
    name:  user.name  ?? "Anonymous",
    role:  user.role  ?? "guest",
    color: user.color,
  });

  // Sync role/name changes into awareness automatically
  useEffect(() => {
    if (user.name || user.role) {
      awareness.setLocalUser({
        name:  user.name,
        role:  user.role,
        color: user.color,
      });
    }
  }, [user.name, user.role, user.color]);

  // Seed room-meta once on first connection
  useEffect(() => {
    if (store.synced && !store.roomMeta.createdAt) {
      store.setMeta("createdAt", Date.now());
      store.setMeta("roomId", roomId);
    }
  }, [store.synced]);

  const value = {
    roomId,
    // ── store ──
    connected:   store.connected,
    synced:      store.synced,
    chat:        store.chat,
    roomMeta:    store.roomMeta,
    sharedState: store.sharedState,
    addMessage:  store.addMessage,
    setMeta:     store.setMeta,
    setState:    store.setState,
    deleteState: store.deleteState,
    transaction: store.transaction,
    ydoc:        store.ydoc,
    provider:    store.provider,
    // ── awareness ──
    users:          awareness.users,
    localUser:      awareness.localUser,
    remoteUsers:    awareness.remoteUsers,
    onlineCount:    awareness.onlineCount,
    setLocalUser:   awareness.setLocalUser,
    setCursor:      awareness.setCursor,
    setStatus:      awareness.setStatus,
    clearLocalState:awareness.clearLocalState,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

/** Consume the room context anywhere inside <RoomProvider>. */
export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside <RoomProvider>");
  return ctx;
}