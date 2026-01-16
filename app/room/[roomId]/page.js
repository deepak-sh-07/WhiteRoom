"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";

export default function Room({ params }) {
  const { roomId } = params;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // connect socket
    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", roomId);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    return () => {
      socket.emit("leave-room", roomId);
      socket.off("connect");
      socket.off("disconnect");
      socket.disconnect();
    };
  }, [roomId]);

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>
    </div>
  );
}
