import { VideoOff } from "lucide-react";

const tileStyle = {
  local: {
    background: "linear-gradient(135deg,#1e1b4b,#1e293b)",
    border: "1px solid rgba(99,102,241,.25)",
    iconColor: "#818cf8",
  },
  remote: {
    background: "linear-gradient(135deg,#0f2a2a,#1e293b)",
    border: "1px solid rgba(20,184,166,.2)",
    iconColor: "#14b8a6",
  },
};

const VideoTile = ({ videoRef, stream, label, isLocal = false, isCameraOn = true, variant = "local" }) => {
  const style  = tileStyle[variant];
  const showVideo  = isLocal ? isCameraOn : !!stream;
  const isConnected = isLocal ? true : !!stream;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "14px",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: style.background,
        border: style.border,
        boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      }}
    >
      {/* Video element */}
      {isLocal ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: showVideo ? "block" : "none" }}
        />
      ) : stream ? (
        <video
          autoPlay
          playsInline
          ref={el => { if (el && stream && el.srcObject !== stream) el.srcObject = stream; }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : null}

      {/* Camera off / connecting overlay */}
      {!showVideo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "8px",
            background: style.background,
          }}
        >
          <VideoOff style={{ width: "32px", height: "32px", color: style.iconColor, opacity: 0.5 }} />
          <span style={{ fontSize: isLocal ? "11px" : "12px", color: "#64748b" }}>
            {isLocal ? "Camera off" : "Connecting…"}
          </span>
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top,rgba(0,0,0,.6),transparent 45%)",
          pointerEvents: "none",
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          background: "rgba(0,0,0,.55)",
          backdropFilter: "blur(8px)",
          padding: "4px 10px",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,.1)",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: "600", color: "#e2e8f0" }}>{label}</span>
      </div>

      {/* Status dot */}
      <div style={{ position: "absolute", top: "10px", right: "10px" }}>
        <div
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: isConnected ? "#10b981" : "#f59e0b",
            boxShadow: isConnected ? "0 0 6px #10b981" : "0 0 6px #f59e0b",
          }}
        />
      </div>
    </div>
  );
};

export default VideoTile;