"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "16s-onboarded";

interface Step {
  target: string; // CSS selector for the target element
  text: string;
  position: "top" | "bottom";
}

const STEPS: Step[] = [
  { target: "#welcome-input", text: "Describe any website and I'll build it in seconds", position: "top" },
  { target: "[data-onboarding='pills']", text: "Or pick an idea to start with", position: "top" },
];

export function OnboardingTooltip() {
  const [step, setStep] = useState(-1); // -1 = not started
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { return; }
    // Delay to let the page render
    const timer = setTimeout(() => setStep(0), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    const target = document.querySelector(STEPS[step].target);
    if (!target) { setPos(null); return; }
    const rect = target.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.left + rect.width / 2, width: rect.width });
  }, [step]);

  const handleNext = () => {
    if (step >= STEPS.length - 1) {
      setStep(-1);
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    } else {
      setStep(step + 1);
    }
  };

  const handleDismiss = () => {
    setStep(-1);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  const current = step >= 0 && step < STEPS.length ? STEPS[step] : null;

  return (
    <AnimatePresence>
      {current && pos && (
        <motion.div
          key={step}
          initial={{ opacity: 0, y: current.position === "top" ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: current.position === "top" ? 8 : -8 }}
          transition={{ duration: 0.2 }}
          className="fixed z-50 pointer-events-auto"
          style={{
            top: current.position === "top" ? pos.top - 12 : pos.top + 60,
            left: Math.max(16, Math.min(pos.left, window.innerWidth - 200)),
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 shadow-xl shadow-black/40 max-w-[280px]">
            <p className="text-[13px] text-zinc-200 leading-relaxed mb-2">{current.text}</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">{step + 1}/{STEPS.length}</span>
              <div className="flex gap-2">
                {step < STEPS.length - 1 && (
                  <button
                    onClick={handleDismiss}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="text-[11px] font-medium text-green-400 hover:text-green-300 transition-colors"
                >
                  {step >= STEPS.length - 1 ? "Got it" : "Next"}
                </button>
              </div>
            </div>
          </div>
          {/* Arrow pointing down */}
          <div
            className="w-2.5 h-2.5 bg-zinc-800 border-r border-b border-white/10 rotate-45 mx-auto -mt-1.5"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
