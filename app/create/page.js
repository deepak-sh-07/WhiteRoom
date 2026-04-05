"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";

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
      [{ x: W*0.3+Math.sin(t*0.8)*55, y: H*0.35+Math.cos(t*0.6)*40, r: 260, c:"rgba(60,80,200,0.09)" }, { x: W*0.72+Math.sin(t*0.5+1)*50, y: H*0.6+Math.cos(t*0.7)*35, r: 220, c:"rgba(20,140,160,0.07)" }].forEach(o => {
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

export default function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  const create = async () => {
    if (!name.trim() || !roomCode.trim()) { setError("Please fill in both fields."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name, room_code: roomCode }) });
      if (res.status === 200) router.push(`/room/${roomCode}`);
      else setError("Failed to create room. Try again.");
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const fi = e => { e.target.style.borderColor="rgba(92,111,224,0.5)"; e.target.style.background="rgba(255,255,255,0.06)"; e.target.style.boxShadow="0 0 0 3px rgba(92,111,224,0.08)"; };
  const bi = e => { e.target.style.borderColor="rgba(255,255,255,0.07)"; e.target.style.background="rgba(255,255,255,0.04)"; e.target.style.boxShadow="none"; };

  const input = { width:"100%", padding:"12px 14px", borderRadius:"11px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", color:"#c8cde8", fontSize:"14px", outline:"none", fontFamily:"'JetBrains Mono',monospace", transition:"all 0.2s", boxSizing:"border-box" };
  const label = { display:"block", fontSize:"10px", fontWeight:"600", color:"#2e3b5e", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"6px", fontFamily:"'JetBrains Mono',monospace" };

  return (
    <div style={{ minHeight:"100vh", background:"#04050d", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
      <OrbCanvas />
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:"400px", padding:"0 20px", opacity:visible?1:0, transform:visible?"translateY(0)":"translateY(28px)", transition:"all 0.75s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ background:"rgba(6,8,18,0.92)", backdropFilter:"blur(40px) saturate(160%)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"20px", padding:"40px 36px", boxShadow:"0 40px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:"10%", right:"10%", height:"1px", background:"linear-gradient(90deg,transparent,rgba(92,111,224,0.55),rgba(20,184,200,0.4),transparent)" }} />

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"32px" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:"linear-gradient(135deg,#5c6fe0,#14b8c8)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 18px rgba(92,111,224,0.4)", fontSize:"15px" }}>🔒</div>
            <div>
              <div style={{ fontSize:"15px", fontWeight:"800", color:"#eef0ff", letterSpacing:"-0.02em" }}>WhiteRoom</div>
              <div style={{ fontSize:"9px", color:"#2e3b5e", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em" }}>E2E ENCRYPTED</div>
            </div>
          </div>

          <h1 style={{ fontSize:"28px", fontWeight:"800", color:"#eef0ff", letterSpacing:"-0.04em", lineHeight:1.05, marginBottom:"6px" }}>
            Start a<br /><span style={{ background:"linear-gradient(90deg,#7c8fff,#4dd9dc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>session.</span>
          </h1>
          <p style={{ fontSize:"12px", color:"#2e3b5e", fontFamily:"'JetBrains Mono',monospace", fontWeight:"300", marginBottom:"28px" }}>Create a new encrypted room instantly</p>

          <div style={{ display:"flex", flexDirection:"column", gap:"14px", marginBottom:"18px" }}>
            <div><label style={label}>Your Name</label>
              <input style={input} type="text" placeholder="Alex Johnson" value={name} onChange={e=>setName(e.target.value)} onFocus={fi} onBlur={bi} onKeyDown={e=>e.key==="Enter"&&create()} /></div>
            <div><label style={label}>Room Code</label>
              <input style={{ ...input, fontFamily:"'JetBrains Mono',monospace" }} type="text" placeholder="e.g. design-sync-01" value={roomCode} onChange={e=>setRoomCode(e.target.value)} onFocus={fi} onBlur={bi} onKeyDown={e=>e.key==="Enter"&&create()} /></div>
          </div>

          {error && <div style={{ padding:"10px 14px", borderRadius:"10px", marginBottom:"14px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:"12px", color:"#f87171", fontFamily:"'JetBrains Mono',monospace" }}>{error}</div>}

          <button onClick={create} disabled={loading} style={{ width:"100%", padding:"14px 20px", borderRadius:"12px", border:"none", background: loading?"rgba(92,111,224,0.25)":"linear-gradient(135deg,#5c6fe0,#3a4fc8)", color:"white", fontSize:"14px", fontWeight:"700", cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", boxShadow:loading?"none":"0 8px 28px rgba(92,111,224,0.38)", transition:"all 0.2s", fontFamily:"inherit", letterSpacing:"-0.01em" }}
            onMouseEnter={e=>{ if(!loading){e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 14px 36px rgba(92,111,224,0.52)";} }}
            onMouseLeave={e=>{ e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=loading?"none":"0 8px 28px rgba(92,111,224,0.38)"; }}>
            {loading?<><div style={{ width:"16px", height:"16px", borderRadius:"50%", border:"2px solid rgba(255,255,255,0.25)", borderTopColor:"white", animation:"spin 0.7s linear infinite" }} />Connecting…</>:<>Enter Room <ArrowRight size={15} /></>}
          </button>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"18px", flexWrap:"wrap", gap:"8px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
              <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#10b981", boxShadow:"0 0 5px #10b981" }} />
              <span style={{ fontSize:"10px", color:"#1e3a30", fontFamily:"'JetBrains Mono',monospace" }}>END-TO-END ENCRYPTED</span>
            </div>
            <a href="/join" style={{ fontSize:"11px", color:"#2e3b5e", textDecoration:"none", fontFamily:"'JetBrains Mono',monospace", borderBottom:"1px solid rgba(46,59,94,0.35)", paddingBottom:"1px", transition:"color 0.2s" }}
              onMouseEnter={e=>e.target.style.color="#7c8fff"} onMouseLeave={e=>e.target.style.color="#2e3b5e"}>
              Join existing →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}