"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";

export default function LogoutButton({ variant = "default" }) {
  const router = useRouter();
  const [loading, setLoading]     = useState(false);
  const [showConfirm, setShow]    = useState(false);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      sessionStorage.clear();
      router.push("/login");
    } catch {
      setLoading(false);
      setShow(false);
    }
  };

  const modal = showConfirm && mounted && createPortal(
    <>
      <div onClick={() => !loading && setShow(false)} style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", zIndex: 9999,
        transform: "translate(-50%,-50%)",
        width: "320px",
        background: "rgba(6,8,18,0.98)", backdropFilter: "blur(40px)",
        border: "1px solid rgba(239,68,68,0.18)", borderRadius: "18px",
        padding: "26px 22px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)",
        fontFamily: "'Syne',sans-serif",
      }}>
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: "1px", background: "linear-gradient(90deg,transparent,rgba(239,68,68,0.35),transparent)" }} />
        <div style={{
          width: "44px", height: "44px", borderRadius: "13px",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px",
        }}>
          <AlertTriangle size={20} color="#ef4444" />
        </div>
        <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "800", color: "#eef0ff", letterSpacing: "-0.03em" }}>
          Log out of WhiteRoom?
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#2e3b5e", lineHeight: 1.6, fontFamily: "'Spline Sans Mono','JetBrains Mono',monospace", fontWeight: 300 }}>
          You'll be redirected to the login page. Any active room session will end.
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setShow(false)} disabled={loading} style={{
            flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)",
            color: "#4a5578", fontSize: "12px", fontWeight: "700", fontFamily: "'Syne',sans-serif",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
          >Cancel</button>
          <button onClick={handleLogout} disabled={loading} style={{
            flex: 1, padding: "10px", borderRadius: "10px",
            cursor: loading ? "not-allowed" : "pointer",
            border: "1px solid rgba(239,68,68,0.25)",
            background: loading ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.12)",
            color: loading ? "#3d4a6b" : "#ef4444",
            fontSize: "12px", fontWeight: "700", fontFamily: "'Syne',sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "rgba(239,68,68,0.22)"; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
          >
            {loading ? (
              <><div style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid rgba(239,68,68,0.2)", borderTopColor: "#ef4444", animation: "lo-spin 0.7s linear infinite" }} />Logging out…</>
            ) : (
              <><LogOut size={13} />Yes, log out</>
            )}
          </button>
        </div>
        <style>{`@keyframes lo-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>,
    document.body
  );

  const btnBase = {
    borderRadius: "8px", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", transition: "all 0.15s",
    fontFamily: "'Syne',sans-serif",
  };

  return (
    <>
      {variant === "icon" ? (
        <button onClick={() => setShow(true)} title="Logout" style={{
          ...btnBase, padding: "7px 9px",
          border: "1px solid rgba(239,68,68,0.15)",
          background: "rgba(239,68,68,0.07)", color: "#ef4444",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.14)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.07)"}
        >
          <LogOut size={14} />
        </button>
      ) : (
        <button onClick={() => setShow(true)} style={{
          ...btnBase, gap: "7px", padding: "9px 16px",
          border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.07)", color: "#ef4444",
          fontSize: "12px", fontWeight: "700",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.14)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.07)"}
        >
          <LogOut size={13} />Logout
        </button>
      )}
      {modal}
    </>
  );
}