"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Plus, Hash, Lock, Users, Zap } from "lucide-react";

export default function Home() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const check = async () => {
    const res = await fetch("/api/me", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (res.status !== 200) {
      router.push("/login");
      return;
    }
    setUserId(data.userId);
    setLoading(false);
  };

  useEffect(() => { check(); }, []);

  if (loading) return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0e1a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "20px", height: "20px", borderRadius: "50%",
        border: "2px solid rgba(99,102,241,0.2)",
        borderTopColor: "#6366f1",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0e1a 100%)",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: "#e2e8f0",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 50% at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(20,184,166,0.06) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 1,
        padding: "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(99,102,241,0.1)",
        background: "rgba(10,10,15,0.6)", backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #14b8a6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(99,102,241,0.35)",
          }}>
            <Video style={{ width: "16px", height: "16px", color: "white" }} />
          </div>
          <span style={{ fontSize: "16px", fontWeight: "800", color: "#f1f5f9", letterSpacing: "-0.02em" }}>
            WhiteRoom
          </span>
        </div>

        {/* User badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "6px 12px", borderRadius: "10px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{
            width: "24px", height: "24px", borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "11px", fontWeight: "700", color: "white",
          }}>
            {userId?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <span style={{ fontSize: "12px", fontWeight: "500", color: "#64748b", fontFamily: "monospace" }}>
            {userId ? `${userId.slice(0, 8)}...` : "—"}
          </span>
        </div>
      </nav>

      {/* Content */}
      <main style={{
        position: "relative", zIndex: 1,
        maxWidth: "680px", margin: "0 auto",
        padding: "60px 24px",
      }}>
        {/* Hero */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "5px 12px", borderRadius: "20px", marginBottom: "20px",
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <Zap style={{ width: "11px", height: "11px", color: "#818cf8" }} />
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#818cf8", letterSpacing: "0.04em" }}>
              END-TO-END ENCRYPTED
            </span>
          </div>
          <h1 style={{
            fontSize: "38px", fontWeight: "900", color: "#f1f5f9",
            margin: "0 0 12px", letterSpacing: "-0.04em", lineHeight: 1.1,
          }}>
            Your rooms,<br />
            <span style={{ background: "linear-gradient(135deg, #6366f1, #14b8a6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              your call.
            </span>
          </h1>
          <p style={{ fontSize: "15px", color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: "400px" }}>
            Create a private encrypted room or join one. No accounts, no tracking — just secure collaboration.
          </p>
        </div>

        {/* Action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "40px" }}>
          {/* Create */}
          <button
            onClick={() => router.push("/create")}
            style={{
              padding: "28px 24px", borderRadius: "18px", border: "none", cursor: "pointer", textAlign: "left",
              background: "rgba(13,15,23,0.9)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(99,102,241,0.2)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              transition: "all 0.2s", fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.45)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.5), 0 0 24px rgba(99,102,241,0.12)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)";
            }}
          >
            <div style={{
              width: "42px", height: "42px", borderRadius: "12px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "16px",
              boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
            }}>
              <Plus style={{ width: "20px", height: "20px", color: "white" }} />
            </div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "#f1f5f9", marginBottom: "6px", letterSpacing: "-0.02em" }}>
              Create Room
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.4 }}>
              Start a new encrypted session and invite others
            </div>
          </button>

          {/* Join */}
          <button
            onClick={() => router.push("/join")}
            style={{
              padding: "28px 24px", borderRadius: "18px", border: "none", cursor: "pointer", textAlign: "left",
              background: "rgba(13,15,23,0.9)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(20,184,166,0.2)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              transition: "all 0.2s", fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "rgba(20,184,166,0.45)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.5), 0 0 24px rgba(20,184,166,0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)";
            }}
          >
            <div style={{
              width: "42px", height: "42px", borderRadius: "12px",
              background: "linear-gradient(135deg, #14b8a6, #0d9488)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "16px",
              boxShadow: "0 4px 16px rgba(20,184,166,0.3)",
            }}>
              <Hash style={{ width: "20px", height: "20px", color: "white" }} />
            </div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "#f1f5f9", marginBottom: "6px", letterSpacing: "-0.02em" }}>
              Join Room
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.4 }}>
              Enter a room code to join an existing session
            </div>
          </button>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {[
            { icon: Lock, label: "AES Encrypted Chat" },
            { icon: Video, label: "WebRTC Video" },
            { icon: Users, label: "Multi-user Rooms" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "20px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <Icon style={{ width: "12px", height: "12px", color: "#475569" }} />
              <span style={{ fontSize: "12px", color: "#475569", fontWeight: "500" }}>{label}</span>
            </div>
          ))}
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}