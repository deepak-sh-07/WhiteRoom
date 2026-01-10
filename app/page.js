"use client"
import { useState } from "react";
export default function Home() {
  const [room,setRoom] = useState(false);
  const [name,setName] = useState("");
  const [room_code,setRoom_code] = useState("");
  const createroom = async ()=>{
    const res = await fetch("/api/rooms",{
      method:'POST',
        headers: {
          "Content-Type": "application/json",
        },
        credentials:'include',
        body: JSON.stringify({ name, room_code }),
    })
  }
  return (
    <div>
      THis is the dashboard
      <button onClick={()=>setRoom(true)}> Create Room  </button>
      {
        room &&(
          <div>
          <input type="text" placeholder="Name" onChange={(e)=>setName(e.target.value)}/>
          <input type="text" placeholder="Room Code" onChange={(e)=>setRoom_code(e.target.value)}/>
          <button onClick={createroom}>Submit</button>
          </div>
          
        )
      }
    </div>
  );
}
