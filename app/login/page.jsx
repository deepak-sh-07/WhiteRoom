"use client"
import React from 'react'
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Login(){
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  
  const handlelogin = async()=>{
    const res = await fetch('http://localhost:3000/api/login',{
        method:'POST',
        headers: {
          "Content-Type": "application/json",
        },
        credentials:"include",
        body: JSON.stringify({ email, password }),
    })
    const data = await res.json();
    if (res.status === 200) {
      console.log("Login sucessfully ")
      console.log(data.accessToken);
      router.push("/");
    }
  }
  
  const handleregister = async()=>{
    const res = await fetch('http://localhost:3000/api/register',{
      method:'POST',
      headers:{
        "Content-Type" : "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json();
    console.log(data.message);
  }
  
 return (
  <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 px-4">
    
    {/* Glass Card */}
    <div className="relative w-full max-w-md rounded-3xl bg-white/90 backdrop-blur-xl shadow-2xl p-8">

      {/* Glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-pink-400/30 rounded-full blur-3xl" />

      {/* Header */}
      <div className="relative text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">
          {isLogin ? "Welcome Back 👋" : "Create Account 🚀"}
        </h1>
        <p className="text-gray-600 mt-2">
          {isLogin
            ? "Login to continue to your dashboard"
            : "Join us and start your journey"}
        </p>
      </div>

      {/* Form */}
      <div className="relative space-y-5">
        {!isLogin && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
          />
        </div>

        <button
          onClick={isLogin ? handlelogin : handleregister}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 font-semibold text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] active:scale-[0.98] transition"
        >
          {isLogin ? "Sign In" : "Create Account"}
        </button>

        {/* Toggle */}
        <p className="text-center text-sm text-gray-600 mt-6">
          {isLogin ? "Don’t have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-semibold text-indigo-600 hover:text-indigo-700 transition"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  </div>
);

}