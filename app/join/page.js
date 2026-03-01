"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Video, ArrowRight, Lock, Hash } from "lucide-react";

export default function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoin = async () => {
    if (!roomId.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (res.status === 200) router.push(`/room/${roomId}`);
      else if (res.status === 404) setError("Room not found. Check the code and try again.");
      else setError("Invalid room code.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleJoin();
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
        background: "radial-gradient(ellipse 70% 60% at 70% 30%, rgba(20,184,166,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 25% 75%, rgba(99,102,241,0.07) 0%, transparent 60%)",
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
        border: "1px solid rgba(20,184,166,0.2)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)",
        padding: "40px 36px",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "14px",
            background: "linear-gradient(135deg, #14b8a6, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px rgba(20,184,166,0.4)",
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
            Join a room
          </h2>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
            Enter the room code shared with you to join the session.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
            Room Code
          </label>
          <div style={{ position: "relative" }}>
            <Hash style={{
              position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
              width: "15px", height: "15px", color: "#334155", pointerEvents: "none",
            }} />
            <input
              type="text"
              placeholder="e.g. team-standup-01"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%", padding: "11px 14px 11px 34px", borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#e2e8f0", fontSize: "14px", outline: "none",
                fontFamily: "monospace", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(20,184,166,0.5)"}
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

        {/* Button */}
        <button
          onClick={handleJoin}
          disabled={loading || !roomId.trim()}
          style={{
            width: "100%", padding: "13px 20px", borderRadius: "12px", border: "none",
            background: (loading || !roomId.trim()) ? "rgba(20,184,166,0.2)" : "linear-gradient(135deg, #14b8a6, #0d9488)",
            color: (loading || !roomId.trim()) ? "#475569" : "white",
            fontSize: "14px", fontWeight: "700",
            cursor: (loading || !roomId.trim()) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            boxShadow: (loading || !roomId.trim()) ? "none" : "0 8px 24px rgba(20,184,166,0.3)",
            transition: "all 0.2s",
            fontFamily: "inherit",
            letterSpacing: "-0.01em",
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: "16px", height: "16px", borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "white",
                animation: "spin 0.8s linear infinite",
              }} />
              Joining...
            </>
          ) : (
            <>
              Join Room
              <ArrowRight style={{ width: "16px", height: "16px" }} />
            </>
          )}
        </button>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <a href="/create" style={{
            fontSize: "12px", color: "#475569", textDecoration: "none",
            borderBottom: "1px solid rgba(71,85,105,0.4)", paddingBottom: "1px",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => e.target.style.color = "#94a3b8"}
          onMouseLeave={e => e.target.style.color = "#475569"}
          >
            ← Create a new room instead
          </a>
        </div>

        {/* Encrypted note */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "16px" }}>
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