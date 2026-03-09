"use client";

import { useState, useEffect } from "react";
import { Users, X, Wifi, WifiOff, Clock, AlertTriangle } from "lucide-react";

// ── Format last active timestamp ──────────────────────────────────
function useTimeAgo(timestamp) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!timestamp) { setLabel("—"); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - timestamp) / 1000);
      if (diff < 10)       { setLabel("just now"); return; }
      if (diff < 60)       { setLabel(`${diff}s ago`); return; }
      const m = Math.floor(diff / 60);
      if (m < 60)          { setLabel(`${m}m ago`); return; }
      setLabel(`${Math.floor(m / 60)}h ago`);
    };
    update();
    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return label;
}

// ── Connection health from WebRTC connectionState ─────────────────
function getHealth(state) {
  switch (state) {
    case "connected":     return { label: "connected",    color: "#10b981", icon: "good" };
    case "connecting":    return { label: "connecting…",  color: "#f59e0b", icon: "warn" };
    case "disconnected":  return { label: "disconnected", color: "#f59e0b", icon: "warn" };
    case "failed":        return { label: "failed",       color: "#ef4444", icon: "bad"  };
    case "closed":        return { label: "closed",       color: "#475569", icon: "bad"  };
    default:              return { label: "—",            color: "#334155", icon: "none" };
  }
}

function HealthIcon({ icon, color }) {
  const sz = { width: "10px", height: "10px", color };
  if (icon === "good") return <Wifi style={sz} />;
  if (icon === "warn") return <AlertTriangle style={sz} />;
  if (icon === "bad")  return <WifiOff style={sz} />;
  return null;
}

// ── Single user row ───────────────────────────────────────────────
function UserRow({ user, connectionState }) {
  const timeAgo  = useTimeAgo(user.lastActive);
  const isActive = user.lastActive && Date.now() - user.lastActive < 60_000;
  const health   = user.isLocal ? null : getHealth(connectionState);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 12px", borderRadius: "10px",
      background: user.isLocal ? "rgba(99,102,241,.07)" : "rgba(255,255,255,.02)",
      border: `1px solid ${user.isLocal ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.05)"}`,
    }}>

      {/* Avatar + online dot */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: user.color ?? "#6366f1",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "14px", fontWeight: "800", color: "#0c0b09",
          boxShadow: `0 0 0 2px ${user.isLocal ? "rgba(99,102,241,.4)" : "transparent"}`,
        }}>
          {(user.name ?? user.role ?? "?").charAt(0).toUpperCase()}
        </div>
        <div style={{
          position: "absolute", bottom: "-2px", right: "-2px",
          width: "10px", height: "10px", borderRadius: "50%",
          background: isActive ? "#10b981" : "#475569",
          border: "2px solid #0e0d0b",
          boxShadow: isActive ? "0 0 6px rgba(16,185,129,.5)" : "none",
          transition: "all .3s",
        }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "12px", fontWeight: "700",
          color: user.isLocal ? "#818cf8" : "#e2e8f0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          {user.name ?? user.role ?? "Unknown"}
          {user.isLocal && (
            <span style={{ fontSize: "10px", fontWeight: "600", color: "#6366f1" }}>you</span>
          )}
        </div>

        {/* Role + last active */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", flexWrap: "wrap" }}>
          <span style={{
            fontSize: "10px", fontWeight: "600", textTransform: "capitalize",
            color: user.role === "host" ? "#c9a84c" : "#475569",
          }}>
            {user.role}
          </span>
          {!user.isLocal && (
            <>
              <span style={{ color: "#1e293b", fontSize: "10px" }}>·</span>
              <Clock style={{ width: "9px", height: "9px", color: "#334155" }} />
              <span style={{ fontSize: "10px", color: "#334155", fontFamily: "'DM Mono', monospace" }}>
                {timeAgo}
              </span>
            </>
          )}
        </div>

        {/* Connection health — only for remote peers */}
        {health && (
          <div style={{
            display: "flex", alignItems: "center", gap: "4px", marginTop: "4px",
            padding: "2px 6px", borderRadius: "5px", width: "fit-content",
            background: `${health.color}14`,
            border: `1px solid ${health.color}30`,
          }}>
            <HealthIcon icon={health.icon} color={health.color} />
            <span style={{ fontSize: "10px", fontWeight: "600", color: health.color, fontFamily: "'DM Mono', monospace" }}>
              {health.label}
            </span>
          </div>
        )}
      </div>

      {/* Active badge */}
      <div style={{
        fontSize: "9px", fontWeight: "700", padding: "2px 6px",
        borderRadius: "4px", textTransform: "uppercase", letterSpacing: ".05em",
        background: isActive ? "rgba(16,185,129,.12)" : "rgba(71,85,105,.12)",
        color: isActive ? "#10b981" : "#475569",
        flexShrink: 0, alignSelf: "flex-start", marginTop: "2px",
      }}>
        {isActive ? "active" : "idle"}
      </div>
    </div>
  );
}

// ── Overall room health summary ───────────────────────────────────
function RoomHealthBar({ peerStates }) {
  const states = Object.values(peerStates);
  if (states.length === 0) return null;

  const allConnected   = states.every(s => s === "connected");
  const anyFailed      = states.some(s => s === "failed" || s === "closed");
  const anyConnecting  = states.some(s => s === "connecting" || s === "disconnected");

  const { color, label } = allConnected  ? { color: "#10b981", label: "All peers connected" }
                         : anyFailed     ? { color: "#ef4444", label: "Connection issues" }
                         : anyConnecting ? { color: "#f59e0b", label: "Connecting…" }
                         :                 { color: "#475569", label: "No peers" };

  return (
    <div style={{
      margin: "8px 10px 0",
      padding: "8px 12px",
      borderRadius: "8px",
      background: `${color}0d`,
      border: `1px solid ${color}25`,
      display: "flex", alignItems: "center", gap: "8px",
    }}>
      <div style={{
        width: "7px", height: "7px", borderRadius: "50%",
        background: color,
        boxShadow: allConnected ? `0 0 6px ${color}` : "none",
        flexShrink: 0,
      }} />
      <span style={{ fontSize: "11px", fontWeight: "600", color }}>{label}</span>
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────
export default function PresenceSidebar({ users = [], peerStates = {}, onClose }) {
  const onlineCount = users.filter(u =>
    u.lastActive && Date.now() - u.lastActive < 60_000
  ).length;

  const sorted = [...users].sort((a, b) => {
    if (a.isLocal) return -1;
    if (b.isLocal) return 1;
    return (b.lastActive ?? 0) - (a.lastActive ?? 0);
  });

  return (
    <div style={{
      width: "224px", flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "rgba(10,10,15,.97)",
      borderLeft: "1px solid rgba(99,102,241,.12)",
      backdropFilter: "blur(16px)",
    }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.06)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <Users style={{ width: "13px", height: "13px", color: "#10b981" }} />
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#e2e8f0" }}>Participants</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "4px",
            padding: "2px 7px", borderRadius: "6px",
            background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)",
          }}>
            <Wifi style={{ width: "9px", height: "9px", color: "#10b981" }} />
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#10b981" }}>{onlineCount}</span>
          </div>
          <button onClick={onClose} style={{
            width: "20px", height: "20px", borderRadius: "6px", border: "none",
            background: "transparent", color: "#334155", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.color = "#94a3b8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#334155"; }}
          >
            <X style={{ width: "12px", height: "12px" }} />
          </button>
        </div>
      </div>

      {/* Room health summary */}
      <RoomHealthBar peerStates={peerStates} />

      {/* User list */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "10px",
        display: "flex", flexDirection: "column", gap: "6px",
      }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: "#1e293b", fontSize: "11px", marginTop: "20px" }}>
            No participants yet
          </div>
        ) : (
          sorted.map(u => (
            <UserRow
              key={u.clientId}
              user={u}
              connectionState={peerStates[u.clientId]}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,.05)",
        fontSize: "10px", color: "#1e293b", fontFamily: "'DM Mono', monospace",
        flexShrink: 0,
      }}>
        {users.length} participant{users.length !== 1 ? "s" : ""} · {onlineCount} active
      </div>
    </div>
  );
}