"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Hash, Lock, Video, Users, Shield, Zap } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import ParticleCanvas from "@/components/ParticleCanvas";

const C = {
  indigo: "#7C8FFF",
  teal: "#4DD9DC",
  purple: "#a78bfa",
  pink: "#f472b6",
  text: "rgba(255,255,255,0.90)",
  muted: "rgba(255,255,255,0.38)",
  hint: "rgba(255,255,255,0.18)",
  cardBg: "rgba(255,255,255,0.042)",
  cardBorder: "rgba(255,255,255,0.08)",
  navBg: "rgba(4,5,15,0.75)",
};

const gradText = {
  background: "linear-gradient(100deg,#7C8FFF 0%,#4DD9DC 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

function ActionCard({ onClick, accentColor, accentRgb, gradFrom, gradTo, icon, title, desc, badge, badgeColor, badgeTextColor, badgeBorder }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "26px 24px 24px",
        borderRadius: 18,
        cursor: "pointer",
        textAlign: "left",
        background: hovered ? `rgba(${accentRgb},0.07)` : C.cardBg,
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: `1px solid ${hovered ? `rgba(${accentRgb},0.4)` : C.cardBorder}`,
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? `0 24px 52px rgba(0,0,0,0.45), 0 0 32px rgba(${accentRgb},0.12)` : "0 8px 32px rgba(0,0,0,0.3)",
        transition: "all 0.22s cubic-bezier(.16,1,.3,1)",
        fontFamily: "inherit",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: `linear-gradient(90deg,transparent,rgba(${accentRgb},0.7),transparent)`, opacity: hovered ? 1 : 0.35, transition: "opacity 0.22s" }} />
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg,${gradFrom},${gradTo})`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: `0 6px 20px rgba(${accentRgb},0.4)` }}>
        {icon}
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, background: badgeColor, border: `1px solid ${badgeBorder}`, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontFamily: "ui-monospace,monospace", color: badgeTextColor, fontWeight: 700, letterSpacing: "0.08em" }}>{badge}</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 7, letterSpacing: "-0.03em" }}>{title}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, fontFamily: "ui-monospace,monospace", fontWeight: 300 }}>{desc}</div>
      <div style={{ position: "absolute", bottom: 22, right: 22, opacity: hovered ? 1 : 0, transform: hovered ? "translate(0,0)" : "translate(-4px,4px)", transition: "all 0.22s", color: accentColor }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </button>
  );
}

export default function Home() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const name = sessionStorage.getItem("userName");
    if (name) setUserName(name);
    fetch("/api/me", { method: "GET", credentials: "include" })
      .then(r => r.json().then(d => ({ ok: r.status === 200, d })))
      .then(({ ok, d }) => {
        if (!ok) { router.push("/login"); return; }
        setUserId(d.userId);
        setLoading(false);
        setTimeout(() => setVisible(true), 60);
      })
      .catch(() => router.push("/login"));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "hsl(230,60%,3%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(124,143,255,0.2)", borderTopColor: "#7C8FFF", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const initials = (userName ?? userId ?? "U").slice(0, 2).toUpperCase();
  const displayName = userName ?? (userId ? `${userId.slice(0, 8)}…` : "—");

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse 140% 70% at 50% -10%, rgba(50,70,200,0.20) 0%, transparent 60%), hsl(230,60%,3%)", color: C.text, position: "relative", overflowX: "hidden" }}>
      <ParticleCanvas />

      {/* Orbs */}
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "hsl(231,65%,50%)", opacity: 0.15, filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "hsl(180,70%,40%)", opacity: 0.11, filter: "blur(120px)", pointerEvents: "none", zIndex: 0 }} />

      {/* Navbar */}
      <nav style={{ position: "relative", zIndex: 10, padding: "13px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)", background: C.navBg, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#5c6fd4,#3a8fc7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(92,111,212,0.45)" }}>
            <Lock size={15} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>WhiteRoom</div>
            <div style={{ fontSize: 8, fontFamily: "ui-monospace,monospace", letterSpacing: "0.18em", color: C.hint, textTransform: "uppercase" }}>E2E Encrypted</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 14px 7px 8px", borderRadius: 12, background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7C8FFF,#4DD9DC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
              {initials}
            </div>
            <span style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", color: C.muted }}>{displayName}</span>
          </div>
          <LogoutButton variant="icon" />
        </div>
      </nav>

      {/* Main */}
      <main style={{
        position: "relative", zIndex: 10,
        maxWidth: 780, margin: "0 auto",
        padding: "28px 24px 60px",
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(28px)",
        transition: "opacity 0.8s cubic-bezier(.16,1,.3,1), transform 0.8s cubic-bezier(.16,1,.3,1)",
      }}>

        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 20, marginBottom: 16, background: "rgba(124,143,255,0.10)", border: "1px solid rgba(124,143,255,0.22)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.indigo, boxShadow: `0 0 6px ${C.indigo}`, animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.indigo, letterSpacing: "0.12em", fontFamily: "ui-monospace,monospace" }}>END-TO-END ENCRYPTED</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(42px,6.5vw,72px)", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.94, marginBottom: 16, color: "#fff" }}>
          Your rooms,<br />
          <span style={gradText}>your call.</span>
        </h1>

        <p style={{ fontSize: 14, fontFamily: "ui-monospace,monospace", color: C.muted, lineHeight: 1.8, marginBottom: 32, maxWidth: 420, fontWeight: 300 }}>
          Create a private encrypted room or join one instantly.
          No tracking, no logs — just secure collaboration.
        </p>

        {/* Action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          <ActionCard
            onClick={() => router.push("/create")}
            accentColor="#7C8FFF" accentRgb="124,143,255"
            gradFrom="#5c6fd4" gradTo="#3a4fc8"
            icon={<Plus size={22} color="white" />}
            title="Create Room"
            desc="Start a new encrypted session and invite your team"
            badge="New session"
            badgeColor="rgba(124,143,255,0.15)" badgeTextColor={C.indigo} badgeBorder="rgba(124,143,255,0.25)"
          />
          <ActionCard
            onClick={() => router.push("/join")}
            accentColor="#4DD9DC" accentRgb="77,217,220"
            gradFrom="#14b8c8" gradTo="#0a8f9e"
            icon={<Hash size={22} color="white" />}
            title="Join Room"
            desc="Enter a room code to join an existing session"
            badge="Have a code?"
            badgeColor="rgba(77,217,220,0.12)" badgeTextColor={C.teal} badgeBorder="rgba(77,217,220,0.25)"
          />
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { value: "AES-256", label: "Encryption standard", color: C.indigo },
            { value: "WebRTC", label: "Peer-to-peer video", color: C.teal },
            { value: "0 logs", label: "Zero data stored", color: C.purple },
          ].map(s => (
            <div key={s.value} style={{ borderRadius: 14, background: C.cardBg, border: `1px solid ${C.cardBorder}`, padding: "16px 18px", backdropFilter: "blur(16px)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.03em", color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { Icon: Shield, label: "AES Encrypted Chat" },
            { Icon: Video, label: "WebRTC Video" },
            { Icon: Users, label: "Multi-user Rooms" },
            { Icon: Zap, label: "Zero Latency" },
            { Icon: Lock, label: "No Data Retention" },
          ].map(({ Icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon size={11} color={C.hint} />
              <span style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}