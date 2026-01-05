"use client"
import React from 'react'
import { useState } from 'react';
export default function login(){
    const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name,setName] = useState("");
  const [isLogin,setIsLogin] = useState(true);
  const handlelogin = ()=>{
    const res = fetch('http://localhost:3000/api/login',{
        method:'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    })
  }
  const handleregister = ()=>{
    const res = fetch('http://localhost:3000/api/register',{
      method:'POST',
      headers:{
        "Content-Type" : "application/json",
      },
      body: JSON.stringify({ name,email, password }),
    })
  }

  return(
    <>
    {
      isLogin && (
        <div>
        <input type="text" placeholder='email' onChange={(e)=>setEmail(e.target.value)}/>
        <input type="text" placeholder='password' onChange={(e)=>setPassword(e.target.value)}/>
        <button onClick={handlelogin}>Submit </button>
        <div>New User</div> 
        <button onClick={()=>setIsLogin(false)}>Sign Up0 </button>
        
    </div>
      )
    }
     {
      !isLogin &&(
        <div>
          <input type="text" placeholder='Name' onChange={(e)=>setName(e.target.value)}/>
          <input type="text" placeholder='email' onChange={(e)=>setEmail(e.target.value)}/>
        <input type="text" placeholder='password' onChange={(e)=>setPassword(e.target.value)}/>
        <button onClick={handleregister}>Submit </button>
        <div>Already a User</div> 
        <button onClick={()=>setIsLogin(true)}>Sign in </button>
        </div>
        
      )
     }
     
    </>
   
  )
}