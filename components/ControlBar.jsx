import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const ControlBar = ({ isMicOn, isCameraOn, toggleMic, toggleCamera, onLeave }) => (
  <>
    <style>{`
      .cb-btn { width:46px;height:46px;border-radius:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.18s cubic-bezier(.16,1,.3,1); }
      .cb-btn:hover { transform:translateY(-1px); }
      .cb-btn:active { transform:scale(0.95); }
      .cb-leave { width:50px;height:50px;border-radius:13px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;box-shadow:0 6px 20px rgba(239,68,68,0.35);transition:all 0.18s cubic-bezier(.16,1,.3,1); }
      .cb-leave:hover { transform:translateY(-1px);box-shadow:0 10px 28px rgba(239,68,68,0.52); }
      .cb-leave:active { transform:scale(0.95); }
    `}</style>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", padding:"12px 20px" }}>
      <button onClick={toggleMic} className="cb-btn" style={{ background: isMicOn ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.15)", border: `1px solid ${isMicOn ? "rgba(255,255,255,0.09)" : "rgba(239,68,68,0.35)"}`, color: isMicOn ? "#4a5578" : "#ef4444" }}>
        {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <button onClick={toggleCamera} className="cb-btn" style={{ background: isCameraOn ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.15)", border: `1px solid ${isCameraOn ? "rgba(255,255,255,0.09)" : "rgba(239,68,68,0.35)"}`, color: isCameraOn ? "#4a5578" : "#ef4444" }}>
        {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
      </button>
      <button onClick={onLeave} className="cb-leave"><PhoneOff size={18} /></button>
    </div>
  </>
);

export default ControlBar;