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
    <>
      <style jsx global>{`
        @keyframes waitlist-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="fixed inset-0 bg-[#050505] flex flex-col overflow-hidden">
        {/* Film grain */}
        <div className="fixed inset-0 pointer-events-none z-50" style={{ opacity: 0.025 }}>
          <svg width="100%" height="100%">
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
          </svg>
        </div>

        {/* Green glow */}
        <div
          className="fixed top-0 left-0 pointer-events-none z-0"
          style={{
            width: "80vw",
            height: "80vh",
            background: "radial-gradient(ellipse at 20% 20%, #0d3b1a 0%, transparent 70%)",
            opacity: 0.4,
          }}
        />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6 sm:py-8">
          <Link href="/">
            <Image src="/logo.png" alt="16s" width={32} height={32} className="object-contain" />
          </Link>
          <Link
            href="/app"
            className="text-[11px] text-zinc-800 hover:text-zinc-600 transition-colors"
          >
            Enter app &rarr;
          </Link>
        </header>

        {/* Main content */}
        <main
          className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-14"
          style={{ animation: "waitlist-fade-in 1s ease-out both" }}
        >
          {/* Headline */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-[24px] sm:text-[34px] md:text-[40px] font-normal text-zinc-400 tracking-[-0.02em] leading-[1.2]">
              Your dream website is just a
              <br />
              <span className="text-white">phone call away</span>
            </h1>
          </div>

          {/* Email form */}
          {status === "success" ? (
            <p className="text-[16px] sm:text-[18px] text-zinc-500">you&apos;re on the list</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-6 sm:gap-8">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder="enter your email"
                required
                className="bg-transparent border-0 border-b border-white/10 text-[16px] sm:text-[18px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/25 transition-colors pb-2 w-[240px] sm:w-[320px]"
                style={{ borderRadius: 0 }}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="text-[15px] sm:text-[17px] font-medium text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {status === "loading" ? "..." : "Join waitlist"}
              </button>
            </form>
          )}

          {/* Error */}
          {status === "error" && errorMsg && (
            <p className="text-[12px] text-red-400/60 mt-3 max-w-md text-center">{errorMsg}</p>
          )}

          {/* Contact */}
          <div className="mt-16 sm:mt-20 flex items-center gap-3 text-[15px] sm:text-[16px]">
            <a
              href="mailto:main@try16s.com"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Email
            </a>
            <span className="text-zinc-700">&middot;</span>
            <a
              href="https://www.linkedin.com/posts/16s-ai_introducing-16s-activity-7418057738812956672-U_Lw?utm_source=share&utm_medium=member_desktop&rcm=ACoAAFk5f_UBIStuepclAqr_IrMEVUJZXtHdiQ0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 pb-6 sm:pb-8 text-center">
          <p className="text-[11px] text-zinc-800">&copy; 2025 16s</p>
        </footer>
      </div>
    </>
  );
}
