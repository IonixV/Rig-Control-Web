import React, { useState, useEffect, useRef } from "react";
import { LogIn } from "lucide-react";
import { cn } from "../utils";

interface Props {
  onLogin: (callsign: string, password: string) => void;
  loginError: string;
  retryAfter: number;
}

export default function LoginScreen({ onLogin, loginError, retryAfter }: Props) {
  const [callsign, setCallsign] = useState("");
  const [password, setPassword] = useState("");
  const [locked, setLocked] = useState(false);
  const callsignRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    callsignRef.current?.focus();
  }, []);

  useEffect(() => {
    if (retryAfter <= 0) { setLocked(false); return; }
    setLocked(true);
    const timer = setTimeout(() => setLocked(false), retryAfter);
    return () => clearTimeout(timer);
  }, [retryAfter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || !callsign.trim() || !password) return;
    onLogin(callsign.trim(), password);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/rcw-logo.svg" className="w-8 h-8" alt="" />
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic text-white">
            RigControl Web
          </h1>
        </div>

        {/* Card */}
        <div className="bg-[#111] border border-[#2a2b2e] rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#8e9299]">
              Sign In
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8e9299]">
                Callsign
              </label>
              <input
                ref={callsignRef}
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                autoComplete="username"
                spellCheck={false}
                className="w-full bg-[#0a0a0a] border border-[#2a2b2e] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-600 transition-colors placeholder-[#444]"
                placeholder="W1ABC"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8e9299]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-[#0a0a0a] border border-[#2a2b2e] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-600 transition-colors"
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400 font-mono">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={locked || !callsign.trim() || !password}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold uppercase text-sm tracking-wider transition-all",
                locked || !callsign.trim() || !password
                  ? "bg-[#1a1b1e] text-[#444] border border-[#2a2b2e] cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500"
              )}
            >
              <LogIn size={15} />
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
