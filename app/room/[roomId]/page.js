"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";

export default function Room() {
  const { roomId } = useParams();
  const [connected, setConnected] = useState(false);

  const pcRef = useRef(null);
useEffect(() => {
  if (!roomId) return;

  if (!socket.connected) {
    socket.connect();
  }

  console.log("Joining room with roomId:", roomId);
  socket.emit("join-room", roomId);

}, [roomId]);

  useEffect(() => {
    // Create PC ONCE
    
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const pc = pcRef.current;

    // ICE handling
    pc.onicecandidate = (event) => {  //to get own ip then sent to every one 
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      
    });

    socket.on("offer", async ({ offer }) => {
  console.log("📥 Offer received");
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
  console.log("📤 Answer sent");
});

socket.on("answer", async ({ answer }) => {
  console.log("📥 Answer received");
  await pc.setRemoteDescription(answer);
});


    socket.on("ice-candidate", async ({ candidate }) => {
      await pc.addIceCandidate(candidate);
    });
    pc.ondatachannel = (event) => {
  const dataChannel = event.channel;

  dataChannel.onopen = () => {
    console.log("✅ DataChannel open (receiver)");
  };

  dataChannel.onmessage = (e) => {
    console.log("From host:", e.data);
    dataChannel.send("Hello back from receiver");
  };
};

    return () => {
      socket.off("connect");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");

      socket.disconnect();
      pc.close();
    };
  }, [roomId]);

  const dataChannelRef = useRef(null);

const createDataStream = () => {
  const pc = pcRef.current;

  const dataChannel = pc.createDataChannel("chat");
  dataChannelRef.current = dataChannel;

  dataChannel.onopen = () => {
    console.log("✅ DataChannel open");
    dataChannel.send("Hello from host");
  };

  dataChannel.onmessage = (e) => {
    console.log("From peer:", e.data);
  };

  dataChannel.onclose = () => {
    console.log("❌ DataChannel closed");
  };
};

  // Call this ONLY for host
  const sendOffer = async () => {
  console.log("🔥 Start Connection clicked");
  if (!socket.connected) {
  console.error("❌ Socket not connected yet");
  return;
}

  const pc = pcRef.current;
  createDataStream();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  console.log("📤 Sending offer", offer);

  socket.emit("offer", { roomId, offer });
};


  return (
    <div>
      <h1>Room: {roomId}</h1>
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>

      <button onClick={sendOffer}>Start Connection</button>
    </div>
  );
}
