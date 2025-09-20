"use client";
import { useEffect, useRef, useState } from "react";

type EmailSignupProps = {
  className?: string;
};

export default function EmailSignup({ className = "" }: EmailSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const clearResetTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const runIfMounted = (fn: () => void) => {
    if (isMountedRef.current) {
      fn();
    }
  };

  const scheduleReset = () => {
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      runIfMounted(() => {
        setStatus("idle");
        setMessage("");
        resetTimerRef.current = null;
      });
    }, 5000);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearResetTimer();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearResetTimer();

    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your email address");
      scheduleReset();
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      scheduleReset();
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

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        // Ignore JSON parsing errors and fall back to generic message
      }

      if (!isMountedRef.current) {
        return;
      }

      if (response.ok) {
        runIfMounted(() => {
          setStatus("success");
          setMessage("🎉 Thanks for subscribing! Check your email for confirmation.");
          setEmail("");
        });
      } else {
        const errorMessage = typeof data === "object" && data !== null && "error" in data
          ? String((data as { error?: unknown }).error ?? "")
          : "";
        runIfMounted(() => {
          setStatus("error");
          setMessage(errorMessage || "Failed to subscribe. Please try again.");
        });
      }
    } catch (error) {
      runIfMounted(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
    }

    if (isMountedRef.current) {
      scheduleReset();
    }
  };

  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-lg p-6 ${className}`}>
      <div className="text-center mb-4">
        <h3 className="text-xl font-semibold mb-2">Stay Updated with $MemO Collective</h3>
        <p className="text-slate-400 text-sm">
          Get notified about badge achievements, DRIP drops, and community events
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        action="/api/email/subscribe"
        method="post"
        noValidate
      >
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={status === "loading"}
            required
            inputMode="email"
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
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

        <div
          className={`text-sm text-center ${
            status === "success"
              ? "text-green-400"
              : status === "error"
              ? "text-red-400"
              : "text-slate-400"
          }`}
          aria-live="polite"
        >
          {message}
        </div>

        <noscript>
          <p className="text-xs text-slate-400 text-center">
            JavaScript is disabled, but the form will still submit using your browser settings.
          </p>
        </noscript>
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
