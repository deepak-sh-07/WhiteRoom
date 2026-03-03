"use client";
import { generateRoomKey, exportKey, importKey, encrypt, decrypt, generateRSAKeyPair, exportPublicKey, importPublicKey, encryptWithPublicKey, decryptWithPrivateKey } from "@/lib/crypto";
import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Lock, Shield, MessageSquare } from 'lucide-react';
const WhiteboardPanel = dynamic(() => import("@/components/WhiteboardPanel").then(m => m.WhiteboardPanel), { ssr: false });
const DocsPanel = dynamic(() => import("@/components/DocsPanel").then(m => m.DocsPanel), { ssr: false });

// ── New design-system components ──
import StatusBadge   from "@/components/StatusBadge";
import ViewSwitcher  from "@/components/ViewSwitcher";
import VideoTile     from "@/components/VideoTile";
import ControlBar    from "@/components/ControlBar";
import ChatPanel     from "@/components/ChatPanel";

export default function Room() {
  const { roomId } = useParams();

  // ── UI state ──
  const [connected, setConnected]       = useState(false);
  const [role, setRole]                 = useState(null);
  const [msg, setMsg]                   = useState("");
  const [users, setUsers]               = useState([]);
  const [messages, setMessages]         = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [allPeerIds, setAllPeerIds]     = useState([]);
  const [isChatOpen, setIsChatOpen]     = useState(true);
  const [isMicOn, setIsMicOn]           = useState(true);
  const [isCameraOn, setIsCameraOn]     = useState(true);
  const [view, setView] = useState("video"); // "video" | "whiteboard" | "docs"

  // ── Stable refs (never stale) ──
  const roomIdRef      = useRef(roomId);
  const localStreamRef = useRef(null);
  const localVideoRef  = useRef(null);
  const roleRef        = useRef(null);
  const pcsRef         = useRef({});
  const dcsRef         = useRef({});
  const roomKeysRef    = useRef({});
  const rsaKeysRef     = useRef({});
  const peerPubKeysRef = useRef({});
  const pendingIceRef  = useRef({});
  const ydocRef        = useRef(null);
  const awarenessRef   = useRef(null);

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
      if (candidate) socket.emit("ice-candidate", { roomId: roomIdRef.current, candidate, targetId: peerId });
    };

    pc.oniceconnectionstatechange = () => console.log(`[pc:${peerId}] ICE: ${pc.iceConnectionState}`);
    pc.onconnectionstatechange    = () => console.log(`[pc:${peerId}] PC:  ${pc.connectionState}`);

    pc.ondatachannel = ({ channel }) => {
      dcsRef.current[peerId] = channel;
      bindDc(channel, peerId);
    };

    setAllPeerIds(prev => prev.includes(peerId) ? prev : [...prev, peerId]);
    return pc;
  };

  // ══════════════════════════════════════════
  //  DATA CHANNEL
  // ══════════════════════════════════════════
  const bindDc = (channel, peerId) => {
    channel.onopen = async () => {
      console.log(`[dc:${peerId}] open`);
      roomKeysRef.current[peerId] = await generateRoomKey();
      rsaKeysRef.current[peerId]  = await generateRSAKeyPair();
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

    const onRoomPeers = async ({ peers }) => {
      console.log("[signaling] room-peers:", peers);
      await getMedia();
      for (const peerId of peers) {
        const pc = await makePc(peerId);
        addTracksTo(pc);
        const dc = pc.createDataChannel("chat");
        dcsRef.current[peerId] = dc;
        bindDc(dc, peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`[signaling] → offer to ${peerId}`);
        socket.emit("offer", { roomId, offer, targetId: peerId });
      }
    };

    const onPeerJoined = async ({ peerId }) => {
      console.log(`[signaling] peer-joined: ${peerId}`);
      await getMedia();
    };

    const onOffer = async ({ offer, fromId }) => {
      console.log(`[signaling] ← offer from ${fromId}`);
      await getMedia();
      const existing = pcsRef.current[fromId];
      if (existing && existing.signalingState !== "stable") {
        console.log(`[signaling] closing stale PC for ${fromId} (was ${existing.signalingState})`);
        existing.close();
        delete pcsRef.current[fromId];
      }
      const pc = await makePc(fromId);
      addTracksTo(pc);
      await pc.setRemoteDescription(offer);
      for (const c of (pendingIceRef.current[fromId] ?? [])) {
        await pc.addIceCandidate(c).catch(() => {});
      }
      pendingIceRef.current[fromId] = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log(`[signaling] → answer to ${fromId}`);
      socket.emit("answer", { roomId, answer, targetId: fromId });
    };

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

    const onIce = async ({ candidate, fromId }) => {
      const pc = pcsRef.current[fromId];
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(candidate).catch(() => {});
      } else {
        if (!pendingIceRef.current[fromId]) pendingIceRef.current[fromId] = [];
        pendingIceRef.current[fromId].push(candidate);
      }
    };

    const onPeerLeft = ({ peerId }) => {
      console.log(`[signaling] peer-left: ${peerId}`);
      pcsRef.current[peerId]?.close();
      delete pcsRef.current[peerId];
      delete dcsRef.current[peerId];
      delete roomKeysRef.current[peerId];
      setRemoteStreams(p => { const n = { ...p }; delete n[peerId]; return n; });
      setAllPeerIds(p => p.filter(id => id !== peerId));
    };

    const onRole = ({ role }) => {
      roleRef.current = role;
      setRole(role);
      if (awarenessRef.current) {
        const cur = awarenessRef.current.getLocalState() ?? {};
        awarenessRef.current.setLocalState({ ...cur, user: { role, name: role } });
      }
      setUsers(p => p.map(u => u.isLocal ? { ...u, role, name: role } : u));
    };

    const onConnect = () => {
      console.log("[signaling] connected, joining room:", roomId);
      setConnected(true);
      socket.emit("join-room", roomId);
    };

    socket.on("connect",       onConnect);
    socket.on("role",          onRole);
    socket.on("room-peers",    onRoomPeers);
    socket.on("peer-joined",   onPeerJoined);
    socket.on("offer",         onOffer);
    socket.on("answer",        onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("peer-left",     onPeerLeft);

    if (socket.connected) {
      setConnected(true);
      socket.emit("join-room", roomId);
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect",       onConnect);
      socket.off("role",          onRole);
      socket.off("room-peers",    onRoomPeers);
      socket.off("peer-joined",   onPeerJoined);
      socket.off("offer",         onOffer);
      socket.off("answer",        onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("peer-left",     onPeerLeft);
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

  // msg/handleSend/handleKeyDown kept for ChatPanel's onSend prop
  const handleSend    = () => { sendEncryptedChat(msg); setMsg(""); };
  const handleKeyDown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const toggleMic     = () => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMicOn; }); setIsMicOn(v => !v); };
  const toggleCamera  = () => { localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !isCameraOn; }); setIsCameraOn(v => !v); };
  const sendWbMsg     = useCallback((type, payload) => broadcast(type, payload), []);

  // ── Grid layout ──
  const totalTiles = 1 + allPeerIds.length;
  const cols = totalTiles === 1 ? 1 : totalTiles <= 4 ? 2 : 3;
  const rows = totalTiles === 1 ? 1 : totalTiles <= 2 ? 1 : totalTiles <= 4 ? 2 : Math.ceil(totalTiles / 3);

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════
  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col"
         style={{ background: "linear-gradient(135deg,#0a0a0f,#0d1117 40%,#0a0e1a)", fontFamily: "'DM Sans',system-ui,sans-serif", color: "#e2e8f0" }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0"
           style={{ background: "radial-gradient(ellipse 80% 50% at 20% 20%,rgba(99,102,241,.07),transparent 60%),radial-gradient(ellipse 60% 40% at 80% 80%,rgba(20,184,166,.06),transparent 60%)" }} />

      <div className="relative z-10 flex flex-col h-full" style={{ padding: "12px" }}>

        {/* ── Header ── */}
        <motion.header
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between flex-wrap gap-3"
          style={{ background: "rgba(15,17,26,.85)", backdropFilter: "blur(24px)", borderRadius: "16px 16px 0 0", border: "1px solid rgba(99,102,241,.15)", padding: "14px 20px", boxShadow: "0 4px 24px rgba(0,0,0,.4)" }}
        >
          {/* Logo + room id */}
          <div className="flex items-center gap-3">
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(99,102,241,.4)" }}>
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", margin: 0 }}>WhiteRoom</h1>
              <p style={{ fontSize: "11px", color: "#64748b", margin: 0, fontFamily: "monospace" }}>{roomId}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* StatusBadge — replaces the inline connected pill */}
            <StatusBadge connected={connected} />

            {/* Role badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                 style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.25)" }}>
              <Shield className="w-3 h-3" style={{ color: "#818cf8" }} />
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#818cf8", textTransform: "capitalize" }}>{role}</span>
            </div>

            {/* ViewSwitcher — replaces the three inline view buttons */}
            <ViewSwitcher view={view} setView={setView} />

            {/* Chat toggle */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-1.5 cursor-pointer"
              style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,.08)", background: isChatOpen ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.04)", color: isChatOpen ? "#818cf8" : "#64748b", fontSize: "12px", fontWeight: "600" }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {isChatOpen ? "Hide Chat" : "Chat"}
            </button>
          </div>
        </motion.header>

        {/* ── Main ── */}
        <div className="flex-1 relative overflow-hidden"
             style={{ background: "rgba(10,10,15,.6)", backdropFilter: "blur(12px)", borderLeft: "1px solid rgba(99,102,241,.1)", borderRight: "1px solid rgba(99,102,241,.1)" }}>

          {/* Video grid */}
          <div style={{ position: "absolute", inset: 0, padding: "10px", display: view === "video" ? "grid" : "none", gap: "10px", gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${rows},1fr)` }}>

            {/* Local tile — VideoTile handles camera-off state + label + status dot */}
            <VideoTile
              videoRef={localVideoRef}
              isLocal
              isCameraOn={isCameraOn}
              label={`You · ${role}`}
              variant="local"
            />

            {/* Remote tiles */}
            {allPeerIds.map((peerId, idx) => (
              <VideoTile
                key={peerId}
                stream={remoteStreams[peerId]}
                label={`Peer ${idx + 1}`}
                variant="remote"
              />
            ))}
          </div>

          {/* Whiteboard */}
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: view === "whiteboard" ? "block" : "none" }}>
            <WhiteboardPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users} />
          </div>

          {/* Docs */}
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: view === "docs" ? "block" : "none" }}>
            <DocsPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users}
              localName={users.find(u => u.isLocal)?.name ?? "You"}
              localColor={users.find(u => u.isLocal)?.color ?? "#c9a84c"} />
          </div>

        </div>

        {/* ── Footer — ControlBar replaces the three inline buttons ── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ background: "rgba(15,17,26,.85)", backdropFilter: "blur(24px)", borderRadius: "0 0 16px 16px", border: "1px solid rgba(99,102,241,.15)", borderTop: "1px solid rgba(99,102,241,.1)", boxShadow: "0 -4px 24px rgba(0,0,0,.3)" }}
        >
          <ControlBar isMicOn={isMicOn} isCameraOn={isCameraOn} toggleMic={toggleMic} toggleCamera={toggleCamera} />
        </motion.div>

      </div>

      {/* ── Floating Chat — ChatPanel replaces the entire inline chat block ── */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        users={users}
        role={role}
        onSend={sendEncryptedChat}
      />

    </div>
  );
}