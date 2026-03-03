import { useState } from "react";
import { MessageSquare, Minimize2, X, Users, Send, Lock } from "lucide-react";

const ChatPanel = ({ isOpen, onClose, messages, users, role, onSend }) => {
  const [msg, setMsg]               = useState("");
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSend = () => {
    if (!msg.trim()) return;
    onSend(msg.trim());
    setMsg("");
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 50 }}>

      {/* ── Minimized bubble ── */}
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            position: "relative",
            width: "52px",
            height: "52px",
            borderRadius: "16px",
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            border: "1px solid rgba(99,102,241,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(99,102,241,.35)",
            color: "white",
          }}
        >
          <MessageSquare style={{ width: "20px", height: "20px" }} />
          {messages.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "#14b8a6",
                color: "white",
                fontSize: "10px",
                fontWeight: "700",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #0a0a0f",
              }}
            >
              {messages.length}
            </span>
          )}
        </button>

      ) : (

        /* ── Expanded panel ── */
        <div
          style={{
            width: "360px",
            height: "580px",
            background: "rgba(13,15,23,.95)",
            backdropFilter: "blur(24px)",
            borderRadius: "20px",
            border: "1px solid rgba(99,102,241,.2)",
            boxShadow: "0 24px 64px rgba(0,0,0,.6)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >

          {/* Header */}
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid rgba(255,255,255,.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(99,102,241,.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquare style={{ width: "14px", height: "14px", color: "white" }} />
              </div>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#f1f5f9" }}>Messages</span>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={() => setIsMinimized(true)}
                style={{ width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "rgba(255,255,255,.06)", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Minimize2 style={{ width: "14px", height: "14px" }} />
              </button>
              <button
                onClick={onClose}
                style={{ width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "rgba(255,255,255,.06)", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          </div>

          {/* Users strip */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,.05)", background: "rgba(255,255,255,.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <Users style={{ width: "14px", height: "14px", color: "#475569" }} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#475569", textTransform: "uppercase", letterSpacing: ".06em" }}>In Room</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#6366f1",
                  background: "rgba(99,102,241,.15)",
                  padding: "1px 8px",
                  borderRadius: "10px",
                  border: "1px solid rgba(99,102,241,.2)",
                }}
              >
                {users.length}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {users.map((u, i) => (
                <div
                  key={u.clientId ?? i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.07)",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "6px",
                      background: u.color ?? "#6366f1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "white",
                    }}
                  >
                    {(u.role ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#94a3b8" }}>
                    {u.role}{u.isLocal ? " (you)" : ""}
                  </span>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 4px #10b981" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px", opacity: 0.4 }}>
                <MessageSquare style={{ width: "32px", height: "32px", color: "#475569" }} />
                <span style={{ fontSize: "12px", color: "#475569" }}>No messages yet</span>
              </div>
            )}
            {messages.map((m, i) => {
              const isMine = m.sender === role;
              return (
                <div key={i} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "8px 12px",
                      borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: isMine ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "rgba(255,255,255,.06)",
                      border: isMine ? "none" : "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: isMine ? "rgba(255,255,255,.7)" : "#6366f1" }}>
                        {m.sender}
                      </span>
                      <span style={{ fontSize: "10px", color: isMine ? "rgba(255,255,255,.4)" : "#475569" }}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", margin: 0, color: isMine ? "white" : "#e2e8f0", lineHeight: 1.4 }}>
                      {m.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.02)" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message…"
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.09)",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim()}
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  border: "none",
                  background: msg.trim() ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "rgba(255,255,255,.05)",
                  color: msg.trim() ? "white" : "#475569",
                  cursor: msg.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "8px" }}>
              <Lock style={{ width: "12px", height: "12px", color: "#10b981" }} />
              <span style={{ fontSize: "10px", color: "#475569" }}>End-to-end encrypted</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default ChatPanel;