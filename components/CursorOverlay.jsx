
"use client";

import { useRoom } from "@/lib/RoomContext";

export function CursorOverlay() {
  const { remoteUsers } = useRoom();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-40">
      {remoteUsers.map((peer) => {
        if (!peer.cursor) return null;
        const { x, y } = peer.cursor;
        const color = peer.user?.color ?? "#a78bfa";
        const name  = peer.user?.name  ?? "Peer";

        return (
          <div
            key={peer.clientId}
            className="absolute transition-transform duration-75"
            style={{ left: x, top: y, transform: "translate(-4px, -4px)" }}
          >
            {/* SVG cursor */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 2l12 7-6.5 1.5L8 17z"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {/* Name label */}
            <span
              className="absolute top-5 left-4 text-xs font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap"
              style={{ background: color, color: "#fff" }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}