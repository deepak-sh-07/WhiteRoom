"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, AlertTriangle } from "lucide-react";

export default function LogoutButton({ variant = "default" }) {
  const router = useRouter();
  const [loading, setLoading]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      sessionStorage.clear();
      router.push("/login");
    } catch (err) {
      console.error("Logout failed", err);
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      {/* ── Trigger button ── */}
      {variant === "icon" ? (
        <button
          onClick={() => setShowConfirm(true)}
          title="Logout"
          style={{
            padding: "7px 10px", borderRadius: "8px", cursor: "pointer",
            border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(239,68,68,.08)", color: "#ef4444",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,.08)"}
        >
          <LogOut style={{ width: "14px", height: "14px" }} />
        </button>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "9px 18px", borderRadius: "10px", cursor: "pointer",
            border: "1px solid rgba(239,68,68,.25)",
            background: "rgba(239,68,68,.08)", color: "#ef4444",
            fontSize: "13px", fontWeight: "600", transition: "all .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,.08)"}
        >
          <LogOut style={{ width: "14px", height: "14px" }} />
          Logout
        </button>
      )}

      {/* ── Confirmation modal ── */}
      {showConfirm && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => !loading && setShowConfirm(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)",
              animation: "fadeIn .15s ease",
            }}
          />

          {/* Dialog */}
          <div style={{
            position: "fixed", top: "50%", left: "50%", zIndex: 201,
            transform: "translate(-50%, -50%)",
            width: "340px",
            background: "rgba(13,15,23,.98)", backdropFilter: "blur(24px)",
            border: "1px solid rgba(239,68,68,.2)", borderRadius: "18px",
            padding: "28px 24px",
            boxShadow: "0 24px 64px rgba(0,0,0,.7)",
            animation: "popIn .15s ease",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>
            {/* Icon */}
            <div style={{
              width: "48px", height: "48px", borderRadius: "14px",
              background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "16px",
            }}>
              <AlertTriangle style={{ width: "22px", height: "22px", color: "#ef4444" }} />
            </div>

            {/* Text */}
            <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "#f1f5f9" }}>
              Log out of WhiteRoom?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              You'll be redirected to the login page. Any active room session will end.
            </p>

            {/* Buttons */}








            
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer",
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(255,255,255,.04)", color: "#94a3b8",
                  fontSize: "13px", fontWeight: "600", transition: "all .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.04)"}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loading}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px",
                  cursor: loading ? "not-allowed" : "pointer",
                  border: "1px solid rgba(239,68,68,.3)",
                  background: loading ? "rgba(239,68,68,.05)" : "rgba(239,68,68,.15)",
                  color: loading ? "#475569" : "#ef4444",
                  fontSize: "13px", fontWeight: "700", transition: "all .15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "rgba(239,68,68,.25)"; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "rgba(239,68,68,.15)"; }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: "12px", height: "12px", borderRadius: "50%",
                      border: "2px solid rgba(239,68,68,.2)", borderTopColor: "#ef4444",
                      animation: "spin .7s linear infinite", flexShrink: 0,
                    }} />
                    Logging out…
                  </>
                ) : (
                  <>
                    <LogOut style={{ width: "13px", height: "13px" }} />
                    Yes, log out
                  </>
                )}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes popIn  { from { opacity:0; transform:translate(-50%,-48%) scale(.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
            @keyframes spin   { to { transform:rotate(360deg) } }
          `}</style>
        </>
      )}
    </>
  );
}