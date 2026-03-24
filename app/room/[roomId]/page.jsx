"use client";
import { generateRoomKey, exportKey, importKey, encrypt, decrypt, generateRSAKeyPair, exportPublicKey, importPublicKey, encryptWithPublicKey, decryptWithPrivateKey } from "@/lib/crypto";
import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "@/lib/socket";
import { useParams, useRouter } from "next/navigation";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { playJoinSound, playLeaveSound, playKnockSound, unlockAudio } from "@/lib/sounds";
import { Lock, Shield, MessageSquare, Users, X } from 'lucide-react';
const WhiteboardPanel = dynamic(() => import("@/components/WhiteboardPanel").then(m => m.WhiteboardPanel), { ssr: false });
const DocsPanel = dynamic(() => import("@/components/DocsPanel").then(m => m.DocsPanel), { ssr: false });

// ── New design-system components ──
import StatusBadge   from "@/components/StatusBadge";
import ViewSwitcher  from "@/components/ViewSwitcher";
import VideoTile     from "@/components/VideoTile";
import ControlBar    from "@/components/ControlBar";
import ChatPanel     from "@/components/ChatPanel";
import PresenceSidebar from "@/components/PresenceSidebar";
import LogoutButton   from "@/components/LogoutButton";

export default function Room() {
  const { roomId } = useParams();
  const router = useRouter();

  // ── UI state ──
  const [connected, setConnected]       = useState(false);
  const [role, setRole]                 = useState(null);
  const [msg, setMsg]                   = useState("");
  const [users, setUsers]               = useState([]);
  const [messages, setMessages]         = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [allPeerIds, setAllPeerIds]     = useState([]);
  const [isChatOpen, setIsChatOpen]       = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [peerStates, setPeerStates]       = useState({});
  const [isMicOn, setIsMicOn]           = useState(true);
  const [isCameraOn, setIsCameraOn]     = useState(true);
  const [view, setView] = useState("video");

  // ── Waiting room state ────────────────────────────────────────
  const [waitStatus, setWaitStatus]         = useState("idle"); // "idle" | "waiting" | "admitted" | "rejected"
  const [joinRequests, setJoinRequests]     = useState([]); // host sees these
  // { requestId, peerId, name }

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

    pc.oniceconnectionstatechange = () => {
      console.log(`[pc:${peerId}] ICE: ${pc.iceConnectionState}`);
      setPeerStates(prev => ({ ...prev, [peerId]: pc.connectionState }));
    };
    pc.onconnectionstatechange = () => {
      console.log(`[pc:${peerId}] PC:  ${pc.connectionState}`);
      setPeerStates(prev => ({ ...prev, [peerId]: pc.connectionState }));
    };

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
    channel.onerror   = e => {
      // RTCDataChannel errors often come with empty event objects — extract what we can
      const msg = e?.message ?? e?.error?.message ?? "unknown";
      const state = dcsRef.current[peerId]?.readyState ?? "n/a";
      console.warn(`[dc:${peerId}] error — readyState: ${state}, msg: ${msg}`);
    };
  };

  const DC_MAX_BYTES = 200_000; // stay well under the 256KB SCTP limit

  const sendTo = (peerId, type, payload) => {
    const ch = dcsRef.current[peerId];
    if (!ch || ch.readyState !== "open") return;
    try {
      const raw = JSON.stringify({ type, payload, ts: Date.now() });
      if (raw.length > DC_MAX_BYTES) {
        console.warn(`[dc:${peerId}] message too large (${raw.length} bytes), type=${type} — dropping`);
        return;
      }
      // Back-pressure: drop if send buffer is filling up
      if (ch.bufferedAmount > DC_MAX_BYTES) {
        console.warn(`[dc:${peerId}] buffer full (${ch.bufferedAmount}), dropping type=${type}`);
        return;
      }
      ch.send(raw);
    } catch (err) {
      console.warn(`[dc:${peerId}] send failed (${type}):`, err?.message ?? err);
    }
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
          // Send full Yjs state so late joiners get current doc
          if (ydocRef.current) {
            const fullState = Y.encodeStateAsUpdate(ydocRef.current);
            const k = roomKeysRef.current[peerId];
            if (k && fullState.length > 0) {
              sendTo(peerId, "yjs-update", await encrypt(k, Array.from(fullState)));
            }
          }
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
          canvasCursor: s.cursor ?? null,
          docCursor: s.docCursor ?? null,
          lastActive: s.lastActive ?? null,
          socketId: s.user?.socketId ?? null,
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
  //  YJS + INDEXEDDB PERSISTENCE
  // ══════════════════════════════════════════
  const idbRef = useRef(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // ── IndexedDB persistence ─────────────────────────────────────
    // Key is per-room so each room has its own local store.
    // `synced` fires once the local DB state is loaded into the doc —
    // only after that do we broadcast to peers so we send the full
    // merged state (local offline edits + whatever peers have).
    const idb = new IndexeddbPersistence(`whiteroom:${roomId}`, ydoc);
    idbRef.current = idb;

    idb.on("synced", () => {
      console.log("[idb] local state loaded from IndexedDB");
      // Re-broadcast awareness now that local doc is hydrated
      broadcastAwareness();
    });

    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;
    awareness.setLocalState({ user: { role: "connecting", name: "connecting" }, cursor: null });
    ydoc._awareness = awareness;
    setUsers([{ clientId: ydoc.clientID, role: "connecting", name: "connecting", color: "#a78bfa", isLocal: true }]);

    ydoc.on("update", async (update, origin) => {
      if (origin === "remote") return;
      for (const id of Object.keys(dcsRef.current)) {
        const k = roomKeysRef.current[id];
        if (k) sendTo(id, "yjs-update", await encrypt(k, Array.from(update)));
      }
    });

    return () => {
      awareness.destroy();
      idb.destroy();
      ydoc.destroy();
    };
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
      setPeerStates(p => { const n = { ...p }; delete n[peerId]; return n; });
      // Remove from users — match by socketId stored in awareness state
      if (awarenessRef.current) {
        for (const [clientId, state] of awarenessRef.current.states.entries()) {
          if (state?.user?.socketId === peerId) {
            awarenessRef.current.states.delete(clientId);
            break;
          }
        }
      }
      setUsers(prev => prev.filter(u => u.isLocal || u.socketId !== peerId));
    };

    const onRole = ({ role }) => {
      roleRef.current = role;
      setRole(role);
      if (awarenessRef.current) {
        const cur = awarenessRef.current.getLocalState() ?? {};
        awarenessRef.current.setLocalState({ ...cur, user: { role, name: role, socketId: socket.id } });
      }
      setUsers(p => p.map(u => u.isLocal ? { ...u, role, name: role } : u));
    };

    const onConnect = () => {
      console.log("[signaling] connected, requesting to join room:", roomId);
      setConnected(true);
      setWaitStatus("waiting");
      // Send name from session storage if available, fallback to "Guest"
      const name = sessionStorage.getItem("userName") ?? "Guest";
      socket.emit("join-request", { roomId, name });
    };

    // Admitted — server says we can enter
    const onAdmitted = () => {
      console.log("[signaling] admitted to room");
      setWaitStatus("admitted");
      playJoinSound();
    };

    // Rejected — host said no
    const onRejected = () => {
      console.log("[signaling] rejected by host");
      setWaitStatus("rejected");
    };

    // Host receives this when someone wants to join
    const onJoinRequest = ({ requestId, peerId, name }) => {
      setJoinRequests(prev => [...prev, { requestId, peerId, name }]);
      playKnockSound();
    };

    const onReconnect = async () => {
      console.log("[signaling] reconnected — re-syncing Yjs state to peers");
      if (!ydocRef.current) return;
      const fullState = Y.encodeStateAsUpdate(ydocRef.current);
      for (const id of Object.keys(dcsRef.current)) {
        const k = roomKeysRef.current[id];
        if (k && fullState.length > 0) {
          sendTo(id, "yjs-update", await encrypt(k, Array.from(fullState)));
        }
      }
      broadcastAwareness();
    };

    socket.on("connect",        onConnect);
    socket.on("reconnect",      onReconnect);
    socket.on("disconnect",     () => { setConnected(false); console.warn("[signaling] disconnected"); });
    socket.on("join-admitted",  onAdmitted);
    socket.on("join-rejected",  onRejected);
    socket.on("join-request",   onJoinRequest);
    socket.on("rate-limited",   ({ event }) => console.warn(`[rate-limit] blocked on "${event}"`));
    socket.on("role",           onRole);
    socket.on("room-peers",     onRoomPeers);
    socket.on("peer-joined",    onPeerJoined);
    socket.on("offer",          onOffer);
    socket.on("answer",         onAnswer);
    socket.on("ice-candidate",  onIce);
    socket.on("peer-left",      onPeerLeft);

    if (socket.connected) {
      setConnected(true);
      setWaitStatus("waiting");
      const name = sessionStorage.getItem("userName") ?? "Guest";
      socket.emit("join-request", { roomId, name });
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect",       onConnect);
      socket.off("reconnect",     onReconnect);
      socket.off("disconnect");
      socket.off("join-admitted", onAdmitted);
      socket.off("join-rejected", onRejected);
      socket.off("join-request",  onJoinRequest);
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
      playLeaveSound();
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
  const toggleMic = () => {
    unlockAudio();
    const tracks = localStreamRef.current?.getAudioTracks();
    if (!tracks?.length) return;
    const newState = !isMicOn;
    tracks.forEach(t => { t.enabled = newState; });
    setIsMicOn(newState);
  };
  // ── Camera toggle — replaces real track with black frame so hardware turns off
  const blackTrackRef = useRef(null);
  const realTrackRef  = useRef(null);

  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    if (isCameraOn) {
      // Turning OFF — replace real track with a black canvas track
      const realTrack = stream.getVideoTracks()[0];
      if (!realTrack) { setIsCameraOn(false); return; }

      realTrackRef.current = realTrack;

      // Create a black canvas track
      const canvas = Object.assign(document.createElement("canvas"), { width: 640, height: 480 });
      canvas.getContext("2d").fillRect(0, 0, 640, 480);
      const blackTrack = canvas.captureStream(0).getVideoTracks()[0];
      blackTrackRef.current = blackTrack;

      // Replace in all peer connections
      for (const pc of Object.values(pcsRef.current)) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(blackTrack);
      }

      // Replace in local stream so local preview goes black
      stream.removeTrack(realTrack);
      stream.addTrack(blackTrack);
      realTrack.stop(); // ← this turns off the camera light

      setIsCameraOn(false);
    } else {
      // Turning ON — get a fresh camera track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newStream.getVideoTracks()[0];

        // Replace black track in all peer connections
        for (const pc of Object.values(pcsRef.current)) {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(newTrack);
        }

        // Replace in local stream
        const blackTrack = blackTrackRef.current;
        if (blackTrack) {
          stream.removeTrack(blackTrack);
          blackTrack.stop();
        }
        stream.addTrack(newTrack);
        realTrackRef.current = newTrack;

        // Refresh local video element
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        setIsCameraOn(true);
      } catch (err) {
        console.error("[camera] failed to re-acquire camera", err);
      }
    }
  };
  const sendWbMsg     = useCallback((type, payload) => broadcast(type, payload), []);

  // ── Cursor broadcast — throttled to 20fps, never during active stroke ──
  const cursorThrottleRef = useRef(null);
  const pendingCursorRef  = useRef(null);

  const handleCursorMove = useCallback((x, y) => {
    if (!awarenessRef.current) return;
    pendingCursorRef.current = { x, y };

    if (cursorThrottleRef.current) return; // already scheduled
    cursorThrottleRef.current = setTimeout(() => {
      cursorThrottleRef.current = null;
      const pos = pendingCursorRef.current;
      if (!pos || !awarenessRef.current) return;
      const cur = awarenessRef.current.getLocalState() ?? {};
      awarenessRef.current.setLocalState({ ...cur, cursor: pos });
      broadcastAwareness();
    }, 50); // 50ms = max 20fps for cursor updates
  }, []);

  // ── Broadcast lastActive timestamp every 30s ─────────────────────
  useEffect(() => {
    const tick = () => {
      if (!awarenessRef.current) return;
      const cur = awarenessRef.current.getLocalState() ?? {};
      awarenessRef.current.setLocalState({ ...cur, lastActive: Date.now() });
      broadcastAwareness();
    };
    tick(); // immediately on mount
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Approve / reject handlers (host) ─────────────────────────
  const leaveRoom = () => {
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};
    dcsRef.current = {};
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    blackTrackRef.current?.stop();
    socket.emit("peer-left", { roomId });
    socket.disconnect();
    playLeaveSound();
    router.push("/");



    
  };

  const approveJoin = (requestId) => {
    socket.emit("join-approve", { requestId });
    setJoinRequests(prev => prev.filter(r => r.requestId !== requestId));
  };

  const rejectJoin = (requestId) => {
    socket.emit("join-reject", { requestId });
    setJoinRequests(prev => prev.filter(r => r.requestId !== requestId));
  };

  // ── Waiting screen ────────────────────────────────────────────
  if (waitStatus === "waiting") {
    return (
      <div onClick={unlockAudio} style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0a0a0f,#0d1117 40%,#0a0e1a)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg,#6366f1,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(99,102,241,.4)" }}>
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 8px" }}>Waiting for host</h2>
            <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>The host will let you in soon</p>
          </div>
          {/* Animated dots */}
          <div style={{ display: "flex", gap: "6px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1", animation: `bounce 1.2s ${i * 0.2}s infinite`, opacity: 0.7 }} />
            ))}
          </div>
          <p style={{ fontSize: "11px", color: "#1e293b", fontFamily: "monospace" }}>{roomId}</p>
          <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)} }`}</style>
        </div>
      </div>
    );
  }

  // ── Rejected screen ───────────────────────────────────────────
  if (waitStatus === "rejected") {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0a0a0f,#0d1117 40%,#0a0e1a)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X className="w-6 h-6" style={{ color: "#ef4444" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 8px" }}>Entry denied</h2>
            <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>The host declined your request to join</p>
          </div>
          <button
            onClick={() => window.history.back()}
            style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "rgba(99,102,241,.15)", color: "#818cf8", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════
  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col"
         style={{ background: "linear-gradient(135deg,#0a0a0f,#0d1117 40%,#0a0e1a)", fontFamily: "'DM Sans',system-ui,sans-serif", color: "#e2e8f0" }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0"
           style={{ background: "radial-gradient(ellipse 80% 50% at 20% 20%,rgba(99,102,241,.07),transparent 60%),radial-gradient(ellipse 60% 40% at 80% 80%,rgba(20,184,166,.06),transparent 60%)" }} />

      {/* Offline banner */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            key="offline-banner"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
              background: "rgba(234,179,8,.12)", backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(234,179,8,.3)",
              padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#eab308", boxShadow: "0 0 6px #eab308" }} />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#eab308" }}>
              You're offline — edits are saved locally and will sync when you reconnect
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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

            {/* Presence sidebar toggle */}
            <button
              onClick={() => setIsSidebarOpen(v => !v)}
              className="flex items-center gap-1.5 cursor-pointer"
              style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,.08)", background: isSidebarOpen ? "rgba(16,185,129,.12)" : "rgba(255,255,255,.04)", color: isSidebarOpen ? "#10b981" : "#64748b", fontSize: "12px", fontWeight: "600" }}
            >
              <Users className="w-3.5 h-3.5" />
              {users.length} online
            </button>

            <LogoutButton variant="icon" />
          </div>
        </motion.header>

        {/* ── Main + Sidebar ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Main ── */}
        <div className="flex-1 relative overflow-hidden"
             style={{ background: "rgba(10,10,15,.6)", backdropFilter: "blur(12px)", borderLeft: "1px solid rgba(99,102,241,.1)", borderRight: "1px solid rgba(99,102,241,.1)" }}>

          {/* Video grid */}
          <AnimatePresence mode="wait">
            {view === "video" && (
              <motion.div
                key="video"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: "absolute", inset: 0, padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}
              >
                {allPeerIds.length === 0 ? (
                  // Solo — host fills entire space
                  <div style={{ flex: 1 }}>
                    <VideoTile videoRef={localVideoRef} isLocal isCameraOn={isCameraOn} label={`You · ${role}`} variant="local" style={{ width: "100%", height: "100%" }} />
                  </div>
                ) : (
                  <>
                    {/* Spotlight — host always large */}
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <VideoTile videoRef={localVideoRef} isLocal isCameraOn={isCameraOn} label={`You · ${role}`} variant="local" />
                    </div>

                    {/* Peer strip — fixed height at bottom */}
                    <div style={{ display: "flex", gap: "10px", height: "140px", flexShrink: 0 }}>
                      {allPeerIds.map((peerId, idx) => (
                        <motion.div
                          key={peerId}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          style={{ flex: "0 0 200px", height: "100%" }}
                        >
                          <VideoTile stream={remoteStreams[peerId]} label={`Peer ${idx + 1}`} variant="remote" />
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Whiteboard */}
          <AnimatePresence mode="wait">
            {view === "whiteboard" && (
              <motion.div
                key="whiteboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: "absolute", inset: 0, zIndex: 2 }}
              >
                <WhiteboardPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users} onCursorMove={handleCursorMove} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Docs */}
          <AnimatePresence mode="wait">
            {view === "docs" && (
              <motion.div
                key="docs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: "absolute", inset: 0, zIndex: 2 }}
              >
                <DocsPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users}
                  localName={users.find(u => u.isLocal)?.name ?? "You"}
                  localColor={users.find(u => u.isLocal)?.color ?? "#c9a84c"}
                  roomCode={roomId} />
              </motion.div>
            )}
          </AnimatePresence>

        </div>{/* end main */}

          {/* ── Presence Sidebar ── */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                key="sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 224, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ overflow: "hidden", flexShrink: 0 }}
              >
                <PresenceSidebar
                  users={users}
                  peerStates={peerStates}
                  onClose={() => setIsSidebarOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

        </div>{/* end main + sidebar flex row */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ background: "rgba(15,17,26,.85)", backdropFilter: "blur(24px)", borderRadius: "0 0 16px 16px", border: "1px solid rgba(99,102,241,.15)", borderTop: "1px solid rgba(99,102,241,.1)", boxShadow: "0 -4px 24px rgba(0,0,0,.3)" }}
        >
          <ControlBar isMicOn={isMicOn} isCameraOn={isCameraOn} toggleMic={toggleMic} toggleCamera={toggleCamera} onLeave={leaveRoom} />
        </motion.div>

      </div>

      {/* ── Floating Chat ── */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        users={users}
        role={role}
        onSend={sendEncryptedChat}
      />

      {/* ── Host join-request approval popup ── */}
      <AnimatePresence>
        {joinRequests.length > 0 && (
          <motion.div
            key="join-requests"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed", bottom: "80px", right: "20px", zIndex: 60,
              display: "flex", flexDirection: "column", gap: "8px",
              maxWidth: "300px",
            }}
          >
            {joinRequests.map(req => (
              <div key={req.requestId} style={{
                background: "rgba(13,15,23,.97)", backdropFilter: "blur(24px)",
                border: "1px solid rgba(99,102,241,.25)", borderRadius: "14px",
                padding: "14px 16px", boxShadow: "0 8px 32px rgba(0,0,0,.5)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                    background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", fontWeight: "800", color: "#818cf8",
                  }}>
                    {req.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#f1f5f9" }}>{req.name}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>wants to join</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => approveJoin(req.requestId)}
                    style={{
                      flex: 1, padding: "8px", borderRadius: "8px", border: "none",
                      background: "rgba(16,185,129,.15)", color: "#10b981",
                      fontSize: "12px", fontWeight: "700", cursor: "pointer",
                      border: "1px solid rgba(16,185,129,.25)",
                    }}
                  >
                    Admit
                  </button>
                  <button
                    onClick={() => rejectJoin(req.requestId)}
                    style={{
                      flex: 1, padding: "8px", borderRadius: "8px", border: "none",
                      background: "rgba(239,68,68,.1)", color: "#ef4444",
                      fontSize: "12px", fontWeight: "700", cursor: "pointer",
                      border: "1px solid rgba(239,68,68,.2)",
                    }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}