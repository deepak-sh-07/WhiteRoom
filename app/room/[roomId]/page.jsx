"use client";
import {
  generateRoomKey,
  exportKey,
  importKey,
  encrypt,
  decrypt,
  generateRSAKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptWithPublicKey,
  decryptWithPrivateKey
} from "@/lib/crypto";
import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import dynamic from "next/dynamic";
const WhiteboardPanel = dynamic(
  () => import("@/components/WhiteboardPanel").then(m => m.WhiteboardPanel),
  { ssr: false }
);
import {
  Send, Users, Wifi, WifiOff, Shield, Lock,
  MessageSquare, X, Minimize2, Video, Mic,
  MicOff, VideoOff, PhoneOff, PenLine, Monitor
} from 'lucide-react';

export default function Room() {
  const { roomId } = useParams();
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState(null);
  const [msg, setMsg] = useState("");
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);

  // ── Mesh: one RTCPeerConnection + DataChannel per remote peer ────
  const peerConnectionsRef = useRef({});  // { [peerId]: RTCPeerConnection }
  const dataChannelsRef = useRef({});     // { [peerId]: RTCDataChannel }
  const roomKeysRef = useRef({});         // { [peerId]: CryptoKey } per-pair AES keys
  const rsaKeyPairsRef = useRef({});      // { [peerId]: { publicKey, privateKey } }
  const peerPublicKeysRef = useRef({});   // { [peerId]: CryptoKey }
  const pendingIceCandidates = useRef({}); // { [peerId]: candidate[] }

  const localStreamRef = useRef(null);
  const roleRef = useRef(null);
  const localVideoRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }
  const [connectedPeers, setConnectedPeers] = useState([]); // peers with open DataChannel

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [view, setView] = useState("video");

  const ydocRef = useRef(null);
  const awarenessRef = useRef(null);
  const ymapRef = useRef(null);

  /* ---------------- MEDIA ---------------- */
  const startMedia = async () => { //it prepares media to be sent by attaching tracks to the RTCPeerConnection.
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ //which devices to be shared or opened during sharing
        video: true,
        audio: false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      console.warn("⚠️ Camera unavailable, connecting without media");
      return null; // still continue — DataChannel, chat and whiteboard will work
    }
  };

  async function getIceServers() {
    try {
      const res = await fetch("/api/turn");
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }

  /* ---------------- CREATE PEER CONNECTION ---------------- */
  const createPeerConnection = async (peerId) => {
    if (peerConnectionsRef.current[peerId]) return peerConnectionsRef.current[peerId];

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ // basic webrtc connection
      iceServers //stun servers finds out the public ip of the machine and provides to ice candidate
    });
    // we are using stun and turn servers because the stun only provides public ip but that doesnt guarentee connection
    // after stun fails turn take over and guarentees all traffic to be relayed through it
    peerConnectionsRef.current[peerId] = pc;

    // Add local stream tracks to this connection
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (e) => {
      setRemoteStreams(prev => {
        const existing = prev[peerId] ? prev[peerId] : new MediaStream();
        existing.addTrack(e.track);
        return { ...prev, [peerId]: existing };
      });
    };

    pc.onicecandidate = (e) => { // ice-candidates send our info like ip router etc to others throught socket
      if (e.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: e.candidate, targetId: peerId });
      }
    };

    pc.ondatachannel = (e) => { // data channel will listen to the upcoming msg and call handle message
      const channel = e.channel;
      dataChannelsRef.current[peerId] = channel;
      setupDataChannel(channel, peerId);
    };

    return pc;
  };

  /* ---------------- DATA CHANNEL SETUP ---------------- */
  const setupDataChannel = (channel, peerId) => {
    channel.onopen = async () => {
      console.log(`✅ DataChannel open with ${peerId}`);
      roomKeysRef.current[peerId] = await generateRoomKey();
      rsaKeyPairsRef.current[peerId] = await generateRSAKeyPair();
      const publicKey = await exportPublicKey(rsaKeyPairsRef.current[peerId].publicKey);
      sendMessageToPeer(peerId, "control", { action: "PUBLIC_KEY", key: publicKey });
      broadcastAwareness();
      setConnectedPeers(prev => [...new Set([...prev, peerId])]);
    };
    channel.onmessage = (e) => handleMessage(e.data, peerId); // this listens to the message
    channel.onclose = () => console.warn(`❌ DataChannel closed with ${peerId}`);
    channel.onerror = (e) => console.error(`⚠️ DataChannel error with ${peerId}`, e);
  };

  /* ---------------- SEND HELPERS ---------------- */
  function sendMessageToPeer(peerId, type, payload) {
    const channel = dataChannelsRef.current[peerId];
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify({ type, payload, ts: Date.now() }));
  }

  function broadcastMessage(type, payload) {
    Object.keys(dataChannelsRef.current).forEach(peerId => {
      sendMessageToPeer(peerId, type, payload);
    });
  }

  /* ---------------- AWARENESS HELPERS ---------------- */
  function broadcastAwareness() {
    if (!awarenessRef.current) return;
    const state = awarenessRef.current.getLocalState();
    if (!state) return;
    broadcastMessage("awareness", { clientId: ydocRef.current.clientID, state });
  }

  function setLocalAwareness(patch) {
    if (!awarenessRef.current) return;
    const current = awarenessRef.current.getLocalState() ?? {};
    awarenessRef.current.setLocalState({ ...current, ...patch });
    broadcastAwareness();
  }

  /* ---------------- CHAT ---------------- */
  async function sendEncryptedChat(text) {
    const message = { text, sender: roleRef.current ?? "unknown", timestamp: Date.now() };
    setMessages(prev => [...prev, message]);
    // Send to all connected peers (host sends to all peers, peer sends only to host)
    for (const peerId of Object.keys(dataChannelsRef.current)) {
      const key = roomKeysRef.current[peerId];
      if (!key) continue;
      const encryptedPayload = await encrypt(key, message);
      sendMessageToPeer(peerId, "chat", encryptedPayload);
    }
  }

  /* ---------------- HANDLE INCOMING MESSAGE ---------------- */
  async function handleMessage(raw, peerId) {
    const msg = JSON.parse(raw);
    const peerKey = roomKeysRef.current[peerId];

    switch (msg.type) {

      case "chat": {
        if (!peerKey) return;
        try {
          const decrypted = await decrypt(peerKey, msg.payload);
          setMessages(prev => [...prev, { sender: decrypted.sender, text: decrypted.text, timestamp: msg.ts }]);
          // Host relays chat to all other peers with their own keys
          if (roleRef.current === "host") {
            for (const otherId of Object.keys(dataChannelsRef.current)) {
              if (otherId === peerId) continue;
              const otherKey = roomKeysRef.current[otherId];
              if (!otherKey) continue;
              const reEncrypted = await encrypt(otherKey, decrypted);
              sendMessageToPeer(otherId, "chat", reEncrypted);
            }
          }
        } catch (e) {
          console.error("❌ Chat decrypt failed:", e);
        }
        break;
      }

      case "control":
        if (msg.payload.action === "PUBLIC_KEY") {
          peerPublicKeysRef.current[peerId] = await importPublicKey(msg.payload.key);
          // Deterministic: smaller socket ID sends the AES key — works for any topology
          if (socket.id < peerId) {
            const rawAESKey = await exportKey(roomKeysRef.current[peerId]);
            const encryptedKey = await encryptWithPublicKey(peerPublicKeysRef.current[peerId], rawAESKey);
            sendMessageToPeer(peerId, "control", { action: "SET_KEY_SECURE", key: encryptedKey });
          }
        }
        if (msg.payload.action === "SET_KEY_SECURE") {
          const rawAESKey = await decryptWithPrivateKey(rsaKeyPairsRef.current[peerId].privateKey, msg.payload.key);
          roomKeysRef.current[peerId] = await importKey(rawAESKey);
          console.log(`🔐 Secure key established with ${peerId}`);
          broadcastAwareness();
        }
        break;

      case "awareness": {
        const { clientId, state } = msg.payload;
        if (!awarenessRef.current) break;
        awarenessRef.current.states.set(clientId, state);
        const allStates = Array.from(awarenessRef.current.states.entries()).map(([id, s]) => ({
          clientId: id,
          role: s.user?.role ?? "unknown",
          name: s.user?.name ?? "Unknown",
          color: s.user?.color ?? "#a78bfa",
          cursor: s.cursor ?? null,
          canvasCursor: s.canvasCursor ?? null,
          isLocal: id === ydocRef.current.clientID,
        }));
        setUsers(allStates);
        // Host relays awareness to all other peers
        if (roleRef.current === "host") {
          Object.keys(dataChannelsRef.current).forEach(otherId => {
            if (otherId !== peerId) sendMessageToPeer(otherId, "awareness", msg.payload);
          });
        }
        break;
      }

      case "whiteboard-update": {
        if (ydocRef.current?._whiteboardApply) {
          await ydocRef.current._whiteboardApply(msg.payload);
        }
        // Host relays whiteboard to all other peers
        if (roleRef.current === "host") {
          Object.keys(dataChannelsRef.current).forEach(otherId => {
            if (otherId !== peerId) sendMessageToPeer(otherId, "whiteboard-update", msg.payload);
          });
        }
        break;
      }

      case "yjs-update": {
        if (!peerKey) return;
        try {
          const decrypted = await decrypt(peerKey, msg.payload);
          const update = new Uint8Array(decrypted);
          Y.applyUpdate(ydocRef.current, update, "remote");
          // Re-encrypt with each other peer's own key before forwarding
          for (const otherId of Object.keys(dataChannelsRef.current)) {
            if (otherId === peerId) continue;
            const otherKey = roomKeysRef.current[otherId];
            if (!otherKey) continue;
            const reEncrypted = await encrypt(otherKey, Array.from(update));
            sendMessageToPeer(otherId, "yjs-update", reEncrypted);
          }
        } catch { }
        break;
      }
    }
  }

  /* ---------------- YJS INIT ---------------- */
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    ymapRef.current = ydoc.getMap("room-state");

    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;

    awareness.setLocalState({
      user: { role: roleRef.current ?? "connecting", name: roleRef.current ?? "connecting" },
      cursor: null, canvasCursor: null, status: "online",
    });

    // Immediately add ourselves to the users list so we show up without needing a peer
    setUsers([{
      clientId: ydoc.clientID,
      role: roleRef.current ?? "connecting",
      name: roleRef.current ?? "connecting",
      color: "#a78bfa",
      cursor: null,
      canvasCursor: null,
      isLocal: true,
    }]);

    awareness.on("change", () => {
      broadcastAwareness();
      const allStates = Array.from(awareness.states.entries()).map(([id, s]) => ({
        clientId: id,
        role: s.user?.role ?? "unknown",
        name: s.user?.name ?? "Unknown",
        color: s.user?.color ?? "#a78bfa",
        cursor: s.cursor ?? null,
        canvasCursor: s.canvasCursor ?? null,
        isLocal: id === ydoc.clientID,
      }));
      setUsers(allStates);
    });

    ydoc.on("update", async (update, origin) => {
      if (origin === "remote") return;
      for (const peerId of Object.keys(dataChannelsRef.current)) {
        const key = roomKeysRef.current[peerId];
        if (!key) continue;
        const encrypted = await encrypt(key, Array.from(update));
        sendMessageToPeer(peerId, "yjs-update", encrypted);
      }
    });

    return () => { awareness.destroy(); ydoc.destroy(); };
  }, []);

  /* ---------------- ROLE ---------------- */
  useEffect(() => {
    const handleRole = ({ role }) => {
      roleRef.current = role;
      setRole(role);
      if (awarenessRef.current) {
        const current = awarenessRef.current.getLocalState() ?? {};
        awarenessRef.current.setLocalState({ ...current, user: { role, name: role } });
      }
      // Update our own entry in users list with the real role
      setUsers(prev => prev.map(u => u.isLocal ? { ...u, role, name: role } : u));
    };
    socket.on("role", handleRole);
    return () => socket.off("role", handleRole);
  }, []);

  /* ---------------- MESH WEBRTC SETUP ---------------- */
  useEffect(() => {
    if (!roomId) return;

    const onConnect = () => {
      setConnected(true);
      socket.emit("join-room", roomId);
    };

    // Server sends list of existing peers → we initiate offer to each
    const onRoomPeers = async ({ peers }) => {
      await startMedia(); // always start media — even if alone in room

      if (peers.length === 0) return; // first in room, nothing else to do

      for (const peerId of peers) {
        const pc = await createPeerConnection(peerId);
        const channel = pc.createDataChannel("chat");
        dataChannelsRef.current[peerId] = channel;
        setupDataChannel(channel, peerId);
        console.log(`📤 Creating offer to ${peerId}, senders: ${pc.getSenders().length}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer, targetId: peerId });
      }
    };

    // New peer joined → make sure our media is ready for when they send an offer
    const onPeerJoined = async () => {
      await startMedia();
    };

    const onOffer = async ({ offer, fromId }) => {
      // only set if we're in stable state — prevents duplicate offer errors
      if (peerConnectionsRef.current[fromId]?.signalingState === "have-local-offer") return;
      await startMedia(); // ensure media ready before creating PC so tracks are added
      const pc = await createPeerConnection(fromId); // tracks added inside here from localStreamRef
      console.log(`📨 Got offer from ${fromId}, senders: ${pc.getSenders().length}`);
      await pc.setRemoteDescription(offer); //tells it what the other peer wants.
      (pendingIceCandidates.current[fromId] ?? []).forEach(c => pc.addIceCandidate(c));
      pendingIceCandidates.current[fromId] = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer); //tells the browser what you want the WebRTC session to look like, and
      socket.emit("answer", { roomId, answer, targetId: fromId });
    };

    const onAnswer = async ({ answer, fromId }) => {
      // only set if we're actually waiting for an answer — prevents duplicate answer errors
      const pc = peerConnectionsRef.current[fromId];
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(answer);
      (pendingIceCandidates.current[fromId] ?? []).forEach(c => pc.addIceCandidate(c));
      pendingIceCandidates.current[fromId] = [];
    };

    const onIceCandidate = async ({ candidate, fromId }) => { // this save the incoming ice-candidate to rtc connection so browser can check which route should be taken (happens internally)
      const pc = peerConnectionsRef.current[fromId];
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(candidate);
      } else {
        if (!pendingIceCandidates.current[fromId]) pendingIceCandidates.current[fromId] = [];
        pendingIceCandidates.current[fromId].push(candidate);
      }
    };

    const onPeerLeft = ({ peerId }) => {
      peerConnectionsRef.current[peerId]?.close();
      delete peerConnectionsRef.current[peerId];
      delete dataChannelsRef.current[peerId];
      delete roomKeysRef.current[peerId];
      setRemoteStreams(prev => { const n = { ...prev }; delete n[peerId]; return n; });
      setConnectedPeers(prev => prev.filter(id => id !== peerId));
    };

    if (!socket.connected) socket.connect();
    socket.on("connect", onConnect);
    socket.on("room-peers", onRoomPeers);
    socket.on("peer-joined", onPeerJoined);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("peer-left", onPeerLeft);

    return () => {
      socket.off("connect", onConnect);
      socket.off("room-peers", onRoomPeers);
      socket.off("peer-joined", onPeerJoined);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("peer-left", onPeerLeft);
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
      dataChannelsRef.current = {};
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
  }, [roomId]);

  /* ---------------- HANDLERS ---------------- */
  const handleSend = () => { sendEncryptedChat(msg); setMsg(''); };
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLocalAwareness({ cursor: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
  };
  const handleMouseLeave = () => setLocalAwareness({ cursor: null });
  const handleCanvasMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLocalAwareness({ canvasCursor: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
  };
  const handleCanvasMouseLeave = () => setLocalAwareness({ canvasCursor: null });
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => (t.enabled = !isMicOn));
    setIsMicOn(v => !v);
  };
  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => (t.enabled = !isCameraOn));
    setIsCameraOn(v => !v);
  };

  const sendWhiteboardMessage = useCallback((type, payload) => {
    broadcastMessage(type, payload);
  }, []);

  /* ---------------- RENDER ---------------- */
  const remotePeerIds = Object.keys(remoteStreams);
  // Use connectedPeers for tiles so grid shows even when video isn't available

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-pink-400 to-yellow-400 p-4">
      <div className="w-full h-[95vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 p-4 rounded-t-2xl border-2 border-white/30 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Encrypted Video Room</h1>
                <p className="text-white/90 text-xs font-medium">Room: {roomId}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 ${connected
                ? 'bg-green-400/30 border-green-300' : 'bg-red-400/30 border-red-300'}`}>
                {connected
                  ? <><Wifi className="w-4 h-4 text-white" /><span className="text-white text-sm font-bold">Connected</span></>
                  : <><WifiOff className="w-4 h-4 text-white" /><span className="text-white text-sm font-bold">Disconnected</span></>}
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400/30 rounded-lg border-2 border-yellow-300">
                <Shield className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-bold">{role}</span>
              </div>

              <div className="flex items-center bg-white/20 rounded-xl border-2 border-white/30 overflow-hidden">
                <button onClick={() => setView("video")}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-bold transition-all ${view === "video" ? "bg-white/30 text-white" : "text-white/70 hover:text-white"}`}>
                  <Monitor className="w-4 h-4" /> Video
                </button>
                <button onClick={() => setView("whiteboard")}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-bold transition-all ${view === "whiteboard" ? "bg-white/30 text-white" : "text-white/70 hover:text-white"}`}>
                  <PenLine className="w-4 h-4" /> Board
                </button>
              </div>

              <button onClick={() => { setIsChatOpen(!isChatOpen); setIsChatMinimized(false); }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg border-2 border-white/30 transition-all shadow-lg">
                <MessageSquare className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-bold">{isChatOpen ? 'Hide Chat' : 'Show Chat'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 bg-gradient-to-br from-purple-400/20 via-pink-400/20 to-cyan-400/20 backdrop-blur-xl border-x-2 border-white/30 overflow-hidden relative">

          {/* Video Grid — dynamic for N peers */}
          {view === "video" && (
            <div className="w-full h-full p-4 relative">
              <div className={`w-full h-full grid gap-4 ${
                connectedPeers.length === 0 ? "grid-cols-1" :
                connectedPeers.length === 1 ? "grid-cols-2" :
                "grid-cols-2 grid-rows-2"
              }`}>
                {/* Local */}
                <div className="relative bg-gradient-to-br from-pink-300 to-purple-300 rounded-3xl border-4 border-white/50 shadow-2xl overflow-hidden">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border-2 border-white/30">
                    <span className="text-white font-bold text-sm">You ({role})</span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
                  </div>
                </div>

                {/* Remote peers — one tile per connected peer, video optional */}
                {connectedPeers.map((peerId, idx) => (
                  <div key={peerId} className="relative bg-gradient-to-br from-cyan-300 to-blue-300 rounded-3xl border-4 border-white/50 shadow-2xl overflow-hidden">
                    <video
                      autoPlay playsInline
                      ref={el => { if (el) el.srcObject = remoteStreams[peerId] ?? null; }}
                      className="w-full h-full object-cover"
                    />
                    {!remoteStreams[peerId] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-300 to-blue-300">
                        <div className="text-white text-center">
                          <VideoOff className="w-12 h-12 mx-auto mb-2 opacity-60" />
                          <p className="text-sm font-bold opacity-80">No camera</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border-2 border-white/30">
                      <span className="text-white font-bold text-sm">Peer {idx + 1}</span>
                    </div>
                    <div className="absolute top-4 right-4">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
                    </div>
                  </div>
                ))}
              </div>


            </div>
          )}

          {/* Whiteboard — always mounted, shown/hidden via CSS to prevent remount flicker */}
          <div
            className="w-full h-full"
            style={{ display: view === "whiteboard" ? "block" : "none" }}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
          >
            <WhiteboardPanel
              ydocRef={ydocRef}
              sendMessage={sendWhiteboardMessage}
              role={role}
              users={users}
            />
          </div>
        </div>

        {/* Footer Controls */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 p-4 rounded-b-2xl border-2 border-t-0 border-white/30 shadow-2xl">
          <div className="flex items-center justify-center gap-4">
            <button onClick={toggleMic}
              className={`p-4 rounded-2xl border-2 transition-all shadow-lg ${isMicOn ? 'bg-white/20 border-white/40 hover:bg-white/30' : 'bg-red-500 border-red-400'}`}>
              {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
            </button>
            <button onClick={toggleCamera}
              className={`p-4 rounded-2xl border-2 transition-all shadow-lg ${isCameraOn ? 'bg-white/20 border-white/40 hover:bg-white/30' : 'bg-red-500 border-red-400'}`}>
              {isCameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
            </button>
            <button className="p-4 bg-red-500 hover:bg-red-600 rounded-2xl border-2 border-red-400 shadow-lg">
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-4 right-4 z-50 transition-all duration-300">
          {isChatMinimized ? (
            <button onClick={() => setIsChatMinimized(false)}
              className="relative bg-gradient-to-r from-pink-500 to-purple-500 p-4 rounded-2xl shadow-2xl border-2 border-white/50 hover:scale-105 transition-transform">
              <MessageSquare className="w-6 h-6 text-white" />
              {messages.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-purple-900 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                  {messages.length}
                </span>
              )}
            </button>
          ) : (
            <div className="w-96 h-[600px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-4 border-pink-300 flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 p-4 border-b-2 border-white/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white text-lg">Chat</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsChatMinimized(true)} className="p-1.5 hover:bg-white/20 rounded-lg">
                    <Minimize2 className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => setIsChatOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Users List */}
              <div className="bg-gradient-to-r from-pink-100 to-purple-100 p-3 border-b-2 border-pink-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-bold text-purple-900">Active Users</span>
                  <span className="ml-auto bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                    {users.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {users.map((u, idx) => (
                    <div key={u.clientId ?? idx}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border-2 border-pink-300 shadow-md">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow"
                        style={{ background: u.color ?? "#a78bfa" }}>
                        {(u.role ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-purple-900">
                        {u.role}{u.isLocal ? " (you)" : ""}
                      </span>
                      <div className="w-2 h-2 bg-green-400 rounded-full border border-green-600 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-br from-pink-50 to-purple-50">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.sender === role ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-lg ${m.sender === role
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border-2 border-pink-300'
                      : 'bg-white text-purple-900 border-2 border-cyan-300'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${m.sender === role ? 'text-pink-100' : 'text-purple-600'}`}>{m.sender}</span>
                        <span className={`text-xs ${m.sender === role ? 'text-pink-200' : 'text-purple-400'}`}>
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-white border-t-2 border-pink-200">
                <div className="flex gap-2">
                  <input type="text" value={msg} onChange={(e) => setMsg(e.target.value)}
                    onKeyDown={handleKeyPress} placeholder="Type a message..."
                    className="flex-1 bg-gradient-to-r from-pink-100 to-purple-100 text-purple-900 placeholder-purple-400 rounded-xl px-4 py-2 text-sm border-2 border-pink-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-300 outline-none transition-all font-medium" />
                  <button onClick={handleSend} disabled={!msg.trim()}
                    className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg border-2 border-white/30">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 px-1">
                  <Lock className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-purple-600 font-semibold">End-to-end encrypted</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}