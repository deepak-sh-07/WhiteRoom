"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Hash } from "lucide-react";

function OrbCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, t = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    function draw() {
      t += 0.004; ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;
      [{ x: W*0.25+Math.sin(t*0.7)*55, y: H*0.4+Math.cos(t*0.5)*40, r: 280, c:"rgba(20,140,160,0.08)" }, { x: W*0.75+Math.sin(t*0.5+2)*50, y: H*0.55+Math.cos(t*0.6)*35, r: 240, c:"rgba(60,80,200,0.07)" }].forEach(o => {
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, o.c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI*2); ctx.fill();
      });
      ctx.strokeStyle = "rgba(55,75,160,0.025)"; ctx.lineWidth = 1;
      for (let x=0; x<W; x+=64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y=0; y<H; y+=64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }} />;
}

export default function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  const handleJoin = async () => {
    if (!roomId.trim()) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/join", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ roomId }) });
      if (res.status === 200) router.push(`/room/${roomId}`);
      else if (res.status === 404) setError("Room not found. Check the code and try again.");
      else setError("Invalid room code.");
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const fi = e => { e.target.style.borderColor="rgba(20,184,196,0.5)"; e.target.style.background="rgba(255,255,255,0.06)"; e.target.style.boxShadow="0 0 0 3px rgba(20,184,196,0.07)"; };
  const bi = e => { e.target.style.borderColor="rgba(255,255,255,0.07)"; e.target.style.background="rgba(255,255,255,0.04)"; e.target.style.boxShadow="none"; };

  return (
    <div style={{ minHeight:"100vh", background:"#04050d", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
      <OrbCanvas />
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:"400px", padding:"0 20px", opacity:visible?1:0, transform:visible?"translateY(0)":"translateY(28px)", transition:"all 0.75s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ background:"rgba(6,8,18,0.92)", backdropFilter:"blur(40px) saturate(160%)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"20px", padding:"40px 36px", boxShadow:"0 40px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:"10%", right:"10%", height:"1px", background:"linear-gradient(90deg,transparent,rgba(20,184,196,0.55),rgba(92,111,224,0.4),transparent)" }} />

          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"32px" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:"linear-gradient(135deg,#14b8c8,#5c6fe0)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 18px rgba(20,184,196,0.4)", fontSize:"15px" }}>🔒</div>
            <div>
              <div style={{ fontSize:"15px", fontWeight:"800", color:"#eef0ff", letterSpacing:"-0.02em" }}>WhiteRoom</div>
              <div style={{ fontSize:"9px", color:"#2e3b5e", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em" }}>E2E ENCRYPTED</div>
            </div>
          </div>

          <h1 style={{ fontSize:"28px", fontWeight:"800", color:"#eef0ff", letterSpacing:"-0.04em", lineHeight:1.05, marginBottom:"6px" }}>
            Join a<br /><span style={{ background:"linear-gradient(90deg,#4dd9dc,#7c8fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>room.</span>
          </h1>
          <p style={{ fontSize:"12px", color:"#2e3b5e", fontFamily:"'JetBrains Mono',monospace", fontWeight:"300", marginBottom:"28px" }}>Enter the room code shared with you to join</p>

          <div style={{ marginBottom:"16px" }}>
            <label style={{ display:"block", fontSize:"10px", fontWeight:"600", color:"#2e3b5e", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"6px", fontFamily:"'JetBrains Mono',monospace" }}>Room Code</label>
            <div style={{ position:"relative" }}>
              <Hash size={14} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#1d2540", pointerEvents:"none" }} />
              <input type="text" placeholder="team-standup-01" value={roomId} onChange={e=>setRoomId(e.target.value)} onFocus={fi} onBlur={bi} onKeyDown={e=>e.key==="Enter"&&handleJoin()}
                style={{ width:"100%", padding:"12px 14px 12px 34px", borderRadius:"11px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", color:"#c8cde8", fontSize:"14px", outline:"none", fontFamily:"'JetBrains Mono',monospace", transition:"all 0.2s", boxSizing:"border-box" }} />
            </div>
          </div>

          {error && <div style={{ padding:"10px 14px", borderRadius:"10px", marginBottom:"14px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:"12px", color:"#f87171", fontFamily:"'JetBrains Mono',monospace" }}>{error}</div>}

          <button onClick={handleJoin} disabled={loading||!roomId.trim()} style={{ width:"100%", padding:"14px 20px", borderRadius:"12px", border:"none", background:(loading||!roomId.trim())?"rgba(20,184,196,0.18)":"linear-gradient(135deg,#14b8c8,#0a8f9e)", color:(loading||!roomId.trim())?"#2e3b5e":"white", fontSize:"14px", fontWeight:"700", cursor:(loading||!roomId.trim())?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", boxShadow:(loading||!roomId.trim())?"none":"0 8px 28px rgba(20,184,196,0.32)", transition:"all 0.2s", fontFamily:"inherit", letterSpacing:"-0.01em" }}
            onMouseEnter={e=>{ if(!loading&&roomId.trim()){e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 14px 36px rgba(20,184,196,0.48)";} }}
            onMouseLeave={e=>{ e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=(loading||!roomId.trim())?"none":"0 8px 28px rgba(20,184,196,0.32)"; }}>
            {loading?<><div style={{ width:"16px", height:"16px", borderRadius:"50%", border:"2px solid rgba(255,255,255,0.25)", borderTopColor:"white", animation:"spin 0.7s linear infinite" }} />Joining…</>:<>Join Room <ArrowRight size={15} /></>}
          </button>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"18px", flexWrap:"wrap", gap:"8px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
              <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#10b981", boxShadow:"0 0 5px #10b981" }} />
              <span style={{ fontSize:"10px", color:"#1e3a30", fontFamily:"'JetBrains Mono',monospace" }}>END-TO-END ENCRYPTED</span>
            </div>
            <a href="/create" style={{ fontSize:"11px", color:"#2e3b5e", textDecoration:"none", fontFamily:"'JetBrains Mono',monospace", borderBottom:"1px solid rgba(46,59,94,0.35)", paddingBottom:"1px", transition:"color 0.2s" }}
              onMouseEnter={e=>e.target.style.color="#4dd9dc"} onMouseLeave={e=>e.target.style.color="#2e3b5e"}>
              ← Create a new room
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}