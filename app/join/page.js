"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const handleJoin = async() => {
    if (!roomId.trim()) return;
    const res = await fetch('http://localhost:3000/api/join',{
      method:'POST',
        headers: {
          "Content-Type": "application/json",
        },
        credentials:"include",
        body: JSON.stringify({roomId}),
    })
    if(res.status==200) router.push(`/room/${roomId}`);
    if(res.status==400) {
      console.log("room doesnt exist");
      return ;
    }
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
