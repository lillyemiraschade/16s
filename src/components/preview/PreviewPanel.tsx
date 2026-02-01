"use client";

import { motion } from "framer-motion";
import { Monitor, Tablet, Smartphone, Loader2, RotateCcw } from "lucide-react";

type Viewport = "desktop" | "tablet" | "mobile";

interface PreviewPanelProps {
  html: string | null;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  isGenerating: boolean;
  canGoBack: boolean;
  onBack: () => void;
}

const viewportConfig = {
  desktop: { width: "100%", icon: Monitor, label: "Desktop" },
  tablet: { width: "768px", icon: Tablet, label: "Tablet" },
  mobile: { width: "375px", icon: Smartphone, label: "Mobile" },
};

export function PreviewPanel({
  html,
  viewport,
  onViewportChange,
  isGenerating,
  canGoBack,
  onBack,
}: PreviewPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#0c0c0d]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-[#0a0a0b]">
        {/* Undo / previous version */}
        <div className="w-28">
          {canGoBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg border border-zinc-800/80 transition-all duration-150"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
          )}
        </div>

        {/* Viewport toggles */}
        <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 border border-zinc-800/60">
          {(Object.keys(viewportConfig) as Viewport[]).map((vp) => {
            const Icon = viewportConfig[vp].icon;
            return (
              <button
                key={vp}
                onClick={() => onViewportChange(vp)}
                className={`p-2 rounded-md transition-all duration-150 ${
                  viewport === vp
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title={viewportConfig[vp].label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        <div className="w-28" />
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        {!html && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900/80 border border-zinc-800/60 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-zinc-500 text-[14px] font-medium">No preview yet</p>
              <p className="text-zinc-600 text-[13px] mt-1">Start a conversation to design your site</p>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <p className="text-zinc-500 text-[13px] font-medium">Designing your site...</p>
          </div>
        )}

        {html && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full flex flex-col items-center"
          >
            {/* Browser chrome */}
            <div
              className="bg-[#131315] border border-zinc-800/60 rounded-t-xl transition-all duration-300"
              style={{
                width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                maxWidth: "100%",
              }}
            >
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/40">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-zinc-900/80 rounded-md px-4 py-0.5 text-[11px] text-zinc-600 font-medium tracking-wide">
                    yoursite.com
                  </div>
                </div>
                <div className="w-[52px]" />
              </div>
            </div>

            {/* iframe */}
            <motion.div
              className="bg-white rounded-b-xl overflow-hidden border-x border-b border-zinc-800/60 shadow-2xl shadow-black/40 transition-all duration-300"
              style={{
                width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                maxWidth: "100%",
                height: "calc(100vh - 140px)",
              }}
              layout
            >
              <iframe
                srcDoc={html}
                sandbox="allow-scripts"
                className="w-full h-full border-0"
                title="Website Preview"
              />
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
