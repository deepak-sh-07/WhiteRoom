"use client"
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Home() {
  const router = useRouter();
  const check = async()=>{
    const res = await fetch("/api/me", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    
  });
  const data = res.json();
  if(data.status==404) router.push("/login");
  }
  
  useEffect(()=>{
    check();
  })
  return (
    <div>
      THis is the dashboard
     <button onClick={()=> router.push("/create")}>Create Room</button>
     <button onClick={()=> router.push("/join")}>Join Room</button>
    </div>
  );
}
