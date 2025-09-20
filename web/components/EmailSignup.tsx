"use client";
import { useEffect, useRef, useState } from "react";

type EmailSignupProps = {
  className?: string;
};

export default function EmailSignup({ className = "" }: EmailSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }

 codex/suggest-improvements-for-web-portion-5xum2w
  const isMountedRef = useRef(true);
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

 codex/suggest-improvements-for-web-portion-5xum2w
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

  const scheduleReset = () => {
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      setStatus("idle");
      setMessage("");
      resetTimerRef.current = null;
main
    }, 5000);
  };

  useEffect(() => {
 codex/suggest-improvements-for-web-portion-5xum2w
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearResetTimer();
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
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
 codex/suggest-improvements-for-web-portion-5xum2w
    clearResetTimer();


 codex/suggest-improvements-for-web-portion-hqrpi8
    clearResetTimer();

codex/suggest-improvements-for-web-portion
    clearResetTimer();

    clearStatusTimeout();
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

codex/suggest-improvements-for-web-portion-5xum2w
    if (isMountedRef.current) {
      scheduleReset();
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
  };

  useEffect(() => {
    if (status === "success" || status === "error") {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }

      resetTimer.current = setTimeout(() => {
        setStatus("idle");
        setMessage("");
        resetTimer.current = null;
      }, 5000);
    } else if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }

    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, [status]);

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
