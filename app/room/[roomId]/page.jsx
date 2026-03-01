"use client";
import { generateRoomKey, exportKey, importKey, encrypt, decrypt, generateRSAKeyPair, exportPublicKey, importPublicKey, encryptWithPublicKey, decryptWithPrivateKey } from "@/lib/crypto";
import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import dynamic from "next/dynamic";
const WhiteboardPanel = dynamic(() => import("@/components/WhiteboardPanel").then(m => m.WhiteboardPanel), { ssr: false });
const DocsPanel = dynamic(() => import("@/components/DocsPanel").then(m => m.DocsPanel), { ssr: false });
import { Send, Users, Shield, Lock, MessageSquare, X, Minimize2, Video, Mic, MicOff, VideoOff, PhoneOff, PenLine, Monitor, FileText } from 'lucide-react';

export default function Room() {
  const { roomId } = useParams();

  // ── UI state ──
  const [connected, setConnected]       = useState(false);
  const [role, setRole]                 = useState(null);
  const [msg, setMsg]                   = useState("");
  const [users, setUsers]               = useState([]);
  const [messages, setMessages]         = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});   // { [socketId]: MediaStream }
  const [allPeerIds, setAllPeerIds]     = useState([]);    // every remote socket id
  const [isChatOpen, setIsChatOpen]     = useState(true);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isMicOn, setIsMicOn]           = useState(true);
  const [isCameraOn, setIsCameraOn]     = useState(true);
  const [view, setView]                 = useState("video");

  // ── Stable refs (never stale) ──
  const roomIdRef          = useRef(roomId);
  const localStreamRef     = useRef(null);
  const localVideoRef      = useRef(null);
  const roleRef            = useRef(null);
  const pcsRef             = useRef({});    // { [peerId]: RTCPeerConnection }
  const dcsRef             = useRef({});    // { [peerId]: RTCDataChannel }
  const roomKeysRef        = useRef({});
  const rsaKeysRef         = useRef({});
  const peerPubKeysRef     = useRef({});
  const pendingIceRef      = useRef({});
  const ydocRef            = useRef(null);
  const awarenessRef       = useRef(null);

  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // ══════════════════════════════════════════
  //  MEDIA
  // ══════════════════════════════════════════
  const getMedia = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) localVideoRef.current.srcObject = s;
      console.log("[media] got stream tracks:", s.getTracks().map(t => t.kind));
      return s;
    } catch (e) {
      console.warn("[media] failed:", e.message);
      return null;
    }
  };

  // ══════════════════════════════════════════
  //  CREATE RTCPeerConnection  (full-mesh)
  // ══════════════════════════════════════════
  const makePc = async (peerId) => {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    let iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const r = await fetch("/api/turn");
      if (r.ok) iceServers = await r.json();
    } catch {}

    const pc = new RTCPeerConnection({ iceServers });
    pcsRef.current[peerId] = pc;

    // Add every local track immediately
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => {
        pc.addTrack(t, stream);
        console.log(`[pc:${peerId}] addTrack ${t.kind}`);
      });
    }

    pc.ontrack = ({ track, streams }) => {
      console.log(`[pc:${peerId}] ✅ ontrack ${track.kind}`);
      setRemoteStreams(prev => {
        const ms = prev[peerId] ?? new MediaStream();
        if (!ms.getTracks().find(t => t.id === track.id)) ms.addTrack(track);
        return { ...prev, [peerId]: ms };
      });
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("ice-candidate", { roomId: roomIdRef.current, candidate, targetId: peerId });
      }
    };

    pc.oniceconnectionstatechange = () => console.log(`[pc:${peerId}] ICE: ${pc.iceConnectionState}`);
    pc.onconnectionstatechange    = () => console.log(`[pc:${peerId}] PC:  ${pc.connectionState}`);

    pc.ondatachannel = ({ channel }) => {
      dcsRef.current[peerId] = channel;
      bindDc(channel, peerId);
    };

    // Show tile immediately (amber = connecting, green = has video)
    setAllPeerIds(prev => prev.includes(peerId) ? prev : [...prev, peerId]);
    return pc;
  };

  // ══════════════════════════════════════════
  //  DATA CHANNEL
  // ══════════════════════════════════════════
  const bindDc = (channel, peerId) => {
    channel.onopen = async () => {
      console.log(`[dc:${peerId}] open`);
      roomKeysRef.current[peerId]    = await generateRoomKey();
      rsaKeysRef.current[peerId]     = await generateRSAKeyPair();
      const pub = await exportPublicKey(rsaKeysRef.current[peerId].publicKey);
      sendTo(peerId, "control", { action: "PUBLIC_KEY", key: pub });
      broadcastAwareness();
    };
    channel.onmessage = e => onDcMessage(e.data, peerId);
    channel.onclose   = () => console.warn(`[dc:${peerId}] closed`);
    channel.onerror   = e => console.error(`[dc:${peerId}] error`, e);
  };

  const sendTo = (peerId, type, payload) => {
    const ch = dcsRef.current[peerId];
    if (!ch || ch.readyState !== "open") return;
    ch.send(JSON.stringify({ type, payload, ts: Date.now() }));
  };

  const broadcast = (type, payload) => Object.keys(dcsRef.current).forEach(id => sendTo(id, type, payload));

  // ══════════════════════════════════════════
  //  AWARENESS
  // ══════════════════════════════════════════
  const broadcastAwareness = () => {
    if (!awarenessRef.current || !ydocRef.current) return;
    const state = awarenessRef.current.getLocalState();
    if (state) broadcast("awareness", { clientId: ydocRef.current.clientID, state });
  };

  // ══════════════════════════════════════════
  //  DC MESSAGE HANDLER
  // ══════════════════════════════════════════
  const onDcMessage = async (raw, peerId) => {
    const msg = JSON.parse(raw);
    const key = roomKeysRef.current[peerId];

    switch (msg.type) {
      case "chat": {
        if (!key) return;
        try {
          const d = await decrypt(key, msg.payload);
          setMessages(prev => [...prev, { sender: d.sender, text: d.text, timestamp: msg.ts }]);
        } catch (e) { console.error("chat decrypt", e); }
        break;
      }
      case "control": {
        if (msg.payload.action === "PUBLIC_KEY") {
          peerPubKeysRef.current[peerId] = await importPublicKey(msg.payload.key);
          if (socket.id < peerId) {
            const raw = await exportKey(roomKeysRef.current[peerId]);
            const enc = await encryptWithPublicKey(peerPubKeysRef.current[peerId], raw);
            sendTo(peerId, "control", { action: "SET_KEY_SECURE", key: enc });
          }
        }
        if (msg.payload.action === "SET_KEY_SECURE") {
          const raw = await decryptWithPrivateKey(rsaKeysRef.current[peerId].privateKey, msg.payload.key);
          roomKeysRef.current[peerId] = await importKey(raw);
          broadcastAwareness();
        }
        break;
      }
      case "awareness": {
        const { clientId, state } = msg.payload;
        if (!awarenessRef.current) break;
        awarenessRef.current.states.set(clientId, state);
        setUsers(Array.from(awarenessRef.current.states.entries()).map(([id, s]) => ({
          clientId: id, role: s.user?.role ?? "?", name: s.user?.name ?? "?",
          color: s.user?.color ?? "#a78bfa", isLocal: id === ydocRef.current?.clientID,
        })));
        break;
      }
      case "whiteboard-update": {
        if (ydocRef.current?._whiteboardApply) await ydocRef.current._whiteboardApply(msg.payload);
        break;
      }
      case "yjs-update": {
        if (!key) return;
        try {
          const d = await decrypt(key, msg.payload);
          Y.applyUpdate(ydocRef.current, new Uint8Array(d), "remote");
        } catch {}
        break;
      }
    }
  };

  // ══════════════════════════════════════════
  //  YJS
  // ══════════════════════════════════════════
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;
    awareness.setLocalState({ user: { role: "connecting", name: "connecting" }, cursor: null });
    setUsers([{ clientId: ydoc.clientID, role: "connecting", name: "connecting", color: "#a78bfa", isLocal: true }]);
    ydoc.on("update", async (update, origin) => {
      if (origin === "remote") return;
      for (const id of Object.keys(dcsRef.current)) {
        const k = roomKeysRef.current[id];
        if (k) sendTo(id, "yjs-update", await encrypt(k, Array.from(update)));
      }
    });
    return () => { awareness.destroy(); ydoc.destroy(); };
  }, []);

  // ══════════════════════════════════════════
  //  SOCKET / SIGNALING  — full mesh
  // ══════════════════════════════════════════
  useEffect(() => {
    if (!roomId) return;

    // ── helpers that are always fresh because they close over refs, not state ──

    const addTracksTo = (pc) => {
      const s = localStreamRef.current;
      if (!s) return;
      const senders = pc.getSenders();
      s.getTracks().forEach(t => {
        if (!senders.find(sx => sx.track?.id === t.id)) {
          pc.addTrack(t, s);
          console.log(`[signaling] late-addTrack ${t.kind}`);
        }
      });
    };

    // ── New joiner: server sends us the full list of existing peers ──
    const onRoomPeers = async ({ peers }) => {
      console.log("[signaling] room-peers:", peers);
      await getMedia();
      for (const peerId of peers) {
        const pc = await makePc(peerId);
        addTracksTo(pc);
        // We are the OFFERER for every existing peer
        const dc = pc.createDataChannel("chat");
        dcsRef.current[peerId] = dc;
        bindDc(dc, peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`[signaling] → offer to ${peerId}`);
        socket.emit("offer", { roomId, offer, targetId: peerId });
      }
    };

    // ── Existing peer: someone new joined, they will offer us shortly ──
    const onPeerJoined = async ({ peerId }) => {
      console.log(`[signaling] peer-joined: ${peerId}`);
      await getMedia(); // warm up so we can addTrack in onOffer
    };

    // ── We receive an offer → answer it ──
    const onOffer = async ({ offer, fromId }) => {
      console.log(`[signaling] ← offer from ${fromId}`);
      await getMedia();

      // Clean up any stale PC in a bad state
      const existing = pcsRef.current[fromId];
      if (existing && existing.signalingState !== "stable") {
        console.log(`[signaling] closing stale PC for ${fromId} (was ${existing.signalingState})`);
        existing.close();
        delete pcsRef.current[fromId];
      }

      const pc = await makePc(fromId);
      addTracksTo(pc);

      await pc.setRemoteDescription(offer);

      // Flush buffered ICE candidates
      for (const c of (pendingIceRef.current[fromId] ?? [])) {
        await pc.addIceCandidate(c).catch(() => {});
      }
      pendingIceRef.current[fromId] = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log(`[signaling] → answer to ${fromId}`);
      socket.emit("answer", { roomId, answer, targetId: fromId });
    };

    // ── We receive an answer to our offer ──
    const onAnswer = async ({ answer, fromId }) => {
      console.log(`[signaling] ← answer from ${fromId}`);
      const pc = pcsRef.current[fromId];
      if (!pc) return console.warn(`[signaling] no PC for ${fromId}`);
      if (pc.signalingState !== "have-local-offer") return console.warn(`[signaling] wrong state ${pc.signalingState}`);
      await pc.setRemoteDescription(answer);
      for (const c of (pendingIceRef.current[fromId] ?? [])) {
        await pc.addIceCandidate(c).catch(() => {});
      }
      pendingIceRef.current[fromId] = [];
    };

    // ── ICE candidate ──
    const onIce = async ({ candidate, fromId }) => {
      const pc = pcsRef.current[fromId];
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(candidate).catch(() => {});
      } else {
        if (!pendingIceRef.current[fromId]) pendingIceRef.current[fromId] = [];
        pendingIceRef.current[fromId].push(candidate);
      }
    };

    // ── Peer left ──
    const onPeerLeft = ({ peerId }) => {
      console.log(`[signaling] peer-left: ${peerId}`);
      pcsRef.current[peerId]?.close();
      delete pcsRef.current[peerId];
      delete dcsRef.current[peerId];
      delete roomKeysRef.current[peerId];
      setRemoteStreams(p => { const n = { ...p }; delete n[peerId]; return n; });
      setAllPeerIds(p => p.filter(id => id !== peerId));
    };

    // ── Role ──
    const onRole = ({ role }) => {
      roleRef.current = role;
      setRole(role);
      if (awarenessRef.current) {
        const cur = awarenessRef.current.getLocalState() ?? {};
        awarenessRef.current.setLocalState({ ...cur, user: { role, name: role } });
      }
      setUsers(p => p.map(u => u.isLocal ? { ...u, role, name: role } : u));
    };

    // ── Connect & join ──
    const onConnect = () => {
      console.log("[signaling] connected, joining room:", roomId);
      setConnected(true);
      socket.emit("join-room", roomId);
    };

    // Register ALL listeners before connecting
    socket.on("connect",      onConnect);
    socket.on("role",         onRole);
    socket.on("room-peers",   onRoomPeers);
    socket.on("peer-joined",  onPeerJoined);
    socket.on("offer",        onOffer);
    socket.on("answer",       onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("peer-left",    onPeerLeft);

    if (socket.connected) {
      // Already connected (e.g. hot reload)
      setConnected(true);
      socket.emit("join-room", roomId);
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect",      onConnect);
      socket.off("role",         onRole);
      socket.off("room-peers",   onRoomPeers);
      socket.off("peer-joined",  onPeerJoined);
      socket.off("offer",        onOffer);
      socket.off("answer",       onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("peer-left",    onPeerLeft);
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      dcsRef.current = {};
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
  }, [roomId]);

  // Re-attach local video when switching views
  useEffect(() => {
    if (view === "video" && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [view]);

  // ══════════════════════════════════════════
  //  HANDLERS
  // ══════════════════════════════════════════
  const sendEncryptedChat = async (text) => {
    const message = { text, sender: roleRef.current ?? "?", timestamp: Date.now() };
    setMessages(p => [...p, message]);
    for (const id of Object.keys(dcsRef.current)) {
      const k = roomKeysRef.current[id];
      if (k) sendTo(id, "chat", await encrypt(k, message));
    }
  };

  const handleSend      = () => { sendEncryptedChat(msg); setMsg(""); };
  const handleKeyDown   = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const toggleMic       = () => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMicOn; }); setIsMicOn(v => !v); };
  const toggleCamera    = () => { localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !isCameraOn; }); setIsCameraOn(v => !v); };
  const sendWbMsg       = useCallback((type, payload) => broadcast(type, payload), []);

  // ── Grid layout ──
  const totalTiles = 1 + allPeerIds.length;
  const cols = totalTiles === 1 ? 1 : totalTiles <= 4 ? 2 : 3;
  const rows = totalTiles === 1 ? 1 : totalTiles <= 2 ? 1 : totalTiles <= 4 ? 2 : Math.ceil(totalTiles / 3);

  // ══════════════════════════════════════════
  //  STYLES
  // ══════════════════════════════════════════
  const S = {
    outer:   { minHeight: "100vh", background: "linear-gradient(135deg,#0a0a0f,#0d1117 40%,#0a0e1a)", fontFamily: "'DM Sans',system-ui,sans-serif", color: "#e2e8f0", display: "flex", flexDirection: "column" },
    glow:    { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 80% 50% at 20% 20%,rgba(99,102,241,.07),transparent 60%),radial-gradient(ellipse 60% 40% at 80% 80%,rgba(20,184,166,.06),transparent 60%)" },
    layout:  { width: "100%", height: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, padding: "12px" },
    header:  { background: "rgba(15,17,26,.85)", backdropFilter: "blur(24px)", borderRadius: "16px 16px 0 0", border: "1px solid rgba(99,102,241,.15)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", boxShadow: "0 4px 24px rgba(0,0,0,.4)" },
    logoBox: { width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(99,102,241,.4)" },
    main:    { flex: 1, background: "rgba(10,10,15,.6)", backdropFilter: "blur(12px)", borderLeft: "1px solid rgba(99,102,241,.1)", borderRight: "1px solid rgba(99,102,241,.1)", overflow: "hidden", position: "relative" },
    footer:  { background: "rgba(15,17,26,.85)", backdropFilter: "blur(24px)", borderRadius: "0 0 16px 16px", border: "1px solid rgba(99,102,241,.15)", borderTop: "1px solid rgba(99,102,241,.1)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", boxShadow: "0 -4px 24px rgba(0,0,0,.3)" },
    tile:    { position: "relative", borderRadius: "14px", overflow: "hidden", minHeight: 0 },
  };

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════
  return (
    <div style={S.outer}>
      <div style={S.glow} />
      <div style={S.layout}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={S.logoBox}><Lock className="w-4 h-4" style={{ color:"white" }} /></div>
            <div>
              <h1 style={{ fontSize:"15px", fontWeight:"700", color:"#f1f5f9", margin:0 }}>WhiteRoom</h1>
              <p style={{ fontSize:"11px", color:"#64748b", margin:0, fontFamily:"monospace" }}>{roomId}</p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"8px", background: connected ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", border:"1px solid "+(connected ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)") }}>
              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background: connected ? "#10b981" : "#ef4444", boxShadow: connected ? "0 0 6px #10b981" : "none" }} />
              <span style={{ fontSize:"12px", fontWeight:"600", color: connected ? "#10b981" : "#ef4444" }}>{connected ? "Live" : "Offline"}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"8px", background:"rgba(99,102,241,.1)", border:"1px solid rgba(99,102,241,.25)" }}>
              <Shield className="w-3 h-3" style={{ color:"#818cf8" }} />
              <span style={{ fontSize:"12px", fontWeight:"600", color:"#818cf8", textTransform:"capitalize" }}>{role}</span>
            </div>
            <div style={{ display:"flex", borderRadius:"10px", overflow:"hidden", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)" }}>
              <button onClick={() => setView("video")} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"600", background: view==="video" ? "rgba(99,102,241,.25)" : "transparent", color: view==="video" ? "#818cf8" : "#64748b" }}>
                <Monitor className="w-3.5 h-3.5" /> Video
              </button>
              <button onClick={() => setView("whiteboard")} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"600", background: view==="whiteboard" ? "rgba(20,184,166,.2)" : "transparent", color: view==="whiteboard" ? "#14b8a6" : "#64748b" }}>
                <PenLine className="w-3.5 h-3.5" /> Board
              </button>
              <button onClick={() => setView("docs")} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"600", background: view==="docs" ? "rgba(201,168,76,.2)" : "transparent", color: view==="docs" ? "#c9a84c" : "#64748b" }}>
                <FileText className="w-3.5 h-3.5" /> Docs
              </button>
            </div>
            <button onClick={() => { setIsChatOpen(!isChatOpen); setIsChatMinimized(false); }} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", borderRadius:"8px", border:"1px solid rgba(255,255,255,.08)", background: isChatOpen ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.04)", color: isChatOpen ? "#818cf8" : "#64748b", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}>
              <MessageSquare className="w-3.5 h-3.5" />{isChatOpen ? "Hide Chat" : "Chat"}
            </button>
          </div>
        </div>

        {/* ── Main ── */}
        <div style={S.main}>

          {/* Video grid */}
          <div style={{ position:"absolute", inset:0, padding:"10px", display: view==="video" ? "grid" : "none", gap:"10px", gridTemplateColumns:`repeat(${cols},1fr)`, gridTemplateRows:`repeat(${rows},1fr)` }}>

            {/* Local tile */}
            <div style={{ ...S.tile, background:"linear-gradient(135deg,#1e1b4b,#1e293b)", border:"1px solid rgba(99,102,241,.25)", boxShadow:"0 8px 32px rgba(0,0,0,.5)" }}>
              <video ref={localVideoRef} autoPlay muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              {!isCameraOn && (
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"8px", background:"linear-gradient(135deg,#1e1b4b,#1e293b)" }}>
                  <VideoOff className="w-8 h-8" style={{ color:"#818cf8", opacity:.5 }} />
                  <span style={{ fontSize:"11px", color:"#64748b" }}>Camera off</span>
                </div>
              )}
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(0,0,0,.6),transparent 45%)", pointerEvents:"none" }} />
              <div style={{ position:"absolute", bottom:"10px", left:"10px", background:"rgba(0,0,0,.55)", backdropFilter:"blur(8px)", padding:"4px 10px", borderRadius:"20px", border:"1px solid rgba(255,255,255,.1)" }}>
                <span style={{ fontSize:"11px", fontWeight:"600", color:"#e2e8f0" }}>You · {role}</span>
              </div>
              <div style={{ position:"absolute", top:"10px", right:"10px" }}>
                <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#10b981", boxShadow:"0 0 6px #10b981" }} />
              </div>
            </div>

            {/* Remote tiles */}
            {allPeerIds.map((peerId, idx) => {
              const stream = remoteStreams[peerId];
              return (
                <div key={peerId} style={{ ...S.tile, background:"linear-gradient(135deg,#0f2a2a,#1e293b)", border:"1px solid rgba(20,184,166,.2)", boxShadow:"0 8px 32px rgba(0,0,0,.5)" }}>
                  <video autoPlay playsInline
                    ref={el => { if (el && stream && el.srcObject !== stream) el.srcObject = stream; }}
                    style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                  />
                  {!stream && (
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"8px", background:"linear-gradient(135deg,#0f2a2a,#1e293b)" }}>
                      <VideoOff className="w-8 h-8" style={{ color:"#14b8a6", opacity:.5 }} />
                      <span style={{ fontSize:"12px", color:"#64748b" }}>Connecting…</span>
                    </div>
                  )}
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(0,0,0,.6),transparent 45%)", pointerEvents:"none" }} />
                  <div style={{ position:"absolute", bottom:"10px", left:"10px", background:"rgba(0,0,0,.55)", backdropFilter:"blur(8px)", padding:"4px 10px", borderRadius:"20px", border:"1px solid rgba(255,255,255,.1)" }}>
                    <span style={{ fontSize:"11px", fontWeight:"600", color:"#e2e8f0" }}>Peer {idx+1}</span>
                  </div>
                  <div style={{ position:"absolute", top:"10px", right:"10px" }}>
                    <div style={{ width:"7px", height:"7px", borderRadius:"50%", background: stream ? "#10b981" : "#f59e0b", boxShadow: stream ? "0 0 6px #10b981" : "0 0 6px #f59e0b" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Whiteboard */}
          <div style={{ position:"absolute", inset:0, zIndex:2, display: view==="whiteboard" ? "block" : "none" }}>
            <WhiteboardPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users} />
          </div>

          {/* Docs */}
          <div style={{ position:"absolute", inset:0, zIndex:2, display: view==="docs" ? "block" : "none" }}>
            <DocsPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users} localName={users.find(u=>u.isLocal)?.name ?? "You"} localColor={users.find(u=>u.isLocal)?.color ?? "#c9a84c"} />
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <button onClick={toggleMic} style={{ width:"48px", height:"48px", borderRadius:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", background: isMicOn ? "rgba(255,255,255,.07)" : "rgba(239,68,68,.2)", border:"1px solid "+(isMicOn ? "rgba(255,255,255,.1)" : "rgba(239,68,68,.4)"), color: isMicOn ? "#94a3b8" : "#ef4444" }}>
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button onClick={toggleCamera} style={{ width:"48px", height:"48px", borderRadius:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", background: isCameraOn ? "rgba(255,255,255,.07)" : "rgba(239,68,68,.2)", border:"1px solid "+(isCameraOn ? "rgba(255,255,255,.1)" : "rgba(239,68,68,.4)"), color: isCameraOn ? "#94a3b8" : "#ef4444" }}>
            {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
          <button style={{ width:"52px", height:"52px", borderRadius:"14px", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"white", boxShadow:"0 4px 16px rgba(239,68,68,.35)" }}>
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* ── Floating Chat ── */}
      {isChatOpen && (
        <div style={{ position:"fixed", bottom:"20px", right:"20px", zIndex:50 }}>
          {isChatMinimized ? (
            <button onClick={() => setIsChatMinimized(false)} style={{ position:"relative", width:"52px", height:"52px", borderRadius:"16px", background:"linear-gradient(135deg,#6366f1,#4f46e5)", border:"1px solid rgba(99,102,241,.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 8px 24px rgba(99,102,241,.35)", color:"white" }}>
              <MessageSquare className="w-5 h-5" />
              {messages.length > 0 && <span style={{ position:"absolute", top:"-6px", right:"-6px", background:"#14b8a6", color:"white", fontSize:"10px", fontWeight:"700", width:"18px", height:"18px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #0a0a0f" }}>{messages.length}</span>}
            </button>
          ) : (
            <div style={{ width:"360px", height:"580px", background:"rgba(13,15,23,.95)", backdropFilter:"blur(24px)", borderRadius:"20px", border:"1px solid rgba(99,102,241,.2)", boxShadow:"0 24px 64px rgba(0,0,0,.6)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ padding:"16px 18px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(99,102,241,.08)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"linear-gradient(135deg,#6366f1,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <MessageSquare className="w-3.5 h-3.5" style={{ color:"white" }} />
                  </div>
                  <span style={{ fontSize:"14px", fontWeight:"700", color:"#f1f5f9" }}>Messages</span>
                </div>
                <div style={{ display:"flex", gap:"4px" }}>
                  <button onClick={() => setIsChatMinimized(true)} style={{ width:"28px", height:"28px", borderRadius:"8px", border:"none", background:"rgba(255,255,255,.06)", color:"#64748b", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Minimize2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setIsChatOpen(false)} style={{ width:"28px", height:"28px", borderRadius:"8px", border:"none", background:"rgba(255,255,255,.06)", color:"#64748b", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,.05)", background:"rgba(255,255,255,.02)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"8px" }}>
                  <Users className="w-3.5 h-3.5" style={{ color:"#475569" }} />
                  <span style={{ fontSize:"11px", fontWeight:"600", color:"#475569", textTransform:"uppercase", letterSpacing:".06em" }}>In Room</span>
                  <span style={{ marginLeft:"auto", fontSize:"11px", fontWeight:"700", color:"#6366f1", background:"rgba(99,102,241,.15)", padding:"1px 8px", borderRadius:"10px", border:"1px solid rgba(99,102,241,.2)" }}>{users.length}</span>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                  {users.map((u, i) => (
                    <div key={u.clientId ?? i} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 10px", borderRadius:"8px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)" }}>
                      <div style={{ width:"20px", height:"20px", borderRadius:"6px", background: u.color ?? "#6366f1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"700", color:"white" }}>{(u.role ?? "?").charAt(0).toUpperCase()}</div>
                      <span style={{ fontSize:"12px", fontWeight:"500", color:"#94a3b8" }}>{u.role}{u.isLocal ? " (you)" : ""}</span>
                      <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#10b981", boxShadow:"0 0 4px #10b981" }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:"10px" }}>
                {messages.length === 0 && (
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"8px", opacity:.4 }}>
                    <MessageSquare className="w-8 h-8" style={{ color:"#475569" }} />
                    <span style={{ fontSize:"12px", color:"#475569" }}>No messages yet</span>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display:"flex", justifyContent: m.sender===role ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth:"80%", padding:"8px 12px", borderRadius: m.sender===role ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: m.sender===role ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "rgba(255,255,255,.06)", border: m.sender===role ? "none" : "1px solid rgba(255,255,255,.08)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
                        <span style={{ fontSize:"11px", fontWeight:"600", color: m.sender===role ? "rgba(255,255,255,.7)" : "#6366f1" }}>{m.sender}</span>
                        <span style={{ fontSize:"10px", color: m.sender===role ? "rgba(255,255,255,.4)" : "#475569" }}>{new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <p style={{ fontSize:"13px", margin:0, color: m.sender===role ? "white" : "#e2e8f0", lineHeight:1.4 }}>{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"12px 14px", borderTop:"1px solid rgba(255,255,255,.06)", background:"rgba(255,255,255,.02)" }}>
                <div style={{ display:"flex", gap:"8px" }}>
                  <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={handleKeyDown} placeholder="Send a message…" style={{ flex:1, padding:"9px 14px", borderRadius:"10px", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)", color:"#e2e8f0", fontSize:"13px", outline:"none", fontFamily:"inherit" }} />
                  <button onClick={handleSend} disabled={!msg.trim()} style={{ width:"38px", height:"38px", borderRadius:"10px", border:"none", background: msg.trim() ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "rgba(255,255,255,.05)", color: msg.trim() ? "white" : "#475569", cursor: msg.trim() ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"8px" }}>
                  <Lock className="w-3 h-3" style={{ color:"#10b981" }} />
                  <span style={{ fontSize:"10px", color:"#475569" }}>End-to-end encrypted</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}