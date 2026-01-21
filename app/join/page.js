"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const handleJoin = async () => {
  if (!roomId.trim()) return;

  const res = await fetch("/api/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomId }), 
  });

  if (res.status === 200) router.push(`/room/${roomId}`);
  else if (res.status === 404) console.log("Room doesn't exist");
  else console.log("Invalid room code");
};


  return (
    <div>
      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Enter room ID"
      />
      <button onClick={handleJoin}>Join</button>
    </div>
  );
}
