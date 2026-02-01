"use client";

import { motion } from "framer-motion";
import { Monitor, Tablet, Smartphone, Loader2 } from "lucide-react";

type Viewport = "desktop" | "tablet" | "mobile";

interface PreviewPanelProps {
  html: string | null;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  isGenerating: boolean;
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
}: PreviewPanelProps) {
  const ViewportIcon = viewportConfig[viewport].icon;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Top bar with viewport toggles */}
      <div className="flex items-center justify-center gap-2 p-4 border-b border-zinc-800">
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

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full flex flex-col items-center"
          >
            {/* Browser chrome */}
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-t-lg transition-all duration-300"
              style={{
                width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                maxWidth: "100%",
              }}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                {/* Traffic lights */}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-zinc-600"></div>
                  <div className="w-3 h-3 rounded-full bg-zinc-600"></div>
                  <div className="w-3 h-3 rounded-full bg-zinc-600"></div>
                </div>

                {/* URL bar */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-zinc-800 rounded-full px-4 py-1.5 text-xs text-zinc-500 max-w-xs">
                    preview.16s.app
                  </div>
                </div>
              </div>
            </div>

            {/* iframe */}
            <motion.div
              className="bg-white rounded-b-lg overflow-hidden border-x border-b border-zinc-700 shadow-2xl transition-all duration-300"
              style={{
                width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                maxWidth: "100%",
                height: "calc(100vh - 200px)",
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
