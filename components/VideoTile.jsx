import { VideoOff } from "lucide-react";

const tileStyle = {
  local:  { background: "linear-gradient(135deg,#08091a,#0d1028)", border: "1px solid rgba(92,111,224,.22)",  iconColor: "#a5b4fc", glow: "rgba(92,111,224,.06)" },
  remote: { background: "linear-gradient(135deg,#050e12,#091418)", border: "1px solid rgba(77,217,220,.18)", iconColor: "#4dd9dc", glow: "rgba(77,217,220,.05)" },
};

const VideoTile = ({ videoRef, stream, label, isLocal = false, isCameraOn = true, variant = "local" }) => {
  const s = tileStyle[variant];
  const showVideo   = isLocal ? isCameraOn : !!stream;
  const isConnected = isLocal ? true : !!stream;

  return (
    <div style={{
      position: "relative", borderRadius: "14px", overflow: "hidden",
      width: "100%", height: "100%", minHeight: 0,
      background: s.background, border: s.border,
      boxShadow: "0 8px 32px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.04)",
    }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${s.glow}, transparent)`, pointerEvents: "none", zIndex: 1 }} />

      {isLocal ? (
        <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: showVideo ? "block" : "none" }} />
      ) : stream ? (
        <video autoPlay playsInline ref={el => { if (el && stream && el.srcObject !== stream) el.srcObject = stream; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}

      {!showVideo && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "10px", background: s.background }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VideoOff style={{ width: "20px", height: "20px", color: s.iconColor, opacity: 0.45 }} />
          </div>
          <span style={{ fontSize: "11px", color: "#2e3b5e", fontFamily: "'Spline Sans Mono',monospace", letterSpacing: "0.04em" }}>
            {isLocal ? "CAMERA OFF" : "CONNECTING…"}
          </span>
        </div>
      )}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.65),transparent 40%)", pointerEvents: "none", zIndex: 3 }} />

      <div style={{ position: "absolute", bottom: "10px", left: "10px", zIndex: 4, background: "rgba(4,5,13,.7)", backdropFilter: "blur(12px)", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(255,255,255,.07)" }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "#8896b8", fontFamily: "'Syne',sans-serif" }}>{label}</span>
      </div>

      <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 4 }}>
        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: isConnected ? "#10b981" : "#f59e0b", boxShadow: isConnected ? "0 0 6px rgba(16,185,129,.8)" : "0 0 6px rgba(245,158,11,.8)" }} />
      </div>
    </div>
  );
};

export default VideoTile;