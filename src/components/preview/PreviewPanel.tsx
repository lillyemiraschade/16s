"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  Tablet,
  Smartphone,
  ChevronLeft,
  RotateCcw,
  RotateCw,
  Download,
  Code,
  Copy,
  ExternalLink,
  ChevronDown,
  Clock,
  X,
} from "lucide-react";
import type { Viewport } from "@/lib/types";

interface PreviewPanelProps {
  html: string | null;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  isGenerating: boolean;
  canGoBack: boolean;
  canRedo: boolean;
  onBack: () => void;
  onRedo: () => void;
  onExport: () => void;
  onCopyToClipboard: () => void;
  onOpenInNewTab: () => void;
  onIframeLoad?: (iframe: HTMLIFrameElement) => void;
  previewHistory: string[];
  onRestoreVersion: (index: number) => void;
}

const viewportConfig = {
  desktop: { width: "100%", icon: Monitor, label: "Desktop" },
  tablet: { width: "768px", icon: Tablet, label: "Tablet" },
  mobile: { width: "375px", icon: Smartphone, label: "Mobile" },
} as const;

function highlightHtml(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(&lt;\/?)([\w-]+)/g, '<span class="hl-tag">$1$2</span>')
    .replace(/([\w-]+)(=)/g, '<span class="hl-attr">$1</span>$2')
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="hl-str">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span class="hl-str">$1</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>');
}

export function PreviewPanel({
  html,
  viewport,
  onViewportChange,
  isGenerating,
  canGoBack,
  canRedo,
  onBack,
  onRedo,
  onExport,
  onCopyToClipboard,
  onOpenInNewTab,
  onIframeLoad,
  previewHistory,
  onRestoreVersion,
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Listen for keyboard shortcut toggle
  useEffect(() => {
    const handler = () => setShowCode((v) => !v);
    window.addEventListener("toggle-code-view", handler);
    return () => window.removeEventListener("toggle-code-view", handler);
  }, []);

  // Close export dropdown on outside click or Escape
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowExportMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showExportMenu]);

  const handleExportAction = useCallback(
    (action: () => void) => {
      action();
      setShowExportMenu(false);
    },
    []
  );

  const totalVersions = previewHistory.length + (html ? 1 : 0);

  return (
    <div className="flex flex-col h-full bg-[#0c0c0d] dot-grid">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
        {/* Browser nav buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-200"
            title="Undo (Cmd+Z)"
            aria-label="Go back to previous version"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-200"
            title="Redo (Cmd+Shift+Z)"
            aria-label="Redo"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={!html}
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-200"
            title="Reload"
            aria-label="Reload preview"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {totalVersions > 1 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`p-1.5 rounded-full transition-all duration-200 ${
                showHistory
                  ? "text-green-400 bg-green-500/10"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title="Version history"
              aria-label="Toggle version history"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Viewport toggles + code toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 glass rounded-full p-0.5">
            {(Object.keys(viewportConfig) as Viewport[]).map((vp) => {
              const Icon = viewportConfig[vp].icon;
              return (
                <button
                  key={vp}
                  onClick={() => onViewportChange(vp)}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    viewport === vp
                      ? "bg-white/[0.08] text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={viewportConfig[vp].label}
                  aria-label={`${viewportConfig[vp].label} viewport`}
                  aria-pressed={viewport === vp}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          {html && !isGenerating && (
            <button
              onClick={() => setShowCode((v) => !v)}
              className={`p-2 rounded-full transition-all duration-200 ${
                showCode
                  ? "text-green-400 bg-green-500/10"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title="Toggle code view (Cmd+/)"
              aria-label="Toggle code view"
              aria-pressed={showCode}
            >
              <Code className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Export dropdown */}
        <div className="w-[88px] flex justify-end relative" ref={exportRef}>
          {html && !isGenerating && (
            <>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-zinc-400 hover:text-zinc-200 glass glass-hover rounded-full transition-all duration-200"
                title="Export options"
              >
                <Download className="w-3.5 h-3.5" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full right-0 mt-1 z-20 glass rounded-xl overflow-hidden min-w-[180px] py-1 shadow-xl shadow-black/40"
                  >
                    <button
                      onClick={() => handleExportAction(onExport)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download HTML
                    </button>
                    <button
                      onClick={() => handleExportAction(onCopyToClipboard)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => handleExportAction(onOpenInNewTab)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in New Tab
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Preview / Code area */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
          {!html && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center">
                <img src="/logo.png" alt="" className="w-6 h-6 object-contain opacity-40" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="text-zinc-500 text-[14px] font-medium">No preview yet</p>
                <p className="text-zinc-600 text-[13px] mt-1">Start a conversation to design your site</p>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute w-24 h-24 rounded-full bg-green-500/10"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute w-16 h-16 rounded-full bg-green-500/20"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />
                <motion.img
                  src="/logo.png"
                  alt="Loading"
                  className="w-12 h-12 object-contain relative z-10"
                  animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <p className="text-zinc-500 text-[13px] font-medium">Designing your site...</p>
            </div>
          )}

          {html && !isGenerating && !showCode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full flex flex-col items-center"
            >
              {/* Browser chrome */}
              <div
                className="glass rounded-t-xl transition-all duration-300"
                style={{
                  width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                  maxWidth: "100%",
                }}
              >
                <div className="flex items-center px-4 py-2 border-b border-white/[0.04]">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="bg-white/[0.03] rounded-md px-4 py-0.5 text-[11px] text-zinc-600 font-medium tracking-wide">
                      yoursite.com
                    </div>
                  </div>
                </div>
              </div>

              {/* iframe */}
              <motion.div
                className="bg-white rounded-b-xl overflow-hidden border-x border-b border-white/[0.06] shadow-2xl shadow-black/40 transition-all duration-300"
                style={{
                  width: viewport === "desktop" ? "100%" : viewportConfig[viewport].width,
                  maxWidth: "100%",
                  height: "calc(100vh - 140px)",
                }}
                layout
              >
                <iframe
                  key={reloadKey}
                  ref={iframeRef}
                  srcDoc={html}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-0"
                  title="Website Preview"
                  aria-label="Generated website preview"
                  onLoad={() => {
                    if (iframeRef.current && onIframeLoad) {
                      onIframeLoad(iframeRef.current);
                    }
                  }}
                />
              </motion.div>
            </motion.div>
          )}

          {html && !isGenerating && showCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full"
            >
              <pre className="code-preview w-full h-full overflow-auto rounded-xl glass p-6 text-[13px] leading-relaxed">
                <code dangerouslySetInnerHTML={{ __html: highlightHtml(html) }} />
              </pre>
            </motion.div>
          )}
        </div>

        {/* Version history slide-out */}
        <AnimatePresence>
          {showHistory && html && !isGenerating && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="border-l border-white/[0.04] overflow-hidden flex-shrink-0"
            >
              <div className="w-[240px] h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                  <span className="text-[13px] font-medium text-zinc-300">History</span>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                  {/* Current version */}
                  <div className="px-3 py-2 mx-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="text-[13px] font-medium text-green-400">
                      Version {totalVersions}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Current</div>
                  </div>
                  {/* Previous versions */}
                  {[...previewHistory].reverse().map((_, reverseIdx) => {
                    const actualIdx = previewHistory.length - 1 - reverseIdx;
                    return (
                      <button
                        key={actualIdx}
                        onClick={() => onRestoreVersion(actualIdx)}
                        className="w-full text-left px-3 py-2 mx-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                        style={{ width: "calc(100% - 16px)" }}
                      >
                        <div className="text-[13px] text-zinc-400">
                          Version {actualIdx + 1}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
