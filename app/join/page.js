"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Hash, Lock, Shield, Zap, Users } from "lucide-react";
import ParticleCanvas from "@/components/ParticleCanvas";

const C = {
  indigo: "#7C8FFF",
  teal: "#4DD9DC",
  text: "rgba(255,255,255,0.90)",
  muted: "rgba(255,255,255,0.38)",
  hint: "rgba(255,255,255,0.18)",
  cardBg: "rgba(255,255,255,0.045)",
  cardBorder: "rgba(255,255,255,0.08)",
  inputBg: "rgba(255,255,255,0.05)",
  inputBorder: "rgba(255,255,255,0.10)",
};

const labelStyle = {
  display: "block",
  fontSize: 10,
  fontFamily: "ui-monospace,monospace",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.38)",
  marginBottom: 8,
};

function Input({ placeholder, value, onChange, onKeyDown, icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      {icon && (
        <div style={{
          position: "absolute", left: 14, top: "50%",
          transform: "translateY(-50%)", pointerEvents: "none",
          color: focused ? C.teal : "rgba(255,255,255,0.22)",
          transition: "color 0.2s", display: "flex",
        }}>
          {icon}
        </div>
      )}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          background: focused ? "rgba(255,255,255,0.07)" : C.inputBg,
          border: `1px solid ${focused ? "rgba(77,217,220,0.55)" : C.inputBorder}`,
          borderRadius: 13,
          padding: icon ? "14px 18px 14px 40px" : "14px 18px",
          color: C.text,
          fontSize: 14,
          fontFamily: "ui-monospace,monospace",
          outline: "none",
          boxSizing: "border-box",
          transition: "all 0.2s",
          boxShadow: focused ? "0 0 0 3px rgba(77,217,220,0.09)" : "none",
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

const features = [
  {
    icon: <Shield size={15} />,
    label: "Zero-knowledge encryption",
    desc: "Your messages are encrypted before they leave your device. Not even we can read them.",
  },
  {
    icon: <Zap size={15} />,
    label: "Instant connection",
    desc: "Rooms are live the moment you join — no waiting, no setup, no installs needed.",
  },
  {
    icon: <Users size={15} />,
    label: "Up to 50 participants",
    desc: "Invite your whole team into one secure encrypted session with no performance hit.",
  },
];

const stats = [
  { val: "256", lbl: "AES-bit" },
  { val: "0", lbl: "Logs stored" },
  { val: "50", lbl: "Max users" },
];

const panelStyle = {
  borderRadius: 22,
  background: C.cardBg,
  border: `1px solid ${C.cardBorder}`,
  backdropFilter: "blur(32px)",
  WebkitBackdropFilter: "blur(32px)",
  padding: "40px 40px 36px",
  position: "relative",
  overflow: "hidden",
};

const shimmer = {
  position: "absolute",
  top: 0, left: "8%", right: "8%",
  height: 1,
  background: "linear-gradient(90deg,transparent,rgba(77,217,220,0.9),rgba(124,143,255,0.9),transparent)",
};

export default function JoinRoom() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  const handleJoin = async () => {
    if (!roomId.trim()) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (res.status === 200) router.push(`/room/${roomId}`);
      else if (res.status === 404) setError("Room not found. Check the code and try again.");
      else setError("Invalid room code.");
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const isDisabled = loading || !roomId.trim();

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 140% 70% at 50% -10%, rgba(20,140,160,0.18) 0%, transparent 60%), hsl(230,60%,3%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative", padding: "40px 24px",
    }}>
      <ParticleCanvas />

      {/* Orbs */}
      <div style={{ position: "fixed", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "hsl(182,70%,38%)", opacity: 0.13, filter: "blur(130px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "hsl(231,65%,50%)", opacity: 0.09, filter: "blur(130px)", pointerEvents: "none", zIndex: 0 }} />

      {/* ✅ Logo — fixed top-left */}
      <div style={{
        position: "fixed",
        top: 28,
        left: 32,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#14b8c8,#3a8fc7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(20,184,196,0.45)" }}>
          <Lock size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>WhiteRoom</div>
          <div style={{ fontSize: 9, fontFamily: "ui-monospace,monospace", letterSpacing: "0.18em", color: C.hint, textTransform: "uppercase" }}>E2E Encrypted</div>
        </div>
      </div>

      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 980,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(28px)",
        transition: "opacity 0.75s cubic-bezier(.16,1,.3,1), transform 0.75s cubic-bezier(.16,1,.3,1)",
      }}>

        {/* Single-column centered grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 20,
          alignItems: "start",
          justifyItems: "center",
        }}>

          {/* ── Join Form ── */}
          <div style={{ ...panelStyle, width: "100%", maxWidth: 480 }}>
            <div style={shimmer} />

            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 20, marginBottom: 20, background: "rgba(77,217,220,0.10)", border: "1px solid rgba(77,217,220,0.22)" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal, boxShadow: `0 0 6px ${C.teal}`, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.teal, letterSpacing: "0.12em", fontFamily: "ui-monospace,monospace" }}>QUICK JOIN</span>
            </div>

            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 10 }}>
              Join a{" "}
              <span style={{ background: "linear-gradient(90deg,#4DD9DC,#7C8FFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                session.
              </span>
            </h1>
            <p style={{ fontSize: 13, fontFamily: "ui-monospace,monospace", color: C.muted, fontWeight: 300, marginBottom: 28, lineHeight: 1.8 }}>
              Enter the room code shared with you to join an end-to-end encrypted session instantly. No account required.
            </p>

            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 28 }} />

            {/* Input */}
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Room Code</label>
              <Input
                placeholder="e.g. design-sync-01"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                icon={<Hash size={15} />}
              />
              <p style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: C.hint, marginTop: 7, lineHeight: 1.6 }}>
                Ask the room host for their code. Codes are case-sensitive.
              </p>
            </div>

            {error && (
              <div style={{ padding: "11px 15px", borderRadius: 11, marginBottom: 16, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", fontSize: 12, color: "#f87171", fontFamily: "ui-monospace,monospace" }}>
                {error}
              </div>
            )}

            {/* Button */}
            <button
              onClick={handleJoin}
              disabled={isDisabled}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 13, border: "none",
                background: isDisabled ? "rgba(20,184,196,0.18)" : "linear-gradient(135deg,#14b8c8,#0a8f9e)",
                color: isDisabled ? "rgba(255,255,255,0.28)" : "#fff",
                fontSize: 14, fontWeight: 700,
                fontFamily: "ui-monospace,monospace", letterSpacing: "0.04em",
                cursor: isDisabled ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                boxShadow: isDisabled ? "none" : "0 0 28px rgba(20,184,196,0.35)",
                transition: "all 0.2s", opacity: isDisabled ? 0.7 : 1, marginTop: 20,
              }}
              onMouseEnter={e => { if (!isDisabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(20,184,196,0.50)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = isDisabled ? "none" : "0 0 28px rgba(20,184,196,0.35)"; }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Joining…
                </>
              ) : (
                <>Join Room <ArrowRight size={15} /></>
              )}
            </button>

            {/* Create link */}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <a
                href="/create"
                style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", color: C.muted, textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 1, transition: "color 0.2s" }}
                onMouseEnter={e => e.target.style.color = C.indigo}
                onMouseLeave={e => e.target.style.color = C.muted}
              >
                ← Create a new room
              </a>
            </div>

            {/* Pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 24 }}>
              {["AES-256 Encrypted", "No logs stored", "Instant join"].map(p => (
                <div key={p} style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 10, fontFamily: "ui-monospace,monospace", color: C.hint }}>
                  {p}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.18); }
        input { caret-color: #4DD9DC; }
      `}</style>
    </div>
  );
}