"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";

const messages = [
  { from: "user", text: "I need a website for my barbershop in Brooklyn" },
  { from: "ai", text: "Done. Your site is live \u2192 fadeandfortune.com" },
  { from: "user", text: "Can you add an online booking system?" },
  { from: "ai", text: "Done. Booking page added with calendar + reminders." },
];

const proofSites = [
  {
    name: "tokyoramen.com",
    prompt: "A Tokyo ramen shop with a moody editorial feel",
    gradient: "linear-gradient(135deg, #2d1810 0%, #8b4513 40%, #d4a574 100%)",
  },
  {
    name: "vargadefense.com",
    prompt: "A criminal defense law firm \u2014 dark, authoritative",
    gradient: "linear-gradient(135deg, #0a1628 0%, #1a2744 40%, #2a3f6b 100%)",
  },
  {
    name: "stillnessyoga.com",
    prompt: "A yoga studio \u2014 serene, minimal, light",
    gradient: "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 40%, #7da07d 100%)",
  },
  {
    name: "coderev.io",
    prompt: "A SaaS landing page for a code review tool",
    gradient: "linear-gradient(135deg, #1a1030 0%, #2d2060 40%, #6b4fa0 100%)",
  },
];

const steps = [
  {
    num: "01",
    title: "Text, call, or chat",
    desc: "Describe your website in plain English. No prompts. No jargon. Just talk.",
  },
  {
    num: "02",
    title: "Watch it build",
    desc: "16s creates your site in real time. Design, copy, interactions \u2014 all generated.",
  },
  {
    num: "03",
    title: "Go live",
    desc: "One click to deploy. Your site is live with a real URL in seconds.",
  },
];

const differentiators = [
  { label: "Output quality", desc: "Sites that look designed, not generated." },
  { label: "Conversation-first", desc: "Text it. Call it. Chat with it. Your choice." },
  { label: "Deploy instantly", desc: "Live URL in seconds, not hours." },
  { label: "No technical skills", desc: "Built for people who don\u2019t know what React is." },
];

export default function MarketingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [navVisible, setNavVisible] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setNavVisible(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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

  const scrollToCta = () => {
    ctaRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="relative min-h-screen bg-[#050505]"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {/* Film grain */}
      <div className="fixed inset-0 pointer-events-none z-50" style={{ opacity: 0.025 }}>
        <svg width="100%" height="100%">
          <filter id="grain-mkt">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-mkt)" />
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

      {/* Scroll nav */}
      <nav
        className={`fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-6 sm:px-10 border-b border-white/[0.04] bg-black/80 backdrop-blur-xl transition-all duration-500 ${
          navVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-full pointer-events-none"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0, 0, 0.2, 1)" }}
      >
        <Link href="/">
          <Image src="/logo.png" alt="16s" width={24} height={24} className="object-contain" />
        </Link>
        <button
          onClick={scrollToCta}
          className="text-[13px] text-green-400 hover:text-green-300 transition-colors"
        >
          Join waitlist &darr;
        </button>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-[380px] sm:max-w-[420px]">
          {/* Thread header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.06] mb-3">
              <span className="text-[13px] font-medium text-zinc-300">16</span>
            </div>
            <p className="text-[15px] text-zinc-300 font-medium">16s</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] text-zinc-500">Active</span>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"} msg-animate`}
                style={{ animationDelay: `${0.4 + i * 0.6}s` }}
              >
                {msg.from === "ai" && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center mr-2 mt-1">
                    <span className="text-[9px] font-medium text-zinc-400">16</span>
                  </div>
                )}
                <div
                  className={`max-w-[280px] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed ${
                    msg.from === "user"
                      ? "bg-white/[0.08] text-zinc-200"
                      : "bg-green-500/[0.12] text-zinc-100"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tagline */}
        <p
          className="mt-12 text-[15px] text-zinc-400 text-center msg-animate"
          style={{ animationDelay: "2.8s" }}
        >
          Your dream website is just a text away
        </p>

        {/* Inline scroll CTA */}
        <div className="mt-8 msg-animate" style={{ animationDelay: "3.2s" }}>
          <button
            onClick={scrollToCta}
            className="text-[13px] text-green-400 hover:text-green-300 transition-colors"
          >
            Join the waitlist &darr;
          </button>
        </div>
      </section>

      {/* ═══════════ PROOF ═══════════ */}
      <section className="relative z-10 py-32 sm:py-40 px-6">
        <p className="text-[13px] text-zinc-500 uppercase tracking-[0.2em] text-center mb-16 sm:mb-20 reveal">
          What 16s builds
        </p>

        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-8">
          {proofSites.map((site, i) => (
            <div
              key={site.name}
              className="reveal"
              style={{ transitionDelay: `${i * 0.15}s` }}
            >
              <div
                style={{
                  transform: `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)`,
                }}
              >
                {/* Browser chrome */}
                <div className="bg-white/[0.03] rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white/[0.06]" />
                      <span className="w-2 h-2 rounded-full bg-white/[0.06]" />
                      <span className="w-2 h-2 rounded-full bg-white/[0.06]" />
                    </div>
                    <div className="flex-1 text-center">
                      <span className="text-[11px] text-zinc-600">{site.name}</span>
                    </div>
                  </div>
                  <div
                    className="aspect-[16/10] relative overflow-hidden"
                    style={{ background: site.gradient }}
                  >
                    <div className="absolute inset-0 p-6 flex flex-col gap-3 opacity-30">
                      <div className="w-1/3 h-3 rounded-full bg-white/20" />
                      <div className="w-2/3 h-2 rounded-full bg-white/10 mt-4" />
                      <div className="w-1/2 h-2 rounded-full bg-white/10" />
                      <div className="flex gap-3 mt-auto">
                        <div className="w-1/3 h-16 rounded bg-white/10" />
                        <div className="w-1/3 h-16 rounded bg-white/10" />
                        <div className="w-1/3 h-16 rounded bg-white/10" />
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-zinc-600 italic mt-4 pl-1">
                  &ldquo;{site.prompt}&rdquo;
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="relative z-10 py-32 sm:py-40 px-6">
        <div className="max-w-5xl mx-auto pl-[8%] sm:pl-[30%]">
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[11px] top-[52px] bottom-[52px] w-px bg-white/[0.04]" />

            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`relative flex gap-6 sm:gap-8 ${i > 0 ? "mt-16 sm:mt-20" : ""} reveal`}
                style={{ transitionDelay: `${i * 0.2}s` }}
              >
                <span className="text-[48px] font-light text-green-500 leading-none select-none flex-shrink-0 w-[24px] text-center">
                  {step.num}
                </span>
                <div className="pt-3">
                  <p className="text-[16px] text-zinc-100 font-medium">{step.title}</p>
                  <p className="text-[14px] text-zinc-500 mt-2 leading-relaxed max-w-[320px]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DIFFERENTIATOR ═══════════ */}
      <section className="relative z-10 py-40 sm:py-52 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[20px] text-zinc-600 reveal">Other tools give you a text box.</p>
          <p
            className="text-[20px] text-zinc-100 mt-2 reveal"
            style={{ transitionDelay: "0.15s" }}
          >
            We give you a phone number.
          </p>
          <p
            className="text-[14px] text-zinc-500 mt-8 reveal"
            style={{ transitionDelay: "0.3s" }}
          >
            Voice-first AI that builds production websites from conversation.
          </p>
        </div>

        <div
          className="max-w-4xl mx-auto mt-24 sm:mt-32 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-0 reveal"
          style={{ transitionDelay: "0.4s" }}
        >
          {differentiators.map((item, i) => (
            <div
              key={item.label}
              className={`px-6 ${i > 0 ? "sm:border-l sm:border-white/[0.04]" : ""}`}
            >
              <p className="text-[13px] text-zinc-300 font-medium">{item.label}</p>
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ WAITLIST CTA ═══════════ */}
      <section ref={ctaRef} className="relative z-10 py-32 sm:py-40 px-6">
        <div className="max-w-md mx-auto text-center">
          <p className="text-[15px] text-zinc-400 mb-10 reveal">
            Claim your spot. We&apos;ll text you when it&apos;s your turn.
          </p>

          <div className="reveal" style={{ transitionDelay: "0.15s" }}>
            {status === "success" ? (
              <p className="text-[16px] text-zinc-500">you&apos;re on the list</p>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex items-center justify-center gap-6 sm:gap-8"
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
                  className="bg-transparent border-0 border-b border-white/10 text-[16px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/25 transition-colors pb-2 w-[220px] sm:w-[280px]"
                  style={{ fontFamily: "inherit", borderRadius: 0 }}
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="text-[15px] font-medium text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {status === "loading" ? "..." : "Join waitlist"}
                </button>
              </form>
            )}

            {status === "error" && errorMsg && (
              <p className="text-[12px] text-red-400/60 mt-3">{errorMsg}</p>
            )}
          </div>

          <p
            className="text-[12px] text-zinc-700 mt-8 reveal"
            style={{ transitionDelay: "0.3s" }}
          >
            2,000+ people ahead of you
          </p>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="relative z-10 py-20 px-6 text-center">
        <div className="flex items-center justify-center gap-3 text-[12px] text-zinc-700">
          <a
            href="mailto:main@try16s.com"
            className="hover:text-zinc-500 transition-colors"
          >
            main@try16s.com
          </a>
          <span>&middot;</span>
          <a
            href="https://www.linkedin.com/company/try16s"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-500 transition-colors"
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
