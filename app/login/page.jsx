"use client";
import { useState, useEffect, useRef } from "react";
import ParticleCanvas from "@/components/ParticleCanvas";

const COLORS = {
  indigo: "#7C8FFF",
  teal: "#4DD9DC",
  purple: "#a78bfa",
  pink: "#f472b6",
  bg: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.10)",
  borderFocus: "rgba(124,143,255,0.60)",
  text: "rgba(255,255,255,0.90)",
  muted: "rgba(255,255,255,0.40)",
  hint: "rgba(255,255,255,0.22)",
  cardBg: "rgba(255,255,255,0.045)",
  cardBorder: "rgba(255,255,255,0.08)",
  btnBg: "linear-gradient(135deg,#5c6fd4 0%,#3a8fc7 100%)",
  success: "#4ade80",
  danger: "#f87171",
};

const inputStyle = {
  width: "100%",
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: "11px 16px",
  color: COLORS.text,
  fontSize: 14,
  fontFamily: "ui-monospace,monospace",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const labelStyle = {
  display: "block",
  fontSize: 10,
  fontFamily: "ui-monospace,monospace",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: COLORS.muted,
  marginBottom: 7,
};

function Input({ type = "text", placeholder, value, onChange, extraStyle = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={{ ...inputStyle, borderColor: focused ? COLORS.borderFocus : COLORS.border, ...extraStyle }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

const features = [
  {
    color: COLORS.indigo,
    bg: "rgba(124,143,255,0.10)",
    border: "rgba(124,143,255,0.22)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: "End-to-End Encrypted",
    desc: "Every message is encrypted before it leaves your device. Nobody — not even us — can read your conversations.",
  },
  {
    color: COLORS.teal,
    bg: "rgba(77,217,220,0.10)",
    border: "rgba(77,217,220,0.22)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    title: "Real-Time Collaboration",
    desc: "Work together instantly. Changes sync live with zero lag across all connected devices.",
  },
  {
    color: COLORS.purple,
    bg: "rgba(167,139,250,0.10)",
    border: "rgba(167,139,250,0.22)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "Private Rooms",
    desc: "Create invite-only spaces for your team. You control access, membership, and permissions completely.",
  },
  {
    color: COLORS.pink,
    bg: "rgba(244,114,182,0.10)",
    border: "rgba(244,114,182,0.22)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "Zero Data Retention",
    desc: "We never store your messages on our servers. Your data stays yours — always and forever.",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (res.status === 200) { sessionStorage.setItem("userName", data.name ?? email.split("@")[0]); window.location.href = "/"; }
      else setError(data.message ?? "Login failed");
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError("");
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const data = await res.json();
      if (res.status === 201 || res.status === 200) { setIsLogin(true); setError(""); }
      else setError(data.message ?? "Registration failed");
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); if (isLogin) handleLogin(); else handleRegister(); };

  const pageStyle = {
    minHeight: "100vh",
    background: "radial-gradient(ellipse 140% 70% at 50% -10%, rgba(50,70,200,0.22) 0%, transparent 60%), hsl(230,60%,3%)",
    overflowX: "hidden",
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(24px)",
    transition: "opacity 0.8s cubic-bezier(.16,1,.3,1), transform 0.8s cubic-bezier(.16,1,.3,1)",
  };

  return (
    <div style={pageStyle}>
      <ParticleCanvas />

      {/* Orb 1 */}
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "hsl(231,65%,50%)", opacity: 0.18, filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />
      {/* Orb 2 */}
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "hsl(180,70%,40%)", opacity: 0.13, filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />

      {/* ══════════════════════════════
          SECTION 1 — AUTH (full screen)
         ══════════════════════════════ */}
      <section style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#5c6fd4,#3a8fc7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(92,111,212,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>WhiteRoom</div>
            <div style={{ fontSize: 9, fontFamily: "ui-monospace,monospace", letterSpacing: "0.18em", textTransform: "uppercase", color: COLORS.hint }}>E2E Encrypted</div>
          </div>
        </div>

        {/* Card */}
        <div style={{ width: "100%", maxWidth: 440, borderRadius: 20, background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", padding: "40px 40px 32px", position: "relative", overflow: "hidden" }}>

          {/* Top shimmer line */}
          <div style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg,transparent,rgba(124,143,255,0.9),rgba(77,217,220,0.9),transparent)" }} />

          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 8 }}>
            {isLogin ? <>Welcome <span style={{ background: "linear-gradient(90deg,#7C8FFF,#4DD9DC)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>back.</span></> : <>Create your <span style={{ background: "linear-gradient(90deg,#7C8FFF,#4DD9DC)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>account.</span></>}
          </h1>
          <p style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", color: COLORS.muted, marginBottom: 28 }}>
            {isLogin ? "Sign in to continue your session" : "Join and start collaborating securely"}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {!isLogin && (
              <div>
                <label style={labelStyle}>Full Name</label>
                <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}

            <div>
              <label style={labelStyle}>Email</label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <Input type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} extraStyle={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: COLORS.hint, padding: 2, display: "flex" }}>
                  {showPw
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <div style={{ position: "relative" }}>
                  <Input type={showCpw ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} extraStyle={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowCpw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: COLORS.hint, padding: 2, display: "flex" }}>
                    {showCpw
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <p style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", marginTop: 6, color: password === confirmPassword ? COLORS.success : COLORS.danger }}>
                    {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords don't match"}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 12, fontFamily: "ui-monospace,monospace", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", color: COLORS.danger }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", background: COLORS.btnBg, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "ui-monospace,monospace", letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1, boxShadow: "0 0 28px rgba(92,111,212,0.35)", transition: "opacity 0.2s, transform 0.15s" }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              {loading ? (
                <>
                  <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  {isLogin ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </>
              )}
            </button>
          </form>

          {/* Toggle */}
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 12, fontFamily: "ui-monospace,monospace", color: COLORS.hint }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={() => { setIsLogin(v => !v); setError(""); setConfirmPassword(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 5, fontSize: 12, fontFamily: "ui-monospace,monospace", fontWeight: 700, color: COLORS.indigo }}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>

          {/* Badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span style={{ fontSize: 10, fontFamily: "ui-monospace,monospace", letterSpacing: "0.14em", color: "#2d6a4f" }}>END-TO-END ENCRYPTED SESSION</span>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{ marginTop: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: COLORS.hint, animation: "bounce 2s ease-in-out infinite" }}>
          <span style={{ fontSize: 10, fontFamily: "ui-monospace,monospace", letterSpacing: "0.14em" }}>LEARN MORE</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════
          SECTION 2 — INFO (below fold)
         ══════════════════════════════ */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto", padding: "0 24px 100px" }}>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 64 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: 10, fontFamily: "ui-monospace,monospace", letterSpacing: "0.18em", color: COLORS.hint }}>WHY WHITEROOM</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Tagline */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, color: "#fff", marginBottom: 16 }}>
            The private space<br />
            <span style={{ background: "linear-gradient(90deg,#7C8FFF,#4DD9DC)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>your team deserves.</span>
          </h2>
          <p style={{ fontSize: 14, fontFamily: "ui-monospace,monospace", color: COLORS.muted, lineHeight: 1.8, maxWidth: 500, margin: "0 auto" }}>
            A fully encrypted collaboration platform built for teams who value their privacy.
            No ads, no tracking, no surveillance — just clean, fast, secure communication.
          </p>
        </div>

        {/* Feature grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginBottom: 40 }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{ borderRadius: 18, background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: "24px 24px 22px" }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 11, background: f.bg, border: `1px solid ${f.border}`, color: f.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", color: COLORS.muted, lineHeight: 1.75 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ borderRadius: 18, background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex" }}>
            {[COLORS.indigo, COLORS.teal, COLORS.purple, COLORS.pink, "#facc15"].map((c, i) => (
              <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: "2px solid hsl(230,60%,4%)", marginLeft: i === 0 ? 0 : -10 }} />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Trusted by 2,400+ teams worldwide</div>
            <div style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: COLORS.hint, marginTop: 2 }}>across 60+ countries — and growing every day</div>
          </div>
          <div style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", padding: "6px 14px", borderRadius: 8, background: "rgba(124,143,255,0.12)", border: "1px solid rgba(124,143,255,0.22)", color: COLORS.indigo, whiteSpace: "nowrap" }}>
            Free forever
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.18); }
        input { caret-color: #7C8FFF; }
      `}</style>
    </div>
  );
}