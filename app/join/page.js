"use client"
import { useState } from "react";
export default function Home() {
  const [room_code,setRoom_code] = useState("");
    
  const joinroom = async()=>{

  }
  return (
   
          <div>
            Join ROom
            <input type="text" onChange={(e)=>{setRoom_code(e.target.value)}}/>
            <button onClick={joinroom}> Join Room 

            </button>
          </div>
        
  )
}
