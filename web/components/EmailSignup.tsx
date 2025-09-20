"use client";
import { useEffect, useRef, useState } from "react";

type EmailSignupProps = {
  className?: string;
};

export default function EmailSignup({ className = "" }: EmailSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
 codex/suggest-improvements-for-web-portion-hqrpi8
 codex/suggest-improvements-for-web-portion
 main
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const scheduleReset = () => {
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      setStatus("idle");
      setMessage("");
      resetTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    return () => {
      clearResetTimer();
 codex/suggest-improvements-for-web-portion-hqrpi8
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatusTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearStatusTimeout();
 main
 main
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
 codex/suggest-improvements-for-web-portion-hqrpi8
    clearResetTimer();

codex/suggest-improvements-for-web-portion
    clearResetTimer();

    clearStatusTimeout();
 main

 main
    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage("🎉 Thanks for subscribing! Check your email for confirmation.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to subscribe. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }

 codex/suggest-improvements-for-web-portion-hqrpi8
    scheduleReset();

 codex/suggest-improvements-for-web-portion
    scheduleReset();
    // Clear status after 5 seconds
    timeoutRef.current = setTimeout(() => {
      setStatus("idle");
      setMessage("");
      timeoutRef.current = null;
    }, 5000);
 main
main
  };

  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-lg p-6 ${className}`}>
      <div className="text-center mb-4">
        <h3 className="text-xl font-semibold mb-2">Stay Updated with $MemO Collective</h3>
        <p className="text-slate-400 text-sm">
          Get notified about badge achievements, DRIP drops, and community events
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={status === "loading"}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {status === "loading" ? "Subscribing..." : "Subscribe for Updates"}
        </button>

        {message && (
          <div className={`text-sm text-center ${
            status === "success" ? "text-green-400" : 
            status === "error" ? "text-red-400" : 
            "text-slate-400"
          }`}>
            {message}
          </div>
        )}
      </form>

      <div className="mt-4 text-xs text-slate-500 text-center">
        <p>
          We respect your privacy. No spam, unsubscribe anytime.
          <br />
          Also available via Discord: <code>/email set</code>
        </p>
      </div>
    </div>
  );
}
