"use client"
import { useState } from "react";
import { useRouter } from 'next/navigation';
export default function Home() {
  const router = useRouter();
  
  return (
    <div>
      THis is the dashboard
     <button onClick={()=> router.push("/create")}>Create Room</button>
     <button onClick={()=> router.push("/join")}>Join Room</button>
    </div>
  );
}
