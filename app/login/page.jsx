"use client"
import React, { useState } from 'react'
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName]               = useState("");
  const [isLogin, setIsLogin]         = useState(true);
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError]             = useState("");

  const handleLogin = async () => {
    setError("");
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.status === 200) {
      sessionStorage.setItem("userName", data.name ?? email.split("@")[0]);
      router.push("/");
    } else {
      setError(data.message ?? "Login failed");
    }
  };

  const handleRegister = async () => {
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (res.status === 201 || res.status === 200) {
      setIsLogin(true);
      setError("");
    } else {
      setError(data.message ?? "Registration failed");
    }
  };

  const PasswordInput = ({ value, onChange, placeholder, show, onToggle }) => (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
        style={{ paddingRight: "44px" }}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: "#9ca3af",
          display: "flex", alignItems: "center", padding: "2px",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "#6366f1"}
        onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}
      >
        {show
          ? <EyeOff style={{ width: "18px", height: "18px" }} />
          : <Eye    style={{ width: "18px", height: "18px" }} />}
      </button>
    </div>
  );

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
            {isLogin ? "Login to continue to your dashboard" : "Join us and start your journey"}
          </p>
        </div>

        {/* Form */}
        <div className="relative space-y-5">

          {/* Name — register only */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 outline-none transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              show={showPassword}
              onToggle={() => setShowPassword(v => !v)}
            />
          </div>

          {/* Confirm Password — register only */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Re-enter Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(v => !v)}
              />
              {/* Password match indicator */}
              {confirmPassword.length > 0 && (
                <p style={{
                  fontSize: "12px", marginTop: "6px", fontWeight: "600",
                  color: password === confirmPassword ? "#10b981" : "#ef4444",
                }}>
                  {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords don't match"}
                </p>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)",
              fontSize: "13px", color: "#ef4444", fontWeight: "500",
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={isLogin ? handleLogin : handleRegister}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 font-semibold text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] active:scale-[0.98] transition"
          >
            {isLogin ? "Sign In" : "Create Account"}
          </button>

          {/* Toggle */}
          <p className="text-center text-sm text-gray-600 mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); setConfirmPassword(""); }}
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
/*
  This file defines a React component for a login and registration page. It uses state to manage form inputs, error messages, and whether the user is in login or registration mode. The component includes functions to handle login and registration by making API calls to the backend. It also features a password input with a toggle to show/hide the password, and displays error messages when login or registration fails. The UI is styled with Tailwind CSS classes for a modern look.
*/