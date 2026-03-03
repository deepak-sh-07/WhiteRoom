const StatusBadge = ({ connected }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: "8px",
      background: connected ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
      border: "1px solid " + (connected ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"),
    }}
  >
    <div
      style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: connected ? "#10b981" : "#ef4444",
        boxShadow: connected ? "0 0 6px #10b981" : "none",
      }}
    />
    <span
      style={{
        fontSize: "12px",
        fontWeight: "600",
        color: connected ? "#10b981" : "#ef4444",
      }}
    >
      {connected ? "Live" : "Offline"}
    </span>
  </div>
);

export default StatusBadge;