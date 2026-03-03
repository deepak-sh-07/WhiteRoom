import { Monitor, PenLine, FileText } from "lucide-react";

const tabs = [
  { id: "video",      label: "Video", Icon: Monitor,  activeColor: "#818cf8", activeBg: "rgba(99,102,241,.25)" },
  { id: "whiteboard", label: "Board", Icon: PenLine,   activeColor: "#14b8a6", activeBg: "rgba(20,184,166,.2)"  },
  { id: "docs",       label: "Docs",  Icon: FileText,  activeColor: "#c9a84c", activeBg: "rgba(201,168,76,.2)"  },
];

const ViewSwitcher = ({ view, setView }) => (
  <div
    style={{
      display: "flex",
      borderRadius: "10px",
      overflow: "hidden",
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(255,255,255,.08)",
    }}
  >
    {tabs.map(({ id, label, Icon, activeColor, activeBg }) => {
      const active = view === id;
      return (
        <button
          key={id}
          onClick={() => setView(id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600",
            background: active ? activeBg : "transparent",
            color: active ? activeColor : "#64748b",
          }}
        >
          <Icon style={{ width: "14px", height: "14px" }} />
          {label}
        </button>
      );
    })}
  </div>
);

export default ViewSwitcher;