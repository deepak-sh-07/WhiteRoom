"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Video, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room_code, setRoom_code] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createroom = async () => {
    if (!name.trim() || !room_code.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, room_code }),
      });
      setRoom_code("");
      if (res.status === 200) router.push(`/room/${room_code}`);
      else setError("Failed to create room. Try again.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") createroom();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0e1a 100%)",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 60% at 30% 30%, rgba(99,102,241,0.09) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 75% 75%, rgba(20,184,166,0.07) 0%, transparent 60%)",
      }} />

      {/* Subtle grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: "420px",
        margin: "0 20px",
        background: "rgba(13,15,23,0.9)",
        backdropFilter: "blur(32px)",
        borderRadius: "24px",
        border: "1px solid rgba(99,102,241,0.2)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)",
        padding: "40px 36px",
      }}>

        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "14px",
            background: "linear-gradient(135deg, #6366f1, #14b8a6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px rgba(99,102,241,0.4)",
          }}>
            <Video style={{ width: "20px", height: "20px", color: "white" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: "800", color: "#f1f5f9", margin: 0, letterSpacing: "-0.02em" }}>
              WhiteRoom
            </h1>
            <p style={{ fontSize: "11px", color: "#475569", margin: 0, fontWeight: "500" }}>
              Encrypted · Collaborative
            </p>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "26px", fontWeight: "800", color: "#f1f5f9", margin: "0 0 8px", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            Start a session
          </h2>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            Enter your name and a room code to create or join an encrypted room.
          </p>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
              Your Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#e2e8f0", fontSize: "14px", outline: "none",
                fontFamily: "inherit", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
              Room Code
            </label>
            <input
              type="text"
              placeholder="e.g. team-standup-01"
              value={room_code}
              onChange={(e) => setRoom_code(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#e2e8f0", fontSize: "14px", outline: "none",
                fontFamily: "inherit", boxSizing: "border-box",
                transition: "border-color 0.2s",
                fontFamily: "monospace",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: "10px", marginBottom: "14px",
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            fontSize: "13px", color: "#f87171",
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={createroom}
          disabled={loading}
          style={{
            width: "100%", padding: "13px 20px", borderRadius: "12px", border: "none",
            background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "white", fontSize: "14px", fontWeight: "700",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            boxShadow: loading ? "none" : "0 8px 24px rgba(99,102,241,0.35)",
            transition: "all 0.2s",
            fontFamily: "inherit",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={e => { if (!loading) e.target.style.boxShadow = "0 12px 32px rgba(99,102,241,0.5)"; }}
          onMouseLeave={e => { if (!loading) e.target.style.boxShadow = "0 8px 24px rgba(99,102,241,0.35)"; }}
        >
          {loading ? (
            <>
              <div style={{
                width: "16px", height: "16px", borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "white",
                animation: "spin 0.8s linear infinite",
              }} />
              Connecting...
            </>
          ) : (
            <>
              Enter Room
              <ArrowRight style={{ width: "16px", height: "16px" }} />
            </>
          )}
        </button>

        {/* Footer note */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "20px" }}>
          <Lock style={{ width: "12px", height: "12px", color: "#10b981" }} />
          <span style={{ fontSize: "11px", color: "#475569" }}>
            All sessions are end-to-end encrypted
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: #334155;
        }
      `}</style>
    </div>
  );
}