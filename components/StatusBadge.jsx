"use client";

const StatusBadge = ({ connected }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: "6px",
    padding: "5px 11px", borderRadius: "8px",
    background: connected ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)",
    border: "1px solid " + (connected ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)"),
  }}>
    <div style={{ position: "relative", width: "7px", height: "7px", flexShrink: 0 }}>
      {connected && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "#10b981", opacity: 0.35,
          animation: "sb-ping 1.8s cubic-bezier(0,0,.2,1) infinite",
        }} />
      )}
      <div style={{
        position: "absolute", inset: "1px", borderRadius: "50%",
        background: connected ? "#10b981" : "#ef4444",
        boxShadow: connected ? "0 0 5px rgba(16,185,129,.65)" : "none",
      }} />
    </div>
    <span style={{
      fontSize: "11px", fontWeight: "600",
      color: connected ? "#10b981" : "#ef4444",
      fontFamily: "'Spline Sans Mono','JetBrains Mono',monospace",
      letterSpacing: "0.04em",
    }}>
      {connected ? "LIVE" : "OFFLINE"}
    </span>
    <style>{`@keyframes sb-ping{75%,100%{transform:scale(2.4);opacity:0;}}`}</style>
  </div>
);

export default StatusBadge;