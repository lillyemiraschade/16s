"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "something went wrong");
        setStatus("error");
      }
    } catch {
      setErrorMsg("something went wrong");
      setStatus("error");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#050505] flex flex-col overflow-hidden"
    >
      {/* Film grain */}
      <div className="fixed inset-0 pointer-events-none z-50" style={{ opacity: 0.025 }}>
        <svg width="100%" height="100%">
          <filter id="grain-wl">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-wl)" />
        </svg>
      </div>

      {/* Green glow — primary, top-left */}
      <div
        className="fixed top-0 left-0 pointer-events-none z-0"
        style={{
          width: "80vw",
          height: "80vh",
          background: "radial-gradient(ellipse at 20% 20%, #0d3b1a 0%, transparent 70%)",
          opacity: 0.4,
        }}
      />

      {/* Green glow — secondary, bottom-right */}
      <div
        className="fixed bottom-0 right-0 pointer-events-none z-0"
        style={{
          width: "60vw",
          height: "60vh",
          background: "radial-gradient(ellipse at 80% 80%, #0d3b1a 0%, transparent 70%)",
          opacity: 0.12,
        }}
      />

      {/* Dot grid texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6 sm:py-8 wl-stagger-4">
        <Link href="/">
          <Image src="/logo.png" alt="16s" width={28} height={28} className="object-contain" />
        </Link>
        <Link
          href="/app"
          className="text-[11px] text-zinc-800 hover:text-zinc-500 transition-colors"
        >
          Enter app &rarr;
        </Link>
      </header>

      {/* Main — centered content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-8">
        {/* Logomark */}
        <div className="relative wl-stagger-1">
          {/* Glow behind logomark */}
          <div
            className="absolute inset-0 -inset-x-16 -inset-y-8 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 50% 50%, rgba(34,197,94,0.05) 0%, transparent 70%)",
            }}
          />
          <h1 className="relative text-[80px] sm:text-[96px] font-semibold tracking-tight leading-none select-none">
            <span className="text-zinc-100">16</span>
            <span className="text-green-500">s</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="mt-6 text-[16px] text-zinc-500 font-normal tracking-tight wl-stagger-2"
          style={{ letterSpacing: "-0.01em" }}
        >
          your dream website is just a text away
        </p>

        {/* Waitlist form */}
        <div className="mt-10 w-full max-w-[420px] wl-stagger-3">
          {status === "success" ? (
            <div className="text-center wl-fade-in">
              <p className="text-[16px] text-zinc-300">you&apos;re in line</p>
              <p className="text-[13px] text-zinc-600 mt-2">we&apos;ll reach out when it&apos;s your turn</p>
            </div>
          ) : (
            <>
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3 sm:gap-2"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  placeholder="enter your email"
                  required
                  className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.12] transition-colors"
                  style={{ fontFamily: "inherit" }}
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="bg-green-500 text-black rounded-xl px-5 py-3 text-[13px] font-semibold hover:bg-green-400 active:scale-[0.97] transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {status === "loading" ? (
                    <svg className="animate-spin mx-auto h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    "Join waitlist"
                  )}
                </button>
              </form>

              {status === "error" && errorMsg && (
                <p className="text-[11px] text-red-400/60 mt-2 text-center sm:text-left">{errorMsg}</p>
              )}
            </>
          )}

          {status !== "success" && (
            <p className="text-[12px] text-zinc-700 mt-4 text-center">
              join the line &mdash; we&apos;ll let you know when it&apos;s your turn
            </p>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 pb-6 sm:pb-8 text-center wl-stagger-4">
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-800">
          <a
            href="mailto:main@try16s.com"
            className="hover:text-zinc-600 transition-colors"
          >
            main@try16s.com
          </a>
          <span>&middot;</span>
          <a
            href="https://www.linkedin.com/company/try16s"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-600 transition-colors"
          >
            LinkedIn
          </a>
          <span>&middot;</span>
          <span>&copy; 2025 16s</span>
        </div>
      </footer>
    </div>
  );
}
