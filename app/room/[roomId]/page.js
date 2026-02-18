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
import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { Send, Users, Wifi, WifiOff, Shield, Lock, MessageSquare, X, Minimize2, Video, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';
export default function Room() {
  const { roomId } = useParams();
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState(null);
  const [msg, setMsg] = useState("");
  const roomKeyRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);

  const pcRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const dataChannelsRef = useRef({});
  const localStreamRef = useRef(null);
  const pendingIce = useRef([]);

  const roleRef = useRef(null);
  const localVideoRef = useRef(null);
  const rsaKeyPairRef = useRef(null);
  const peerPublicKeyRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerReadyRef = useRef(false);

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const ydocRef = useRef(null);
  const awarenessRef = useRef(null);
  const ymapRef = useRef(null);

  /* ---------------- MEDIA ---------------- */
  const startMedia = async () => { //it prepares media to be sent by attaching tracks to the RTCPeerConnection.

    if (localStreamRef.current) return;
    if (roleRef.current !== "host") return;
    const stream = await navigator.mediaDevices.getUserMedia({ //which devices to be shared or opened during sharing
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      if (pcRef.current) {
        pcRef.current.addTrack(track, stream);
      }
    });
  };

  /* ---------------- DATA CHANNEL ---------------- */
  const createDataChannel = () => {
    const channel = pcRef.current.createDataChannel("chat");
    const peerId = socket.id; // temporary until you improve signaling
    dataChannelsRef.current[peerId] = channel;

    channel.onopen = async () => {
      console.log("✅ DataChannel open (host)");
      if (ymapRef.current) {
        ymapRef.current.set("lastConnected", Date.now());
      }
      // 🔑 1️⃣ Generate AES room key FIRST
      roomKeyRef.current = await generateRoomKey();

      // 🔐 2️⃣ Generate RSA keys
      rsaKeyPairRef.current = await generateRSAKeyPair();

      // 📤 3️⃣ Send RSA public key
      const publicKey = await exportPublicKey(
        rsaKeyPairRef.current.publicKey
      );

      sendMessage("control", {
        action: "PUBLIC_KEY",
        key: publicKey,
      });
    };




    channel.onmessage = (e) => handleMessage(e.data);

  };
  async function sendEncryptedChat(text) {
    if (!roomKeyRef.current) return;

    const message = {
      text,
      sender: roleRef.current ?? "unknown",
      timestamp: Date.now(),
    };

    // 1️⃣ Add locally
    setMessages(prev => [...prev, message]);

    // 2️⃣ Encrypt
    const encryptedPayload = await encrypt(roomKeyRef.current, message);

    // 3️⃣ Send
    sendMessage("chat", encryptedPayload);
  }
  function sendMessage(type, payload) {
  const channel = dataChannelsRef.current["active"];
  if (!channel || channel.readyState !== "open") return;

  channel.send(JSON.stringify({
    type,
    payload,
    ts: Date.now()
  }));
}
  async function handleMessage(raw) {
    const msg = JSON.parse(raw);

    switch (msg.type) {
      case "chat": {
        if (!roomKeyRef.current) {
          console.warn("Chat received before key, dropping message");
          return;
        }
        try {
          const decrypted = await decrypt(roomKeyRef.current, msg.payload);

          const chatMessage = {
            sender: decrypted.sender,
            text: decrypted.text,
            timestamp: msg.ts,
          };

          setMessages(prev => [...prev, chatMessage]);
        } catch {
          // silently drop invalid / corrupted / foreign messages
        }
        break;
      }

      case "presence":
        setUsers((u) => {
          if (u.find(x => x.userId === msg.payload.userId)) return u;
          return [...u, msg.payload];
        });
        break;


      case "control":

        // 1️⃣ Receive peer public key
        if (msg.payload.action === "PUBLIC_KEY") {
          peerPublicKeyRef.current = await importPublicKey(msg.payload.key);
          console.log("🔑 Peer public key received");

          // Host encrypts AES key and sends it
          if (roleRef.current === "host") {
            const rawAESKey = await exportKey(roomKeyRef.current);

            const encryptedKey = await encryptWithPublicKey(
              peerPublicKeyRef.current,
              rawAESKey
            );

            sendMessage("control", {
              action: "SET_KEY_SECURE",
              key: encryptedKey,
            });
          }
        }

        // 2️⃣ Receive encrypted AES key
        if (msg.payload.action === "SET_KEY_SECURE") {
          const rawAESKey = await decryptWithPrivateKey(
            rsaKeyPairRef.current.privateKey,
            msg.payload.key
          );

          roomKeyRef.current = await importKey(rawAESKey);
          console.log("🔐 Secure room key established");
        }

        break;

      case "yjs-update": {
        if (!roomKeyRef.current) return;

        try {
          const decrypted = await decrypt(roomKeyRef.current, msg.payload);
          const update = new Uint8Array(decrypted);

          Y.applyUpdate(ydocRef.current, update, "remote");

          // If host, forward to all other peers
          if (roleRef.current === "host") {
            Object.entries(dataChannelsRef.current).forEach(([peerId, channel]) => {
              if (channel.readyState === "open") {
                channel.send(JSON.stringify({
                  type: "yjs-update",
                  payload: msg.payload,
                  ts: Date.now()
                }));
              }
            });
          }

        } catch { }

        break;
      }

    }
  }

  async function getIceServers() {
    try {
      const res = await fetch("/api/turn");
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Shared test map
    ymapRef.current = ydoc.getMap("room-state");

    // Awareness
    awarenessRef.current = new Awareness(ydoc);

    // 🔁 Send Yjs updates over encrypted channel
    ydoc.on("update", async (update, origin) => {
      if (origin === "remote") return;
      if (!roomKeyRef.current) return;

      const encrypted = await encrypt(
        roomKeyRef.current,
        Array.from(update)
      );

      sendMessage("yjs-update", encrypted);
    });

  }, []);
  useEffect(() => {
    const handleRole = async ({ role }) => {
      roleRef.current = role;
      console.log("Role:", role);
      setRole(role);

    };

    socket.on("role", handleRole);

    return () => {
      socket.off("role", handleRole);
    };
  }, []);


  /* ---------------- SETUP ---------------- */
  useEffect(() => {
    let active = true;

    (async () => {
      if (!roomId) return;

      const iceServers = await getIceServers();
      if (!active) return;

      pcRef.current = new RTCPeerConnection({ // basic webrtc connection 
        iceServers  //stun servers finds out the public ip of the machine and provides to ice candidate
      });                                                       //NAT = Network Address Translation. It’s a technique used by routers to let many private devices share one public IP address.

      // we are using stun and turn servers because the stun only provides public ip but that doesnt guarentee connection
      // after stun fails turn take over and guarentees all traffic to be relayed through it 


      const pc = pcRef.current;

      pc.ontrack = (e) => {
        console.log("ontrack fired", e.track.kind);

        let stream = remoteVideoRef.current.srcObject;

        if (!stream) {
          stream = new MediaStream();
          remoteVideoRef.current.srcObject = stream;
        }

        stream.addTrack(e.track);

        // 🔑 explicitly request playback
        remoteVideoRef.current
          .play()
          .catch(() => {
            console.log("Autoplay blocked until user gesture");
          });
      };


      pc.onicecandidate = (e) => { // ice-candidates send our info like ip router etc to others throught socket 
        if (e.candidate) {
          socket.emit("ice-candidate", {
            roomId,
            candidate: e.candidate,
          });

          console.log(e.candidate.candidate);
        }
      };


      pc.ondatachannel = (e) => { // data channel will listen to the upcoming msg and call handle message
        const channel = e.channel;
        const peerId = socket.id; // temporary until you improve signaling
        dataChannelsRef.current[peerId] = channel;

        channel.onopen = async () => {
          console.log("✅ DataChannel open (peer)");
          if (ymapRef.current) {
            ymapRef.current.set("lastConnected", Date.now());
          }
          rsaKeyPairRef.current = await generateRSAKeyPair();

          const publicKey = await exportPublicKey(
            rsaKeyPairRef.current.publicKey
          );

          sendMessage("control", {
            action: "PUBLIC_KEY",
            key: publicKey,
          });

          sendMessage("presence", { role: "peer" });
        };


        channel.onmessage = (e) => handleMessage(e.data); // this listens to the message 


        channel.onclose = () => {
          console.warn("❌ DataChannel closed");
        };

        channel.onerror = (e) => {
          console.error("⚠️ DataChannel error", e);
        };
      };

      if (!socket.connected) socket.connect();

      const onConnect = () => {
        setConnected(true);
        socket.emit("join-room", roomId);
      };

      const onPeerReady = async () => {
        peerReadyRef.current = true;
        if (roleRef.current !== "host") return;
        if (!pcRef.current) return;

        await startMedia();              //these two are called before offer because webrtc state should have everything before making an offer 
        createDataChannel();             // everything means info about stream and tracks
        await Promise.resolve();
        console.log(
          "Senders before offer:",
          pcRef.current.getSenders().map(s => s.track?.kind)
        );
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);

        socket.emit("offer", { roomId, offer });
      };

      const onOffer = async ({ offer }) => {
        await pc.setRemoteDescription(offer);  //tells it what the other peer wants.

        pendingIce.current.forEach((c) => pc.addIceCandidate(c));
        pendingIce.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer); //tells the browser what you want the WebRTC session to look like, and

        socket.emit("answer", { roomId, answer });
      };

      const onAnswer = async ({ answer }) => {
        await pc.setRemoteDescription(answer);

        pendingIce.current.forEach((c) => pc.addIceCandidate(c));
        pendingIce.current = [];
      };

      const onIceCandidate = async ({ candidate }) => { // this save the incoming ice-candidate to rtc connection so browser can check which route should be taken (happens internally) 
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingIce.current.push(candidate);
        }
      };

      socket.on("connect", onConnect);
      socket.on("peer-ready", onPeerReady);
      socket.on("offer", onOffer);
      socket.on("answer", onAnswer);
      socket.on("ice-candidate", onIceCandidate);

      return () => {
        socket.off("connect", onConnect);
        socket.off("peer-ready", onPeerReady);
        socket.off("offer", onOffer);
        socket.off("answer", onAnswer);
        socket.off("ice-candidate", onIceCandidate);

        roleRef.current = null;
        peerReadyRef.current = false;

        if (pcRef.current) {
          pcRef.current.close();
        }

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      };
    })();

    return () => {
      active = false;
    };
  }, [roomId]);
  const handleSend = () => {
    sendEncryptedChat(msg);
    setMsg('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-pink-400 to-yellow-400 p-4">
      <div className="w-full h-[95vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 p-4 rounded-t-2xl border-2 border-white/30 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Encrypted Video Room</h1>
                <p className="text-white/90 text-xs font-medium">Room: {roomId}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 ${connected
                ? 'bg-green-400/30 border-green-300 shadow-lg shadow-green-400/20'
                : 'bg-red-400/30 border-red-300 shadow-lg shadow-red-400/20'
                }`}>
                {connected ? (
                  <>
                    <Wifi className="w-4 h-4 text-white drop-shadow" />
                    <span className="text-white text-sm font-bold drop-shadow">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-white drop-shadow" />
                    <span className="text-white text-sm font-bold drop-shadow">Disconnected</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400/30 rounded-lg border-2 border-yellow-300 shadow-lg shadow-yellow-400/20">
                <Shield className="w-4 h-4 text-white drop-shadow" />
                <span className="text-white text-sm font-bold drop-shadow">{role}</span>
              </div>

              <button
                onClick={() => {
                  setIsChatOpen(!isChatOpen);
                  setIsChatMinimized(false);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg border-2 border-white/30 transition-all shadow-lg"
              >
                <MessageSquare className="w-4 h-4 text-white drop-shadow" />
                <span className="text-white text-sm font-bold drop-shadow">
                  {isChatOpen ? 'Hide Chat' : 'Show Chat'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Video Grid */}
        <div className="flex-1 bg-gradient-to-br from-purple-400/20 via-pink-400/20 to-cyan-400/20 backdrop-blur-xl border-x-2 border-white/30 p-6 overflow-hidden">
          <div className="w-full h-full grid grid-cols-2 gap-6">

            {/* Local Video */}
            <div className="relative bg-gradient-to-br from-pink-300 to-purple-300 rounded-3xl border-4 border-white/50 shadow-2xl overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border-2 border-white/30">
                <span className="text-white font-bold text-sm drop-shadow">You ({role})</span>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
              </div>
            </div>

            {/* Remote Video */}
            <div className="relative bg-gradient-to-br from-cyan-300 to-blue-300 rounded-3xl border-4 border-white/50 shadow-2xl overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border-2 border-white/30">
                <span className="text-white font-bold text-sm drop-shadow">Remote User</span>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 p-4 rounded-b-2xl border-2 border-t-0 border-white/30 shadow-2xl">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-4 rounded-2xl border-2 transition-all shadow-lg ${isMicOn
                ? 'bg-white/20 border-white/40 hover:bg-white/30'
                : 'bg-red-500 border-red-400 hover:bg-red-600'
                }`}
            >
              {isMicOn ? (
                <Mic className="w-6 h-6 text-white drop-shadow" />
              ) : (
                <MicOff className="w-6 h-6 text-white drop-shadow" />
              )}
            </button>

            <button
              onClick={() => setIsCameraOn(!isCameraOn)}
              className={`p-4 rounded-2xl border-2 transition-all shadow-lg ${isCameraOn
                ? 'bg-white/20 border-white/40 hover:bg-white/30'
                : 'bg-red-500 border-red-400 hover:bg-red-600'
                }`}
            >
              {isCameraOn ? (
                <Video className="w-6 h-6 text-white drop-shadow" />
              ) : (
                <VideoOff className="w-6 h-6 text-white drop-shadow" />
              )}
            </button>

            <button className="p-4 bg-red-500 hover:bg-red-600 rounded-2xl border-2 border-red-400 transition-all shadow-lg hover:shadow-red-500/50">
              <PhoneOff className="w-6 h-6 text-white drop-shadow" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-4 right-4 z-50 transition-all duration-300">
          {isChatMinimized ? (
            <button
              onClick={() => setIsChatMinimized(false)}
              className="relative bg-gradient-to-r from-pink-500 to-purple-500 p-4 rounded-2xl shadow-2xl border-2 border-white/50 hover:scale-105 transition-transform"
            >
              <MessageSquare className="w-6 h-6 text-white" />
              {messages.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-purple-900 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                  {messages.length}
                </span>
              )}
            </button>
          ) : (
            <div className="w-96 h-[600px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-4 border-pink-300 flex flex-col overflow-hidden">

              {/* Chat Header */}
              <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 p-4 border-b-2 border-white/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-white drop-shadow" />
                  <h3 className="font-bold text-white text-lg drop-shadow">Chat</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsChatMinimized(true)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <Minimize2 className="w-4 h-4 text-white drop-shadow" />
                  </button>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4 text-white drop-shadow" />
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
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border-2 border-pink-300 shadow-md"
                    >
                      <div className="w-6 h-6 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow">
                        {u.role?.charAt(0) || 'U'}
                      </div>
                      <span className="text-xs font-bold text-purple-900">{u.role}</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full border border-green-600 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-br from-pink-50 to-purple-50">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.sender === role ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-lg ${m.sender === role
                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border-2 border-pink-300'
                        : 'bg-white text-purple-900 border-2 border-cyan-300'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${m.sender === role ? 'text-pink-100' : 'text-purple-600'
                          }`}>
                          {m.sender}
                        </span>
                        <span className={`text-xs ${m.sender === role ? 'text-pink-200' : 'text-purple-400'
                          }`}>
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
                  <input
                    type="text"
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 bg-linear-to-r from-pink-100 to-purple-100 text-purple-900 placeholder-purple-400 rounded-xl px-4 py-2 text-sm border-2 border-pink-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-300 outline-none transition-all font-medium"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!msg.trim()}
                    className="bg-linear-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg border-2 border-white/30"
                  >
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
