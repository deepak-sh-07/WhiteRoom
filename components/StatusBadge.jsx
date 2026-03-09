"use client";

const StatusBadge = ({ connected }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: "6px",
    padding: "6px 12px", borderRadius: "8px",
    background: connected ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
    border: "1px solid " + (connected ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"),
  }}>
    {/* Pulsing dot */}
    <div style={{ position: "relative", width: "8px", height: "8px", flexShrink: 0 }}>
      {connected && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "#10b981", opacity: 0.4,
          animation: "ping 1.5s cubic-bezier(0,0,.2,1) infinite",
        }} />
      )}
      <div style={{
        position: "absolute", inset: "1px",
        borderRadius: "50%",
        background: connected ? "#10b981" : "#ef4444",
        boxShadow: connected ? "0 0 6px #10b981" : "none",
      }} />
    </div>
    <span style={{ fontSize: "12px", fontWeight: "600", color: connected ? "#10b981" : "#ef4444" }}>
      {connected ? "Live" : "Offline"}
    </span>
    <style>{`
      @keyframes ping {
        75%, 100% { transform: scale(2); opacity: 0; }
      }
    `}</style>
  </div>
);

export default StatusBadge;