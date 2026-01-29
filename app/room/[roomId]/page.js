"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";

export default function Room() {
  const { roomId } = useParams();
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState(null);
  const [msg, setMsg] = useState("");
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIce = useRef([]);
  const dataChannelRef = useRef(null);
  const roleRef = useRef(null)
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerReadyRef = useRef(false);


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

    stream.getTracks().forEach((track) =>
      pcRef.current.addTrack(track, stream)
    );
  };

  /* ---------------- DATA CHANNEL ---------------- */
  const createDataChannel = () => {
    const channel = pcRef.current.createDataChannel("chat");
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log("✅ DataChannel open (host)");
      channel.send("Hello from host");
    };

    channel.onmessage = (e) => {
      console.log("💬 Peer:", e.data);
    };
  };


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
    if (!roomId) return;

    pcRef.current = new RTCPeerConnection({ // basic webrtc connection 
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

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
      }
    };

    pc.ondatachannel = (e) => {
      const channel = e.channel;
      dataChannelRef.current = channel;

      channel.onopen = () => {
        console.log("✅ DataChannel open (peer)");
      };

      channel.onmessage = (e) => {
        console.log("💬 Host:", e.data);
        channel.send("Hello back from peer");
        // channel.send(msg);
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

      pc.close();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [roomId]);


  return (
    <div>
      <h2>Room: {roomId}</h2>
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>
      <p>Role: {role}</p>
      <input type="text" onChange={(e) => setMsg(e.target.value)} />
      <div style={{ display: "flex", gap: 10 }}>
        <video ref={localVideoRef} autoPlay muted playsInline width={300} />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted   // 🔑 required for autoplay
          width={300}
        />
      </div>
    </div>
  );
}
