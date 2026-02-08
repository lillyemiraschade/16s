"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "16s_tour_complete";

interface TourStep {
  selector: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const STEPS: TourStep[] = [
  {
    selector: 'main[aria-label="Preview"]',
    title: "Live Preview",
    description: "Your live preview updates instantly as you describe changes.",
    position: "left",
  },
  {
    selector: "#chat-input",
    title: "Chat Input",
    description: "Type what you want to build or change. Be specific \u2014 colors, layout, content.",
    position: "top",
  },
  {
    selector: '[data-tour="image-upload"]',
    title: "Image Upload",
    description: "Upload screenshots to clone designs, or content images to embed in your site.",
    position: "top",
  },
  {
    selector: 'button[aria-label="Undo"]',
    title: "Undo & Redo",
    description: "Step back through versions anytime.",
    position: "bottom",
  },
  {
    selector: '[data-tour="deploy"]',
    title: "Deploy",
    description: "Publish your site live with one click.",
    position: "bottom",
  },
  {
    selector: '[data-tour="export"]',
    title: "Export",
    description: "Download your code or push to GitHub.",
    position: "bottom",
  },
];

interface OnboardingTourProps {
  active: boolean;
}

export function OnboardingTour({ active }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; arrowDir: string } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check if tour is already complete
  useEffect(() => {
    if (!active) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    // Delay slightly so elements are rendered
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [active]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }, []);

  // Position the tooltip relative to the target element
  const updatePosition = useCallback(() => {
    if (!visible) return;
    const currentStep = STEPS[step];
    if (!currentStep) return;

    const target = document.querySelector(currentStep.selector);
    if (!target) {
      // Skip steps whose targets aren't rendered yet (e.g. deploy before first deploy)
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        dismiss();
      }
      return;
    }

    const rect = target.getBoundingClientRect();
    const tooltipW = 260;
    const tooltipH = tooltipRef.current?.offsetHeight || 140;
    const gap = 12;

    let top = 0;
    let left = 0;
    let arrowDir = "top"; // arrow points up = tooltip is below

    switch (currentStep.position) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        arrowDir = "top";
        break;
      case "top":
        top = rect.top - tooltipH - gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        arrowDir = "bottom";
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.left - tooltipW - gap;
        arrowDir = "right";
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.right + gap;
        arrowDir = "left";
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));

    setCoords({ top, left, arrowDir });
  }, [visible, step, dismiss]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [updatePosition]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  if (!visible || !coords) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20"
        onClick={dismiss}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[61] w-[260px] bg-zinc-800 border border-white/[0.08] rounded-xl shadow-2xl p-4"
        style={{ top: coords.top, left: coords.left }}
      >
        {/* Arrow */}
        <div
          className="absolute w-2.5 h-2.5 bg-zinc-800 border border-white/[0.08] rotate-45"
          style={{
            ...(coords.arrowDir === "top" && { top: -5, left: "50%", marginLeft: -5, borderBottom: "none", borderRight: "none" }),
            ...(coords.arrowDir === "bottom" && { bottom: -5, left: "50%", marginLeft: -5, borderTop: "none", borderLeft: "none" }),
            ...(coords.arrowDir === "left" && { left: -5, top: "50%", marginTop: -5, borderTop: "none", borderRight: "none" }),
            ...(coords.arrowDir === "right" && { right: -5, top: "50%", marginTop: -5, borderBottom: "none", borderLeft: "none" }),
          }}
        />

        <p className="text-[13px] font-medium text-zinc-100 mb-1">{currentStep.title}</p>
        <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">{currentStep.description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-zinc-500 text-[11px] underline hover:text-zinc-300 transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-600">{step + 1}/{STEPS.length}</span>
            <button
              onClick={handleNext}
              className="bg-green-500 text-black rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-green-400 transition-colors"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
