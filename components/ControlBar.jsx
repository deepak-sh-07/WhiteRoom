import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const ControlBar = ({ isMicOn, isCameraOn, toggleMic, toggleCamera }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "14px 20px",
    }}
  >
    <button
      onClick={toggleMic}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isMicOn ? "rgba(255,255,255,.07)" : "rgba(239,68,68,.2)",
        border: "1px solid " + (isMicOn ? "rgba(255,255,255,.1)" : "rgba(239,68,68,.4)"),
        color: isMicOn ? "#94a3b8" : "#ef4444",
      }}
    >
      {isMicOn ? <Mic style={{ width: "20px", height: "20px" }} /> : <MicOff style={{ width: "20px", height: "20px" }} />}
    </button>

    <button
      onClick={toggleCamera}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isCameraOn ? "rgba(255,255,255,.07)" : "rgba(239,68,68,.2)",
        border: "1px solid " + (isCameraOn ? "rgba(255,255,255,.1)" : "rgba(239,68,68,.4)"),
        color: isCameraOn ? "#94a3b8" : "#ef4444",
      }}
    >
      {isCameraOn ? <Video style={{ width: "20px", height: "20px" }} /> : <VideoOff style={{ width: "20px", height: "20px" }} />}
    </button>

    <button
      style={{
        width: "52px",
        height: "52px",
        borderRadius: "14px",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#ef4444,#dc2626)",
        color: "white",
        boxShadow: "0 4px 16px rgba(239,68,68,.35)",
      }}
    >
      <PhoneOff style={{ width: "20px", height: "20px" }} />
    </button>
  </div>
);

export default ControlBar;