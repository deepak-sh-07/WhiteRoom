import { useState } from "react";
import { MessageSquare, Minimize2, X, Send, Lock } from "lucide-react";

const ChatPanel = ({ isOpen, onClose, messages, users, role, onSend }) => {
  const [msg, setMsg] = useState("");
  const [minimized, setMinimized] = useState(false);
  const handleSend = () => { if (!msg.trim()) return; onSend(msg.trim()); setMsg(""); };
  if (!isOpen) return null;

  if (minimized) return (
    <div style={{ position:"fixed", bottom:"20px", right:"20px", zIndex:50 }}>
      <button onClick={() => setMinimized(false)} style={{ position:"relative", width:"50px", height:"50px", borderRadius:"14px", background:"rgba(6,8,18,0.95)", backdropFilter:"blur(24px)", border:"1px solid rgba(92,111,224,0.3)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#7c8fff", boxShadow:"0 8px 28px rgba(92,111,224,0.25)" }}>
        <MessageSquare size={18} />
        {messages.length > 0 && <span style={{ position:"absolute", top:"-5px", right:"-5px", background:"#4dd9dc", color:"#04050d", fontSize:"9px", fontWeight:"800", width:"16px", height:"16px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", border:"2px solid #04050d" }}>{messages.length > 9 ? "9+" : messages.length}</span>}
      </button>
    </div>
  );

  return (
    <div style={{ position:"fixed", bottom:"20px", right:"20px", zIndex:50 }}>
      <div style={{ width:"340px", height:"500px", background:"rgba(6,8,18,0.97)", backdropFilter:"blur(40px) saturate(160%)", borderRadius:"18px", border:"1px solid rgba(255,255,255,0.06)", boxShadow:"0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
        <div style={{ position:"absolute", top:0, left:"20%", right:"20%", height:"1px", background:"linear-gradient(90deg,transparent,rgba(92,111,224,0.5),transparent)" }} />
        <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(92,111,224,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:"26px", height:"26px", borderRadius:"8px", background:"linear-gradient(135deg,#5c6fe0,#14b8c8)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 12px rgba(92,111,224,0.3)" }}><MessageSquare size={13} color="white" /></div>
            <span style={{ fontSize:"13px", fontWeight:"700", color:"#c8cde8", fontFamily:"'Syne',sans-serif", letterSpacing:"-0.02em" }}>Messages</span>
          </div>
          <div style={{ display:"flex", gap:"4px" }}>
            {[{ Icon: Minimize2, fn: () => setMinimized(true) }, { Icon: X, fn: onClose }].map(({ Icon, fn }, i) => (
              <button key={i} onClick={fn} style={{ width:"26px", height:"26px", borderRadius:"7px", border:"none", background:"rgba(255,255,255,0.04)", color:"#2e3b5e", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.color="#8896b8"; }} onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.color="#2e3b5e"; }}><Icon size={13} /></button>
            ))}
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:"8px" }}>
          {messages.length === 0 && <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"8px", opacity:0.3 }}><MessageSquare size={28} color="#2e3b5e" /><span style={{ fontSize:"11px", color:"#2e3b5e", fontFamily:"'Spline Sans Mono','JetBrains Mono',monospace" }}>no messages yet</span></div>}
          {messages.map((m, i) => {
            const mine = m.sender === role;
            return (
              <div key={i} style={{ display:"flex", justifyContent:mine?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"82%", padding:"8px 11px", borderRadius:mine?"12px 12px 4px 12px":"12px 12px 12px 4px", background:mine?"rgba(92,111,224,0.22)":"rgba(255,255,255,0.04)", border:mine?"1px solid rgba(92,111,224,0.3)":"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"5px", marginBottom:"3px" }}>
                    <span style={{ fontSize:"10px", fontWeight:"700", color:mine?"#a5b4fc":"#5c6fe0", fontFamily:"'Spline Sans Mono','JetBrains Mono',monospace" }}>{m.sender}</span>
                    <span style={{ fontSize:"9px", color:"#2e3b5e", fontFamily:"'Spline Sans Mono','JetBrains Mono',monospace" }}>{new Date(m.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>
                  </div>
                  <p style={{ fontSize:"12px", margin:0, color:mine?"#c7d2fe":"#8896b8", lineHeight:1.5, fontFamily:"'Syne',sans-serif" }}>{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,0.05)", background:"rgba(255,255,255,0.01)" }}>
          <div style={{ display:"flex", gap:"7px" }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),handleSend())} placeholder="Send a message…" style={{ flex:1, padding:"9px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", color:"#c8cde8", fontSize:"12px", outline:"none", fontFamily:"'Syne',sans-serif", transition:"border-color 0.2s" }} onFocus={e => e.target.style.borderColor="rgba(92,111,224,0.4)"} onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.07)"} />
            <button onClick={handleSend} disabled={!msg.trim()} style={{ width:"36px", height:"36px", borderRadius:"10px", border:"none", background:msg.trim()?"linear-gradient(135deg,#5c6fe0,#3a4fc8)":"rgba(255,255,255,0.04)", color:msg.trim()?"white":"#2e3b5e", cursor:msg.trim()?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", boxShadow:msg.trim()?"0 4px 14px rgba(92,111,224,0.3)":"none" }}><Send size={14} /></button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"4px", marginTop:"7px" }}>
            <Lock size={10} color="#1e3a30" />
            <span style={{ fontSize:"10px", color:"#1e3a30", fontFamily:"'Spline Sans Mono','JetBrains Mono',monospace" }}>end-to-end encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;