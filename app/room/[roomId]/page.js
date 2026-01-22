"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { useParams } from "next/navigation";

export default function Room() {
  const { roomId } = useParams();
  const [connected, setConnected] = useState(false);

  const pcRef = useRef(null);

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
      socket.emit("join-room", roomId);
    });

    socket.on("offer", async ({ offer }) => {
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async ({ answer }) => {
      await pc.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      await pc.addIceCandidate(candidate);
    });

    return () => {
      socket.off("connect");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");

      socket.disconnect();
      pc.close();
    };
  }, [roomId]);

  // Call this ONLY for host
  const sendOffer = async () => {
    const pc = pcRef.current;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

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
