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
import { Lock, Shield, MessageSquare, Users, X, Sparkles } from 'lucide-react';
const WhiteboardPanel = dynamic(() => import("@/components/WhiteboardPanel").then(m => m.WhiteboardPanel), { ssr: false });
const DocsPanel = dynamic(() => import("@/components/DocsPanel").then(m => m.DocsPanel), { ssr: false });

import StatusBadge     from "@/components/StatusBadge";
import ViewSwitcher    from "@/components/ViewSwitcher";
import VideoTile       from "@/components/VideoTile";
import ControlBar      from "@/components/ControlBar";
import ChatPanel       from "@/components/ChatPanel";
import PresenceSidebar from "@/components/PresenceSidebar";
import LogoutButton    from "@/components/LogoutButton";
import AISummaryPanel  from "@/components/AISummaryPanel";

export default function Room() {
  const { roomId } = useParams();
  const router = useRouter();

  // ── UI state ──
  const [connected, setConnected]         = useState(false);
  const [role, setRole]                   = useState(null);
  const [msg, setMsg]                     = useState("");
  const [users, setUsers]                 = useState([]);
  const [messages, setMessages]           = useState([]);
  const [remoteStreams, setRemoteStreams]  = useState({});
  const [allPeerIds, setAllPeerIds]       = useState([]);
  const [isChatOpen, setIsChatOpen]       = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [peerStates, setPeerStates]       = useState({});
  const [isMicOn, setIsMicOn]             = useState(true);
  const [isCameraOn, setIsCameraOn]       = useState(true);
  const [view, setView]                   = useState("video");
  const [isAISummaryOpen, setIsAISummaryOpen] = useState(false);

  // ── Waiting room state ──
  const [waitStatus, setWaitStatus]     = useState("idle");
  const [joinRequests, setJoinRequests] = useState([]);

  // ── Stable refs ──
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
  const blackTrackRef  = useRef(null);
  const realTrackRef   = useRef(null);

  const joinRequestSentRef = useRef(false);

  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // ══════════════════════════════════════════
  //  CLEANUP HELPER (used by leaveRoom + back button + beforeunload)
  // ══════════════════════════════════════════
  const cleanup = useCallback(() => {
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};
    dcsRef.current = {};
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    blackTrackRef.current?.stop();
    socket.emit("peer-left", { roomId: roomIdRef.current });
    socket.disconnect();
    playLeaveSound();
  }, []);

  // ══════════════════════════════════════════
  //  BACK BUTTON — popstate fires when browser
  //  already navigated back, so just clean up,
  //  no router.push needed.
  // ══════════════════════════════════════════
  useEffect(() => {
    const handlePopState = () => cleanup();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [cleanup]);

  // ══════════════════════════════════════════
  //  TAB CLOSE / REFRESH — sendBeacon is more
  //  reliable than fetch on page unload.
  // ══════════════════════════════════════════
  useEffect(() => {
    const handleUnload = () => {
      socket.emit("peer-left", { roomId: roomIdRef.current });
      socket.disconnect();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // ══════════════════════════════════════════
  //  MEDIA
  // ══════════════════════════════════════════
  const getMedia = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      if (localVideoRef.current) localVideoRef.current.srcObject = s;
      return s;
    } catch (e) {
      console.warn("[media] failed:", e.message);
      return null;
    }
  };

  // ══════════════════════════════════════════
  //  CREATE RTCPeerConnection
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
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = ({ track, streams }) => {
      setRemoteStreams(prev => {
        const ms = prev[peerId] ?? new MediaStream();
        if (!ms.getTracks().find(t => t.id === track.id)) ms.addTrack(track);
        return { ...prev, [peerId]: ms };
      });
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit("ice-candidate", { roomId: roomIdRef.current, candidate, targetId: peerId });
    };

    pc.oniceconnectionstatechange = () => setPeerStates(prev => ({ ...prev, [peerId]: pc.connectionState }));
    pc.onconnectionstatechange    = () => setPeerStates(prev => ({ ...prev, [peerId]: pc.connectionState }));

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
      roomKeysRef.current[peerId] = await generateRoomKey();
      rsaKeysRef.current[peerId]  = await generateRSAKeyPair();
      const pub = await exportPublicKey(rsaKeysRef.current[peerId].publicKey);
      sendTo(peerId, "control", { action: "PUBLIC_KEY", key: pub });
      broadcastAwareness();
    };
    channel.onmessage = e => onDcMessage(e.data, peerId);
    channel.onclose   = () => console.warn(`[dc:${peerId}] closed`);
    channel.onerror   = e => console.warn(`[dc:${peerId}] error`, e?.message);
  };

  const DC_MAX_BYTES = 200_000;

  const sendTo = (peerId, type, payload) => {
    const ch = dcsRef.current[peerId];
    if (!ch || ch.readyState !== "open") return;
    try {
      const raw = JSON.stringify({ type, payload, ts: Date.now() });
      if (raw.length > DC_MAX_BYTES || ch.bufferedAmount > DC_MAX_BYTES) return;
      ch.send(raw);
    } catch (err) {
      console.warn(`[dc:${peerId}] send failed (${type}):`, err?.message);
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
          const newMsg = {
            id: d.id ?? `${peerId}-${msg.ts}`,
            sender: d.sender,
            text: d.text,
            timestamp: msg.ts,
          };
          setMessages(prev =>
            prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]
          );
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
          canvasCursor: s.cursor ?? null, docCursor: s.docCursor ?? null,
          lastActive: s.lastActive ?? null, socketId: s.socketId ?? null,
          micOn: s.micOn ?? true, cameraOn: s.cameraOn ?? true,
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
  //  YJS + INDEXEDDB
  // ══════════════════════════════════════════
  const idbRef = useRef(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const idb = new IndexeddbPersistence(`whiteroom:${roomId}`, ydoc);
    idbRef.current = idb;

    idb.on("synced", () => {
      console.log("[idb] local state loaded from IndexedDB");
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
  //  SOCKET / SIGNALING
  // ══════════════════════════════════════════
  useEffect(() => {
    if (!roomId) return;

    const addTracksTo = (pc) => {
      const s = localStreamRef.current;
      if (!s) return;
      const senders = pc.getSenders();
      s.getTracks().forEach(t => {
        if (!senders.find(sx => sx.track?.id === t.id)) pc.addTrack(t, s);
      });
    };

    const emitJoinRequest = () => {
      if (joinRequestSentRef.current) return;
      joinRequestSentRef.current = true;
      const name = sessionStorage.getItem("userName") ?? "Guest";
      if (awarenessRef.current) {
        const cur = awarenessRef.current.getLocalState() ?? {};
        awarenessRef.current.setLocalState({ ...cur, socketId: socket.id, micOn: true, cameraOn: true });
      }
      socket.emit("join-request", { roomId, name });
    };

    const onConnect = () => {
      setConnected(true);
      setWaitStatus("waiting");
      joinRequestSentRef.current = false;
      emitJoinRequest();
    };

    const onRoomPeers = async ({ peers }) => {
      await getMedia();
      for (const peerId of peers) {
        const pc = await makePc(peerId);
        addTracksTo(pc);
        const dc = pc.createDataChannel("chat");
        dcsRef.current[peerId] = dc;
        bindDc(dc, peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer, targetId: peerId });
      }
    };

    const onPeerJoined = async ({ peerId }) => { await getMedia(); };

    const onOffer = async ({ offer, fromId }) => {
      await getMedia();
      const existing = pcsRef.current[fromId];
      if (existing && existing.signalingState !== "stable") {
        existing.close();
        delete pcsRef.current[fromId];
      }
      const pc = await makePc(fromId);
      addTracksTo(pc);
      await pc.setRemoteDescription(offer);
      for (const c of (pendingIceRef.current[fromId] ?? [])) await pc.addIceCandidate(c).catch(() => {});
      pendingIceRef.current[fromId] = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer, targetId: fromId });
    };

    const onAnswer = async ({ answer, fromId }) => {
      const pc = pcsRef.current[fromId];
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(answer);
      for (const c of (pendingIceRef.current[fromId] ?? [])) await pc.addIceCandidate(c).catch(() => {});
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
      pcsRef.current[peerId]?.close();
      delete pcsRef.current[peerId];
      delete dcsRef.current[peerId];
      delete roomKeysRef.current[peerId];
      setRemoteStreams(p => { const n = { ...p }; delete n[peerId]; return n; });
      setAllPeerIds(p => p.filter(id => id !== peerId));
      setPeerStates(p => { const n = { ...p }; delete n[peerId]; return n; });
      if (awarenessRef.current) {
        for (const [clientId, state] of awarenessRef.current.states.entries()) {
          if (state?.socketId === peerId) { awarenessRef.current.states.delete(clientId); break; }
        }
      }
      setUsers(prev => prev.filter(u => u.isLocal || u.socketId !== peerId));
    };

    const onRole = ({ role }) => {
      roleRef.current = role;
      setRole(role);
      if (awarenessRef.current) {
        const cur = awarenessRef.current.getLocalState() ?? {};
        awarenessRef.current.setLocalState({ ...cur, socketId: socket.id, user: { role, name: role } });
      }
      setUsers(p => p.map(u => u.isLocal ? { ...u, role, name: role } : u));
    };

    const onAdmitted    = () => { setWaitStatus("admitted"); playJoinSound(); };
    const onRejected    = () => setWaitStatus("rejected");
    const onJoinRequest = ({ requestId, peerId, name }) => {
      setJoinRequests(prev => prev.find(r => r.requestId === requestId) ? prev : [...prev, { requestId, peerId, name }]);
      playKnockSound();
    };

    const onReconnect = async () => {
      console.log("[signaling] reconnected — re-syncing Yjs state to peers");
      if (!ydocRef.current) return;
      const fullState = Y.encodeStateAsUpdate(ydocRef.current);
      for (const id of Object.keys(dcsRef.current)) {
        const k = roomKeysRef.current[id];
        if (k && fullState.length > 0) sendTo(id, "yjs-update", await encrypt(k, Array.from(fullState)));
      }
      broadcastAwareness();
    };

    socket.on("connect",       onConnect);
    socket.on("reconnect",     onReconnect);
    socket.on("disconnect",    () => setConnected(false));
    socket.on("join-admitted", onAdmitted);
    socket.on("join-rejected", onRejected);
    socket.on("join-request",  onJoinRequest);
    socket.on("rate-limited",  ({ event }) => console.warn(`[rate-limit] blocked on "${event}"`));
    socket.on("role",          onRole);
    socket.on("room-peers",    onRoomPeers);
    socket.on("peer-joined",   onPeerJoined);
    socket.on("offer",         onOffer);
    socket.on("answer",        onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("peer-left",     onPeerLeft);

    if (socket.connected) {
      setConnected(true);
      setWaitStatus("waiting");
      emitJoinRequest();
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
      joinRequestSentRef.current = false;
      playLeaveSound();
    };
  }, [roomId]);

  useEffect(() => {
    if (view === "video" && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [view]);

  // ══════════════════════════════════════════
  //  HANDLERS
  // ══════════════════════════════════════════
  const sendEncryptedChat = async (text) => {
    const id = `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const message = { id, text, sender: roleRef.current ?? "?", timestamp: Date.now() };
    setMessages(p => [...p, message]);
    for (const peerId of Object.keys(dcsRef.current)) {
      const k = roomKeysRef.current[peerId];
      if (k) sendTo(peerId, "chat", await encrypt(k, message));
    }
  };

  const handleSend    = () => { sendEncryptedChat(msg); setMsg(""); };
  const handleKeyDown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const toggleMic = () => {
    unlockAudio();
    const tracks = localStreamRef.current?.getAudioTracks();
    if (!tracks?.length) return;
    const newState = !isMicOn;
    tracks.forEach(t => { t.enabled = newState; });
    setIsMicOn(newState);
    if (awarenessRef.current) {
      const cur = awarenessRef.current.getLocalState() ?? {};
      awarenessRef.current.setLocalState({ ...cur, micOn: newState });
      broadcastAwareness();
    }
  };

  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    if (isCameraOn) {
      const realTrack = stream.getVideoTracks()[0];
      if (!realTrack) { setIsCameraOn(false); return; }
      realTrackRef.current = realTrack;
      const canvas = Object.assign(document.createElement("canvas"), { width: 640, height: 480 });
      canvas.getContext("2d").fillRect(0, 0, 640, 480);
      const blackTrack = canvas.captureStream(0).getVideoTracks()[0];
      blackTrackRef.current = blackTrack;
      for (const pc of Object.values(pcsRef.current)) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(blackTrack);
      }
      stream.removeTrack(realTrack);
      stream.addTrack(blackTrack);
      realTrack.stop();
      setIsCameraOn(false);
      if (awarenessRef.current) {
        const cur = awarenessRef.current.getLocalState() ?? {};
        awarenessRef.current.setLocalState({ ...cur, cameraOn: false });
        broadcastAwareness();
      }
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newStream.getVideoTracks()[0];
        for (const pc of Object.values(pcsRef.current)) {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(newTrack);
        }
        const blackTrack = blackTrackRef.current;
        if (blackTrack) { stream.removeTrack(blackTrack); blackTrack.stop(); }
        stream.addTrack(newTrack);
        realTrackRef.current = newTrack;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setIsCameraOn(true);
        if (awarenessRef.current) {
          const cur = awarenessRef.current.getLocalState() ?? {};
          awarenessRef.current.setLocalState({ ...cur, cameraOn: true });
          broadcastAwareness();
        }
      } catch (err) { console.error("[camera] failed to re-acquire", err); }
    }
  };

  const sendWbMsg = useCallback((type, payload) => broadcast(type, payload), []);

  const cursorThrottleRef = useRef(null);
  const pendingCursorRef  = useRef(null);

  const handleCursorMove = useCallback((x, y) => {
    if (!awarenessRef.current) return;
    pendingCursorRef.current = { x, y };
    if (cursorThrottleRef.current) return;
    cursorThrottleRef.current = setTimeout(() => {
      cursorThrottleRef.current = null;
      const pos = pendingCursorRef.current;
      if (!pos || !awarenessRef.current) return;
      const cur = awarenessRef.current.getLocalState() ?? {};
      awarenessRef.current.setLocalState({ ...cur, cursor: pos });
      broadcastAwareness();
    }, 50);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!awarenessRef.current) return;
      const cur = awarenessRef.current.getLocalState() ?? {};
      awarenessRef.current.setLocalState({ ...cur, lastActive: Date.now() });
      broadcastAwareness();
    };
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ══════════════════════════════════════════
  //  LEAVE ROOM (manual — button click)
  //  Uses cleanup() then pushes to home.
  // ══════════════════════════════════════════
  const leaveRoom = () => {
    cleanup();
    router.push("/");
  };

  const approveJoin = (requestId) => {
    setJoinRequests(prev => {
      if (!prev.find(r => r.requestId === requestId)) return prev;
      socket.emit("join-approve", { requestId });
      return prev.filter(r => r.requestId !== requestId);
    });
  };

  const rejectJoin = (requestId) => {
    setJoinRequests(prev => {
      if (!prev.find(r => r.requestId === requestId)) return prev;
      socket.emit("join-reject", { requestId });
      return prev.filter(r => r.requestId !== requestId);
    });
  };

  // ── Waiting screen ──
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

  // ── Rejected screen ──
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
          <button onClick={() => window.history.back()} style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "rgba(99,102,241,.15)", color: "#818cf8", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
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
              You're offline — whiteboard &amp; doc edits are saved locally and will sync when you reconnect
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
          <div className="flex items-center gap-3">
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(99,102,241,.4)" }}>
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 style={{ fontSize: "15px", fontWeight: "700", color: "#f1f5f9", margin: 0 }}>WhiteRoom</h1>
              <p style={{ fontSize: "11px", color: "#64748b", margin: 0, fontFamily: "monospace" }}>{roomId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge connected={connected} />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                 style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.25)" }}>
              <Shield className="w-3 h-3" style={{ color: "#818cf8" }} />
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#818cf8", textTransform: "capitalize" }}>{role}</span>
            </div>
            <ViewSwitcher view={view} setView={setView} />

            <button
              onClick={() => setIsAISummaryOpen(v => !v)}
              className="flex items-center gap-1.5 cursor-pointer"
              style={{
                padding: "7px 14px", borderRadius: "8px",
                border: `1px solid ${isAISummaryOpen ? "rgba(139,92,246,.4)" : "rgba(255,255,255,.08)"}`,
                background: isAISummaryOpen
                  ? "rgba(139,92,246,.18)"
                  : "linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.08))",
                color: isAISummaryOpen ? "#a78bfa" : "#64748b",
                fontSize: "12px", fontWeight: "600",
                boxShadow: isAISummaryOpen ? "0 0 12px rgba(139,92,246,.2)" : "none",
                transition: "all 0.15s",
              }}
            >
              <Sparkles size={13} />
              AI Summary
            </button>

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-1.5 cursor-pointer"
              style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,.08)", background: isChatOpen ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.04)", color: isChatOpen ? "#818cf8" : "#64748b", fontSize: "12px", fontWeight: "600" }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {isChatOpen ? "Hide Chat" : "Chat"}
            </button>
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

          <div className="flex-1 relative overflow-hidden"
               style={{ background: "rgba(10,10,15,.6)", backdropFilter: "blur(12px)", borderLeft: "1px solid rgba(99,102,241,.1)", borderRight: "1px solid rgba(99,102,241,.1)" }}>

            <AnimatePresence mode="wait">
              {view === "video" && (
                <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute", inset: 0, padding: "10px",
                    display: "grid", gap: "10px",
                    gridTemplateColumns: allPeerIds.length === 0 ? "1fr" : allPeerIds.length === 1 ? "1fr 1fr" : allPeerIds.length <= 3 ? "1fr 1fr" : "1fr 1fr 1fr",
                    gridTemplateRows: allPeerIds.length === 0 ? "1fr" : allPeerIds.length === 1 ? "1fr" : "1fr 1fr",
                  }}
                >
                  <VideoTile videoRef={localVideoRef} isLocal isCameraOn={isCameraOn} isMicOn={isMicOn} label={`You · ${role}`} variant="local" />
                  {allPeerIds.map((peerId, idx) => {
                    const peerUser = users.find(u => u.socketId === peerId);
                    return (
                      <motion.div key={peerId} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} style={{ minHeight: 0 }}>
                        <VideoTile stream={remoteStreams[peerId]} label={peerUser?.name && peerUser.name !== "?" ? peerUser.name : `Peer ${idx + 1}`} variant="remote" isCameraOn={peerUser?.cameraOn ?? true} isMicOn={peerUser?.micOn ?? true} />
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {view === "whiteboard" && (
                <motion.div key="whiteboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
                  <WhiteboardPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users} onCursorMove={handleCursorMove} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {view === "docs" && (
                <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
                  <DocsPanel ydocRef={ydocRef} sendMessage={sendWbMsg} role={role} users={users}
                    localName={users.find(u => u.isLocal)?.name ?? "You"}
                    localColor={users.find(u => u.isLocal)?.color ?? "#c9a84c"}
                    roomCode={roomId} />
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div key="sidebar" initial={{ width: 0, opacity: 0 }} animate={{ width: 224, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} style={{ overflow: "hidden", flexShrink: 0 }}>
                <PresenceSidebar users={users} peerStates={peerStates} onClose={() => setIsSidebarOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ background: "rgba(15,17,26,.85)", backdropFilter: "blur(24px)", borderRadius: "0 0 16px 16px", border: "1px solid rgba(99,102,241,.15)", borderTop: "1px solid rgba(99,102,241,.1)", boxShadow: "0 -4px 24px rgba(0,0,0,.3)" }}
        >
          <ControlBar isMicOn={isMicOn} isCameraOn={isCameraOn} toggleMic={toggleMic} toggleCamera={toggleCamera} onLeave={leaveRoom} />
        </motion.div>

      </div>

      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={messages} users={users} role={role} onSend={sendEncryptedChat} />

      <AISummaryPanel
        ydocRef={ydocRef}
        isOpen={isAISummaryOpen}
        onClose={() => setIsAISummaryOpen(false)}
        roomId={roomId}
      />

      <AnimatePresence>
        {joinRequests.length > 0 && (
          <motion.div key="join-requests" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ position: "fixed", bottom: "80px", right: "20px", zIndex: 60, display: "flex", flexDirection: "column", gap: "8px", maxWidth: "300px" }}
          >
            {joinRequests.map(req => (
              <div key={req.requestId} style={{ background: "rgba(13,15,23,.97)", backdropFilter: "blur(24px)", border: "1px solid rgba(99,102,241,.25)", borderRadius: "14px", padding: "14px 16px", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0, background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#818cf8" }}>
                    {req.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#f1f5f9" }}>{req.name}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>wants to join</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => approveJoin(req.requestId)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(16,185,129,.25)", background: "rgba(16,185,129,.15)", color: "#10b981", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Admit</button>
                  <button onClick={() => rejectJoin(req.requestId)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(239,68,68,.2)", background: "rgba(239,68,68,.1)", color: "#ef4444", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Deny</button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}