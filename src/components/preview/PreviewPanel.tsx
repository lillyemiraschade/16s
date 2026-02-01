"use client";

import { motion } from "framer-motion";
import { Monitor, Tablet, Smartphone, Loader2, ChevronLeft } from "lucide-react";

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
  desktop: { width: "100%", icon: Monitor },
  tablet: { width: "768px", icon: Tablet },
  mobile: { width: "375px", icon: Smartphone },
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
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        {/* Back button */}
        <div className="w-24">
          {canGoBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>

        {/* Viewport toggles */}
        <div className="flex items-center gap-2">
          {(Object.keys(viewportConfig) as Viewport[]).map((vp) => {
            const Icon = viewportConfig[vp].icon;
            return (
              <button
                key={vp}
                onClick={() => onViewportChange(vp)}
                className={`p-2 rounded-lg transition-colors ${
                  viewport === vp
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
                title={vp.charAt(0).toUpperCase() + vp.slice(1)}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>

        <div className="w-24" />
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
        {!html && !isGenerating && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm">Your preview will appear here</p>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-zinc-400 text-sm animate-pulse">Designing...</p>
          </div>
        )}

        {html && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full flex flex-col items-center"
          >
            {/* Browser chrome */}
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-t-xl transition-all duration-300"
              style={{
                width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                maxWidth: "100%",
              }}
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-zinc-800 rounded-full px-4 py-1 text-xs text-zinc-500">
                    preview.16s.app
                  </div>
                </div>
              </div>
            </div>

            {/* iframe */}
            <motion.div
              className="bg-white rounded-b-xl overflow-hidden border-x border-b border-zinc-700 shadow-2xl transition-all duration-300"
              style={{
                width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                maxWidth: "100%",
                height: "calc(100vh - 180px)",
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
