"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Shield, Clock, Globe } from "lucide-react";
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

function Input({ type = "text", placeholder, value, onChange, onKeyDown, extraStyle = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      style={{
        width: "100%",
        background: focused ? "rgba(255,255,255,0.07)" : C.inputBg,
        border: `1px solid ${focused ? "rgba(124,143,255,0.55)" : C.inputBorder}`,
        borderRadius: 13,
        padding: "14px 18px",
        color: C.text,
        fontSize: 14,
        fontFamily: "ui-monospace,monospace",
        outline: "none",
        boxSizing: "border-box",
        transition: "all 0.2s",
        boxShadow: focused ? "0 0 0 3px rgba(124,143,255,0.09)" : "none",
        ...extraStyle,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

const features = [
  { icon: <Shield size={15} />, label: "Military-grade encryption", desc: "AES-256 encryption ensures only participants can read messages." },
  { icon: <Clock size={15} />, label: "Auto-expiring sessions", desc: "Rooms automatically close when all participants have left." },
  { icon: <Globe size={15} />, label: "Shareable via code", desc: "Share your room code with anyone — no account needed to join." },
];

const stats = [
  { val: "256", lbl: "AES-bit" },
  { val: "0", lbl: "Logs stored" },
  { val: "∞", lbl: "Rooms free" },
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
  background: "linear-gradient(90deg,transparent,rgba(124,143,255,0.9),rgba(77,217,220,0.9),transparent)",
};

const adjectives = ["swift","silent","cosmic","frozen","amber","crimson","neon","lunar","iron","velvet"];
const nouns = ["orbit","cipher","vault","storm","nexus","prism","ghost","forge","pulse","relay"];

export default function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  const generateCode = useCallback(() => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    setRoomCode(`${adj}-${noun}-${num}`);
  }, []);

  useEffect(() => {
    setTimeout(() => setVisible(true), 60);
    generateCode();
  }, []);

  const create = async () => {
    if (!name.trim() || !roomCode.trim()) { setError("Please fill in both fields."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, room_code: roomCode }),
      });
      if (res.status === 200 || res.status === 201) router.push(`/room/${roomCode}`);
      else {
        const data = await res.json();
        setError(data.message ?? "Failed to create room. Try again.");
      }
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 140% 70% at 50% -10%, rgba(50,70,200,0.20) 0%, transparent 60%), hsl(230,60%,3%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative", padding: "40px 24px",
    }}>
      <ParticleCanvas />

      {/* Orbs */}
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "hsl(231,65%,50%)", opacity: 0.15, filter: "blur(130px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "hsl(180,70%,40%)", opacity: 0.11, filter: "blur(130px)", pointerEvents: "none", zIndex: 0 }} />

      {/* Logo */}
      <div style={{ position: "fixed", top: 28, left: 32, zIndex: 50, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#5c6fd4,#3a4fc8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(92,111,212,0.45)" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

          {/* ── LEFT: Create Form ── */}
          <div style={panelStyle}>
            <div style={shimmer} />

            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 20, marginBottom: 20, background: "rgba(124,143,255,0.10)", border: "1px solid rgba(124,143,255,0.22)" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.indigo, boxShadow: `0 0 6px ${C.indigo}`, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.indigo, letterSpacing: "0.12em", fontFamily: "ui-monospace,monospace" }}>NEW SESSION</span>
            </div>

            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 10 }}>
              Start a{" "}
              <span style={{ background: "linear-gradient(90deg,#7C8FFF,#4DD9DC)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                session.
              </span>
            </h1>
            <p style={{ fontSize: 13, fontFamily: "ui-monospace,monospace", color: C.muted, fontWeight: 300, marginBottom: 28, lineHeight: 1.8 }}>
              Create a new encrypted room and share the code with your team. Everything stays private — always.
            </p>

            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 28 }} />

            {/* Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Your Name</label>
                <Input
                  placeholder="Alex Johnson"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && create()}
                />
              </div>

              <div>
                <label style={labelStyle}>Room Code</label>
                <div style={{ position: "relative" }}>
                  <Input
                    placeholder="e.g. design-sync-01"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && create()}
                    extraStyle={{ paddingRight: 110 }}
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    style={{
                      position: "absolute", right: 8, top: "50%",
                      transform: "translateY(-50%)",
                      background: "rgba(124,143,255,0.12)",
                      border: "1px solid rgba(124,143,255,0.25)",
                      borderRadius: 8, padding: "6px 11px",
                      cursor: "pointer", color: C.indigo,
                      fontSize: 10, fontFamily: "ui-monospace,monospace",
                      letterSpacing: "0.08em", fontWeight: 700,
                      transition: "all 0.2s", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(124,143,255,0.24)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(124,143,255,0.12)"}
                  >
                    ↻ RANDOM
                  </button>
                </div>
                <p style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: C.hint, marginTop: 7, lineHeight: 1.6 }}>
                  Share this code with anyone you want to invite. Codes are case-sensitive.
                </p>
              </div>
            </div>

            {error && (
              <div style={{ padding: "11px 15px", borderRadius: 11, marginBottom: 16, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", fontSize: 12, color: "#f87171", fontFamily: "ui-monospace,monospace" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={create}
              disabled={loading}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 13, border: "none",
                background: loading ? "rgba(92,111,212,0.25)" : "linear-gradient(135deg,#5c6fd4,#3a4fc8)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                fontFamily: "ui-monospace,monospace", letterSpacing: "0.04em",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                boxShadow: loading ? "none" : "0 0 28px rgba(92,111,212,0.38)",
                transition: "all 0.2s", opacity: loading ? 0.7 : 1, marginTop: 20,
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(92,111,212,0.55)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = loading ? "none" : "0 0 28px rgba(92,111,212,0.38)"; }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Connecting…
                </>
              ) : (
                <>Enter Room <ArrowRight size={15} /></>
              )}
            </button>

            {/* Join link */}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <a
                href="/join"
                style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", color: C.muted, textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 1, transition: "color 0.2s" }}
                onMouseEnter={e => e.target.style.color = C.teal}
                onMouseLeave={e => e.target.style.color = C.muted}
              >
                Join existing →
              </a>
            </div>

            {/* Pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 24 }}>
              {["AES-256 Encrypted", "No logs stored", "Instant setup"].map(p => (
                <div key={p} style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 10, fontFamily: "ui-monospace,monospace", color: C.hint }}>
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Info Panel ── */}
          <div style={panelStyle}>
            <div style={shimmer} />

            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", fontFamily: "ui-monospace,monospace", marginBottom: 24 }}>
              Why WhiteRoom
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {features.map(f => (
                <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 15 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(124,143,255,0.08)", border: "1px solid rgba(124,143,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", color: C.indigo, flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "ui-monospace,monospace", marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: "ui-monospace,monospace", lineHeight: 1.7 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "28px 0" }} />

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {stats.map(s => (
                <div key={s.lbl} style={{ padding: "14px 12px", borderRadius: 13, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 3, letterSpacing: "0.08em", fontFamily: "ui-monospace,monospace" }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Encryption badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 16px", borderRadius: 14, background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)", marginTop: 24 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: "rgba(74,222,128,0.6)", letterSpacing: "0.10em" }}>
                END-TO-END ENCRYPTED · NO ACCOUNT REQUIRED
              </span>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.18); }
        input { caret-color: #7C8FFF; }
      `}</style>
    </div>
  );
}