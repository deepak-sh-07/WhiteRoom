"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";

export default function Room() {
  const { roomId } = useParams();
  const localStreamRef = useRef(null);

  const [connected, setConnected] = useState(false);

  const pcRef = useRef(null);
  const pendingIceCandidates = useRef([]);
  const dataChannelRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  /* -------------------- MEDIA -------------------- */
  const startMedia = async () => {
  if (localStreamRef.current) return;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  localStreamRef.current = stream;
  localVideoRef.current.srcObject = stream;

  stream.getTracks().forEach((track) => {
    pcRef.current.addTrack(track, stream);
  });
};


  /* -------------------- DATA CHANNEL -------------------- */
  const createDataStream = () => {
    const pc = pcRef.current;

    const channel = pc.createDataChannel("chat");
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log("✅ DataChannel open (host)");
      channel.send("Hello from host");
    };

    channel.onmessage = (e) => {
      console.log("From peer:", e.data);
    };

    channel.onclose = () => {
      console.log("❌ DataChannel closed");
    };
  };

  /* -------------------- SOCKET + PEER SETUP -------------------- */
  useEffect(() => {
    if (!roomId) return;

    /* ---- PeerConnection ---- */
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const pc = pcRef.current;

    pc.onconnectionstatechange = () => {
      console.log("PC state:", pc.connectionState);
    };

    pc.ontrack = (event) => {
      console.log("🎥 Remote track received");
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;

      channel.onopen = () => {
        console.log("✅ DataChannel open (receiver)");
      };

      channel.onmessage = (e) => {
        console.log("From host:", e.data);
        channel.send("Hello back from receiver");
      };
    };

    /* ---- Socket ---- */
    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", () => {
      console.log("Socket connected");
      setConnected(true);
      socket.emit("join-room", roomId);
    });

    socket.on("offer", async ({ offer }) => {
      console.log("📥 Offer received");

      await startMedia();
      await pc.setRemoteDescription(offer);

      // flush queued ICE
      pendingIceCandidates.current.forEach(async (c) => {
        await pc.addIceCandidate(c);
      });
      pendingIceCandidates.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { roomId, answer });
      console.log("📤 Answer sent");
    });

    socket.on("answer", async ({ answer }) => {
      console.log("📥 Answer received");

      await pc.setRemoteDescription(answer);

      // flush queued ICE
      pendingIceCandidates.current.forEach(async (c) => {
        await pc.addIceCandidate(c);
      });
      pendingIceCandidates.current = [];
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(candidate);
      } else {
        pendingIceCandidates.current.push(candidate);
      }
    });
    if (localStreamRef.current) {
  localStreamRef.current.getTracks().forEach(track => track.stop());
  localStreamRef.current = null;
}

    return () => {
      socket.off("connect");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      pc.close();
    };
  }, [roomId]);

  /* -------------------- HOST ACTION -------------------- */
  const sendOffer = async () => {
    console.log("🔥 Start Connection clicked");

    if (!socket.connected) {
      console.error("❌ Socket not connected");
      return;
    }

    await startMedia();
    createDataStream();

    const pc = pcRef.current;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log("📤 Sending offer");
    socket.emit("offer", { roomId, offer });
  };

  /* -------------------- UI -------------------- */
  return (
    <div>
      <h1>Room: {roomId}</h1>
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>

      <button onClick={sendOffer}>Start Connection</button>

      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <video ref={localVideoRef} autoPlay muted playsInline width={300} />
        <video ref={remoteVideoRef} autoPlay playsInline width={300} />
      </div>
    </div>
  );
}
