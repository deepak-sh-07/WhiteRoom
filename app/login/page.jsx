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
  
  return(
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-6">
      
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
          </p>
        </div>
        
        {/* Forms */}
        {isLogin ? (
          <div className="space-y-5">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input 
                type="email" 
                placeholder="Enter your email" 
                onChange={(e)=>setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input 
                type="password" 
                placeholder="Enter your password" 
                onChange={(e)=>setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>
            
            <button 
              onClick={handlelogin}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition duration-200 mt-6"
            >
              Sign In
            </button>
            
            <div className="text-center mt-6">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <button 
                  onClick={()=>setIsLogin(false)}
                  className="text-indigo-600 font-semibold hover:text-indigo-700"
                >
                  Sign up
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                onChange={(e)=>setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input 
                type="email" 
                placeholder="Enter your email" 
                onChange={(e)=>setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input 
                type="password" 
                placeholder="Enter your password" 
                onChange={(e)=>setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>
            
            <button 
              onClick={handleregister}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition duration-200 mt-6"
            >
              Create Account
            </button>
            
            <div className="text-center mt-6">
              <p className="text-gray-600">
                Already have an account?{' '}
                <button 
                  onClick={()=>setIsLogin(true)}
                  className="text-indigo-600 font-semibold hover:text-indigo-700"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}