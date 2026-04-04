import { Monitor, PenLine, FileText } from "lucide-react";

const tabs = [
  { id: "video",      label: "Video", Icon: Monitor,  ac: "#a5b4fc", ab: "rgba(92,111,224,0.18)" },
  { id: "whiteboard", label: "Board", Icon: PenLine,   ac: "#5eead4", ab: "rgba(20,184,196,0.15)" },
  { id: "docs",       label: "Docs",  Icon: FileText,  ac: "#fcd34d", ab: "rgba(245,158,11,0.13)" },
];

const ViewSwitcher = ({ view, setView }) => (
  <div style={{
    display: "flex", borderRadius: "10px", overflow: "hidden",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
  }}>
    {tabs.map(({ id, label, Icon, ac, ab }) => {
      const active = view === id;
      return (
        <button key={id} onClick={() => setView(id)} style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "7px 13px", border: "none", cursor: "pointer",
          fontSize: "11px", fontWeight: "700",
          fontFamily: "'Syne', sans-serif", letterSpacing: "-0.01em",
          background: active ? ab : "transparent",
          color: active ? ac : "#2e3b5e",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          transition: "all 0.15s",
        }}>
          <Icon style={{ width: "13px", height: "13px" }} />
          {label}
        </button>
      );
    })}
  </div>
);

export default ViewSwitcher;