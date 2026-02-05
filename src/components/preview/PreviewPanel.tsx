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
  MousePointer2,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Rocket,
  Loader2,
  CheckCircle,
  FileCode,
} from "lucide-react";
import type { Viewport, SelectedElement, VersionBookmark, CodeMode } from "@/lib/types";
import Image from "next/image";
import { CodeEditor } from "./CodeEditor";
import { isReactCode, createReactPreviewHtml } from "@/lib/react-preview";

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
  selectMode: boolean;
  onSelectModeChange: (enabled: boolean) => void;
  selectedElement: SelectedElement | null;
  onElementSelect: (element: SelectedElement | null) => void;
  bookmarks: VersionBookmark[];
  onAddBookmark: (name: string) => void;
  onRemoveBookmark: (id: string) => void;
  onRestoreBookmark: (bookmark: VersionBookmark) => void;
  // Deployment
  onDeploy?: () => void;
  isDeploying?: boolean;
  lastDeployUrl?: string | null;
  // Code editing
  onCodeChange?: (code: string) => void;
  // Code mode
  codeMode?: CodeMode;
  onCodeModeChange?: (mode: CodeMode) => void;
}

const viewportConfig = {
  desktop: { width: "100%", icon: Monitor, label: "Desktop" },
  tablet: { width: "768px", icon: Tablet, label: "Tablet" },
  mobile: { width: "375px", icon: Smartphone, label: "Mobile" },
} as const;

// Tips and fun messages for the loading state
const TIPS = [
  "Drop inspiration images for pixel-perfect cloning",
  "Try the voice call feature - it's like having a designer on speed dial",
  "You can select any element and ask to change it",
  "Use bookmarks to save versions you love",
  "Export to HTML or deploy directly to the web",
  "Ask for specific vibes: 'make it feel like Apple'",
  "Upload your logo and it'll be placed automatically",
  "Say 'make it more minimal' or 'add more personality'",
  "You can edit the code directly with Cmd+/",
  "Try 'hop on a call' for a 2-minute design session",
];

const REVISION_MESSAGES = [
  "One sec, redecorating...",
  "Hold tight, moving some pixels around",
  "Brewing up something fresh",
  "Almost there, just adding some magic",
  "Working on it, no peeking!",
  "The pixels are doing their thing",
  "Making it even better...",
  "Give me a moment to work my magic",
  "Tweaking things behind the scenes",
  "Just a sec, perfectionism takes time",
];

function GeneratingState({ isRevision }: { isRevision: boolean }) {
  const [tipIndex, setTipIndex] = useState(0);
  const [revisionMessage] = useState(() =>
    REVISION_MESSAGES[Math.floor(Math.random() * REVISION_MESSAGES.length)]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src="/logo.png"
          alt="Loading"
          className="w-12 h-12 object-contain relative z-10"
          animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="text-center max-w-md px-4">
        <p className="text-zinc-300 text-[15px] font-medium mb-4">
          {isRevision ? revisionMessage : "Preview will be available soon"}
        </p>

        {/* Rotating tips */}
        <div className="h-10 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-zinc-500 text-[13px] absolute inset-x-0 leading-relaxed"
            >
              {TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Script to inject into iframe for element selection
const SELECT_MODE_SCRIPT = `
<script>
(function() {
  let hoveredEl = null;
  let selectedEl = null;
  const overlay = document.createElement('div');
  overlay.id = '16s-select-overlay';
  overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #22c55e;background:rgba(34,197,94,0.1);z-index:999999;transition:all 0.1s ease;display:none;';
  document.body.appendChild(overlay);

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    let path = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      path += '.' + el.className.trim().split(/\\s+/).join('.');
    }
    return path;
  }

  function updateOverlay(el) {
    if (!el) { overlay.style.display = 'none'; return; }
    const rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  document.addEventListener('mousemove', function(e) {
    if (!window.__selectMode) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== overlay && el !== document.body && el !== document.documentElement) {
      hoveredEl = el;
      updateOverlay(el);
    }
  });

  document.addEventListener('click', function(e) {
    if (!window.__selectMode) return;
    e.preventDefault();
    e.stopPropagation();
    if (hoveredEl && hoveredEl !== overlay) {
      selectedEl = hoveredEl;
      const styles = window.getComputedStyle(selectedEl);
      const data = {
        tagName: selectedEl.tagName.toLowerCase(),
        id: selectedEl.id || undefined,
        className: selectedEl.className || undefined,
        textContent: selectedEl.textContent?.slice(0, 100) || undefined,
        computedStyles: {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          padding: styles.padding,
          margin: styles.margin,
          borderRadius: styles.borderRadius,
        },
        path: getSelector(selectedEl),
      };
      window.parent.postMessage({ type: '16s-element-selected', element: data }, '*');
    }
  }, true);

  window.__selectMode = false;
  window.addEventListener('message', function(e) {
    if (e.data?.type === '16s-set-select-mode') {
      window.__selectMode = e.data.enabled;
      if (!e.data.enabled) {
        overlay.style.display = 'none';
        hoveredEl = null;
      }
    }
  });
})();
</script>`;

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
  selectMode,
  onSelectModeChange,
  selectedElement,
  onElementSelect,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  onRestoreBookmark,
  onDeploy,
  isDeploying,
  lastDeployUrl,
  onCodeChange,
  codeMode = "html",
  onCodeModeChange,
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [bookmarkName, setBookmarkName] = useState("");
  const [copyToast, setCopyToast] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleCopyWithFeedback = useCallback(() => {
    onCopyToClipboard();
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  }, [onCopyToClipboard]);

  // Listen for element selection messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === '16s-element-selected') {
        onElementSelect(e.data.element);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementSelect]);

  // Notify iframe when select mode changes
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: '16s-set-select-mode', enabled: selectMode }, '*');
    }
  }, [selectMode]);

  // Detect if content is React code and prepare preview HTML
  const isReact = html && codeMode === "react";
  const previewHtml = html
    ? isReact
      ? createReactPreviewHtml(html)
      : html.replace('</body>', `${SELECT_MODE_SCRIPT}</body>`)
    : null;

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
      <div className="h-[52px] flex items-center justify-between px-4 border-b border-white/[0.04]">
        {/* Left: Nav buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-150"
            title="Undo (Cmd+Z)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-150"
            title="Redo (Cmd+Shift+Z)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={!html}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-150"
            title="Reload"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-white/[0.06] mx-1" />
          <button
            onClick={() => totalVersions > 1 && setShowHistory((v) => !v)}
            disabled={totalVersions <= 1}
            className={`p-2 rounded-lg transition-all duration-150 ${
              showHistory ? "text-green-400 bg-green-500/10" :
              totalVersions > 1 ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]" :
              "text-zinc-700 cursor-not-allowed"
            }`}
            title={totalVersions > 1 ? "Version history" : "Version history (make changes to build history)"}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          {html && !isGenerating && (
            <button
              onClick={() => { onSelectModeChange(!selectMode); if (selectMode) onElementSelect(null); }}
              className={`p-2 rounded-lg transition-all duration-150 ${
                selectMode ? "text-green-400 bg-green-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title="Select element"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
            </button>
          )}
          {html && !isGenerating && (
            <button
              onClick={() => setShowBookmarkInput(true)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-150"
              title="Bookmark"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Center: Viewport + Code toggles */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5">
            {(Object.keys(viewportConfig) as Viewport[]).map((vp) => {
              const Icon = viewportConfig[vp].icon;
              return (
                <button
                  key={vp}
                  onClick={() => onViewportChange(vp)}
                  className={`p-1.5 rounded-md transition-all duration-150 ${
                    viewport === vp ? "bg-white/[0.08] text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={viewportConfig[vp].label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          <div className="w-px h-4 bg-white/[0.06] mx-1" />
          {html && !isGenerating && (
            <button
              onClick={() => setShowCode((v) => !v)}
              className={`p-1.5 rounded-lg transition-all duration-150 ${
                showCode ? "text-green-400 bg-green-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title="Code view (Cmd+/)"
            >
              <Code className="w-4 h-4" />
            </button>
          )}
          {onCodeModeChange && (
            <button
              onClick={() => onCodeModeChange(codeMode === "html" ? "react" : "html")}
              className={`p-1.5 rounded-lg transition-all duration-150 ${
                codeMode === "react" ? "text-blue-400 bg-blue-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title={`${codeMode === "html" ? "HTML" : "React"} mode`}
            >
              <FileCode className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Export */}
        <div className="flex justify-end relative" ref={exportRef}>
          {html && !isGenerating && (
            <>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded-lg transition-all duration-150"
                title="Export options"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
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
                      onClick={() => handleExportAction(handleCopyWithFeedback)}
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
                    {onDeploy && (
                      <>
                        <div className="border-t border-zinc-700/50 my-1" />
                        <button
                          onClick={() => handleExportAction(onDeploy)}
                          disabled={isDeploying}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-green-400 hover:text-green-300 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                        >
                          {isDeploying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Rocket className="w-3.5 h-3.5" />
                          )}
                          {isDeploying ? "Deploying..." : "Deploy to Web"}
                        </button>
                        {lastDeployUrl && (
                          <a
                            href={lastDeployUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            <span className="truncate flex-1">{lastDeployUrl.replace("https://", "")}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        )}
                      </>
                    )}
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
                <Image src="/logo.png" alt="" width={24} height={24} className="object-contain opacity-40" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="text-zinc-500 text-[14px] font-medium">No preview yet</p>
                <p className="text-zinc-600 text-[13px] mt-1">Start a conversation to design your site</p>
              </div>
            </div>
          )}

          {isGenerating && (
            <GeneratingState isRevision={previewHistory.length > 0 || !!html} />
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
                  srcDoc={previewHtml || ""}
                  sandbox="allow-scripts allow-same-origin"
                  className={`w-full h-full border-0 ${selectMode ? "cursor-crosshair" : ""}`}
                  title="Website Preview"
                  aria-label="Generated website preview"
                  onLoad={() => {
                    if (iframeRef.current) {
                      // Enable select mode if active
                      if (selectMode) {
                        iframeRef.current.contentWindow?.postMessage({ type: '16s-set-select-mode', enabled: true }, '*');
                      }
                      if (onIframeLoad) {
                        onIframeLoad(iframeRef.current);
                      }
                    }
                  }}
                />
              </motion.div>
            </motion.div>
          )}

          {html && !isGenerating && showCode && (
            <div className="w-full h-full">
              <CodeEditor
                code={html}
                onChange={(code) => onCodeChange?.(code)}
                language={codeMode === "react" ? "typescript" : "html"}
                readOnly={!onCodeChange}
              />
            </div>
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
                <div className="flex-1 overflow-y-auto py-2 space-y-1">
                  {/* Current version */}
                  {(() => {
                    const currentBookmark = bookmarks.find(b => b.versionIndex === previewHistory.length);
                    return (
                      <div className="px-3 py-2 mx-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-medium text-green-400 flex-1">
                            {currentBookmark ? currentBookmark.name : `Version ${totalVersions}`}
                          </div>
                          {currentBookmark && (
                            <button
                              onClick={() => onRemoveBookmark(currentBookmark.id)}
                              className="p-1 rounded text-green-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove bookmark"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {currentBookmark && <BookmarkCheck className="w-3 h-3 text-green-400/60" />}
                          <span className="text-[11px] text-zinc-500">Current</span>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Previous versions */}
                  {[...previewHistory].reverse().map((_, reverseIdx) => {
                    const actualIdx = previewHistory.length - 1 - reverseIdx;
                    const bookmark = bookmarks.find(b => b.versionIndex === actualIdx);
                    return (
                      <div
                        key={actualIdx}
                        className={`mx-2 rounded-lg transition-colors ${
                          bookmark
                            ? "bg-amber-500/10 border border-amber-500/20"
                            : "hover:bg-white/[0.04]"
                        }`}
                      >
                        <button
                          onClick={() => onRestoreVersion(actualIdx)}
                          className="w-full text-left px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`text-[13px] flex-1 ${
                              bookmark ? "font-medium text-amber-400" : "text-zinc-400"
                            }`}>
                              {bookmark ? bookmark.name : `Version ${actualIdx + 1}`}
                            </div>
                            {bookmark && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveBookmark(bookmark.id);
                                }}
                                className="p-1 rounded text-amber-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Remove bookmark"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {bookmark && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <BookmarkCheck className="w-3 h-3 text-amber-400/60" />
                              <span className="text-[11px] text-zinc-500">Bookmarked</span>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bookmark input dialog */}
      <AnimatePresence>
        {showBookmarkInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => { setShowBookmarkInput(false); setBookmarkName(""); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass rounded-xl p-6 w-[320px] shadow-xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[15px] font-medium text-zinc-200 mb-4">
                Bookmark this version
              </h3>
              <input
                type="text"
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && bookmarkName.trim()) {
                    onAddBookmark(bookmarkName.trim());
                    setBookmarkName("");
                    setShowBookmarkInput(false);
                  } else if (e.key === "Escape") {
                    setBookmarkName("");
                    setShowBookmarkInput(false);
                  }
                }}
                placeholder="e.g., Before hero redesign"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-green-500/40 transition-colors"
                autoFocus
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setShowBookmarkInput(false); setBookmarkName(""); }}
                  className="flex-1 px-4 py-2 text-[13px] text-zinc-400 hover:text-zinc-200 glass glass-hover rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (bookmarkName.trim()) {
                      onAddBookmark(bookmarkName.trim());
                      setBookmarkName("");
                      setShowBookmarkInput(false);
                    }
                  }}
                  disabled={!bookmarkName.trim()}
                  className="flex-1 px-4 py-2 text-[13px] text-white bg-green-500/60 hover:bg-green-500/80 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy toast */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-lg px-4 py-2 shadow-lg z-50"
          >
            <p className="text-[13px] text-green-400 font-medium">Copied to clipboard</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected element floating panel */}
      <AnimatePresence>
        {selectMode && selectedElement && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-4 right-4 glass rounded-xl p-4 shadow-xl shadow-black/40 border border-green-500/20"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-[11px] font-mono font-medium text-green-400 bg-green-500/10 rounded">
                    {selectedElement.tagName}
                  </span>
                  {selectedElement.id && (
                    <span className="text-[11px] text-zinc-500 font-mono">#{selectedElement.id}</span>
                  )}
                  {selectedElement.className && (
                    <span className="text-[11px] text-zinc-600 font-mono truncate max-w-[200px]">
                      .{selectedElement.className.split(" ")[0]}
                    </span>
                  )}
                </div>
                {selectedElement.textContent && (
                  <p className="text-[12px] text-zinc-400 truncate mb-2">
                    &ldquo;{selectedElement.textContent.slice(0, 60)}...&rdquo;
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded border border-white/10"
                      style={{ backgroundColor: selectedElement.computedStyles.backgroundColor }}
                    />
                    <span className="text-[11px] text-zinc-500">bg</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded border border-white/10"
                      style={{ backgroundColor: selectedElement.computedStyles.color }}
                    />
                    <span className="text-[11px] text-zinc-500">text</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {selectedElement.computedStyles.fontSize}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onElementSelect(null)}
                className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 mt-3">
              Type in chat to edit this element, e.g. &ldquo;change the color to blue&rdquo;
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
