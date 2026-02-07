"use client";

import { useRef, useState, useCallback, useEffect, memo } from "react";
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
  MousePointer2,
  Bookmark,
  Rocket,
  Loader2,
  CheckCircle,
  FileCode,
  FolderArchive,
  Share2,
  Link2,
  Link2Off,
} from "lucide-react";
import type { Viewport, SelectedElement, CodeMode } from "@/lib/types";
import { DomainManager } from "@/components/domains/DomainManager";

const viewportConfig = {
  desktop: { width: "100%", icon: Monitor, label: "Desktop" },
  tablet: { width: "768px", icon: Tablet, label: "Tablet" },
  mobile: { width: "375px", icon: Smartphone, label: "Mobile" },
} as const;

interface PreviewToolbarProps {
  html: string | null;
  viewport: Viewport;
  onViewportChange: (vp: Viewport) => void;
  isGenerating: boolean;
  canGoBack: boolean;
  canRedo: boolean;
  onBack: () => void;
  onRedo: () => void;
  onReload: () => void;
  totalVersions: number;
  showHistory: boolean;
  onToggleHistory: () => void;
  selectMode: boolean;
  onSelectModeChange: (enabled: boolean) => void;
  onElementSelect: (el: SelectedElement | null) => void;
  onBookmark: () => void;
  showCode: boolean;
  onToggleCode: () => void;
  codeMode: CodeMode;
  onCodeModeChange?: (mode: CodeMode) => void;
  onExport: () => void;
  onExportZip: () => void;
  onCopyToClipboard: () => void;
  onOpenInNewTab: () => void;
  onDeploy?: () => void;
  isDeploying?: boolean;
  lastDeployUrl?: string | null;
  deployError?: string | null;
  onShare?: () => void;
  onUnshare?: () => void;
  isSharing?: boolean;
  shareUrl?: string | null;
  projectId?: string | null;
  isPro?: boolean;
  onUpgradeClick?: () => void;
  showDeployHistory?: boolean;
  onToggleDeployHistory?: () => void;
  hasDeployments?: boolean;
  onPublish?: () => void;
}

export const PreviewToolbar = memo(function PreviewToolbar({
  html,
  viewport,
  onViewportChange,
  isGenerating,
  canGoBack,
  canRedo,
  onBack,
  onRedo,
  onReload,
  totalVersions,
  showHistory,
  onToggleHistory,
  selectMode,
  onSelectModeChange,
  onElementSelect,
  onBookmark,
  showCode,
  onToggleCode,
  codeMode,
  onCodeModeChange,
  onExport,
  onExportZip,
  onCopyToClipboard,
  onOpenInNewTab,
  onDeploy,
  isDeploying,
  lastDeployUrl,
  deployError,
  onShare,
  onUnshare,
  isSharing,
  shareUrl,
  projectId,
  isPro,
  onUpgradeClick,
  showDeployHistory,
  onToggleDeployHistory,
  hasDeployments,
  onPublish,
}: PreviewToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const handleCopyWithFeedback = useCallback(() => {
    onCopyToClipboard();
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  }, [onCopyToClipboard]);

  const handleExportAction = useCallback((action: () => void) => {
    action();
    setShowExportMenu(false);
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
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = exportRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
        if (!items?.length) return;
        const active = document.activeElement;
        const idx = Array.from(items).indexOf(active as HTMLElement);
        const next = e.key === "ArrowDown"
          ? (idx + 1) % items.length
          : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    requestAnimationFrame(() => {
      exportRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showExportMenu]);

  // Close share dropdown on outside click or Escape
  useEffect(() => {
    if (!showShareMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowShareMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showShareMenu]);

  return (
    <>
      <div className="h-[52px] flex items-center justify-between px-2 md:px-4 border-b border-white/[0.04]">
        {/* Left: Nav buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className="p-2.5 md:p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-150"
            title="Undo (Cmd+Z)"
            aria-label="Undo"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2.5 md:p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-150"
            title="Redo (Cmd+Shift+Z)"
            aria-label="Redo"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onReload}
            disabled={!html}
            className="p-2.5 md:p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] disabled:text-zinc-700 disabled:cursor-not-allowed transition-all duration-150"
            title="Reload"
            aria-label="Reload preview"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-white/[0.06] mx-1" />
          <button
            onClick={() => totalVersions > 1 && onToggleHistory()}
            disabled={totalVersions <= 1}
            className={`p-2.5 md:p-2 rounded-lg transition-all duration-150 ${
              showHistory ? "text-green-400 bg-green-500/10" :
              totalVersions > 1 ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]" :
              "text-zinc-700 cursor-not-allowed"
            }`}
            title={totalVersions > 1 ? "Version history" : "Version history (make changes to build history)"}
            aria-label="Version history"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          {html && !isGenerating && (
            <button
              onClick={() => { onSelectModeChange(!selectMode); if (selectMode) onElementSelect(null); }}
              className={`p-2.5 md:p-2 rounded-lg transition-all duration-150 hidden md:block ${
                selectMode ? "text-green-400 bg-green-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title="Select element"
              aria-label="Select element"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
            </button>
          )}
          {html && !isGenerating && (
            <button
              onClick={onBookmark}
              className="p-2.5 md:p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-150"
              title="Bookmark"
              aria-label="Bookmark this version"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}
          {onToggleDeployHistory && hasDeployments && (
            <button
              onClick={onToggleDeployHistory}
              className={`p-2.5 md:p-2 rounded-lg transition-all duration-150 hidden md:block ${
                showDeployHistory ? "text-green-400 bg-green-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title="Deployment history"
              aria-label="Deployment history"
            >
              <Rocket className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Center: Viewport + Code toggles */}
        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center bg-white/[0.03] rounded-lg p-0.5">
            {(Object.keys(viewportConfig) as Viewport[]).map((vp) => {
              const Icon = viewportConfig[vp].icon;
              return (
                <button
                  key={vp}
                  onClick={() => onViewportChange(vp)}
                  disabled={!html}
                  className={`p-1.5 rounded-md transition-all duration-150 ${
                    !html
                      ? "text-zinc-600 cursor-not-allowed opacity-50"
                      : viewport === vp ? "bg-white/[0.08] text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={html ? viewportConfig[vp].label : "Generate a website first"}
                  aria-label={`${viewportConfig[vp].label} viewport${viewport === vp ? " (active)" : ""}${!html ? " (disabled)" : ""}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          <div className="w-px h-4 bg-white/[0.06] mx-1" />
          {html && !isGenerating && (
            <button
              onClick={onToggleCode}
              className={`p-1.5 rounded-lg transition-all duration-150 ${
                showCode ? "text-green-400 bg-green-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title="Code view (Cmd+/)"
              aria-label={showCode ? "Hide code view" : "Show code view"}
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
              aria-label={`Switch to ${codeMode === "html" ? "React" : "HTML"} mode`}
            >
              <FileCode className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Share + Export */}
        <div className="flex items-center gap-1 justify-end">
          {/* Share button */}
          {html && !isGenerating && onShare && (
            <div className="relative" ref={shareRef}>
              <button
                onClick={() => setShowShareMenu((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 md:py-1.5 text-[12px] md:text-[11px] font-medium rounded-lg transition-all duration-150 ${
                  shareUrl
                    ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
                title={shareUrl ? "Shared" : "Share"}
                aria-label="Share project"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{shareUrl ? "Shared" : "Share"}</span>
              </button>
              <AnimatePresence>
                {showShareMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full right-0 mt-1 z-20 glass rounded-xl overflow-hidden min-w-[260px] py-1 shadow-xl shadow-black/40"
                  >
                    {shareUrl ? (
                      <>
                        <div className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Link2 className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-[12px] font-semibold text-green-400 uppercase tracking-wider">Public link</span>
                          </div>
                          <p className="text-[12px] text-zinc-300 break-all leading-relaxed">{shareUrl.replace("https://", "")}</p>
                        </div>
                        <div className="flex gap-2 px-4 py-2 border-t border-white/[0.06]">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(shareUrl).catch(() => {});
                              setCopyToast(true);
                              setTimeout(() => setCopyToast(false), 2000);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy Link
                          </button>
                          <button
                            onClick={() => {
                              window.open(shareUrl, "_blank");
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {onUnshare && (
                          <div className="border-t border-white/[0.06]">
                            <button
                              onClick={() => { onUnshare(); setShowShareMenu(false); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-red-400 hover:text-red-300 hover:bg-white/[0.04] transition-colors"
                            >
                              <Link2Off className="w-3.5 h-3.5" /> Unshare
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-[13px] text-zinc-300 mb-3">Share this project publicly?</p>
                        <button
                          onClick={() => { onShare(); setShowShareMenu(false); }}
                          disabled={isSharing}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-green-500/80 hover:bg-green-500 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          {isSharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                          {isSharing ? "Sharing..." : "Create public link"}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Publish button — shows when preview differs from last deploy */}
          {onPublish && lastDeployUrl && html && !isGenerating && !isDeploying && (
            <button
              onClick={onPublish}
              className="flex items-center gap-1.5 px-2.5 py-2.5 md:py-1.5 text-[12px] md:text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all duration-150"
              title="Publish changes to your live site"
              aria-label="Publish changes"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Publish</span>
            </button>
          )}

          {/* Export button */}
          <div className="relative" ref={exportRef}>
          {html && !isGenerating && (
            <>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-2.5 md:py-1.5 text-[12px] md:text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded-lg transition-all duration-150"
                title="Export options"
                aria-label="Export options"
                aria-haspopup="true"
                aria-expanded={showExportMenu}
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
                    role="menu"
                    className="absolute top-full right-0 mt-1 z-20 glass rounded-xl overflow-hidden min-w-[180px] py-1 shadow-xl shadow-black/40"
                  >
                    <button role="menuitem" onClick={() => handleExportAction(onExport)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download HTML
                    </button>
                    <button role="menuitem" onClick={() => handleExportAction(onExportZip)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors">
                      <FolderArchive className="w-3.5 h-3.5" /> Download as ZIP
                    </button>
                    <button role="menuitem" onClick={() => handleExportAction(handleCopyWithFeedback)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors">
                      <Copy className="w-3.5 h-3.5" /> Copy to Clipboard
                    </button>
                    <button role="menuitem" onClick={() => handleExportAction(onOpenInNewTab)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                    </button>
                    {onDeploy && (
                      <>
                        <div className="border-t border-zinc-700/50 my-1" />
                        <button role="menuitem" onClick={() => handleExportAction(onDeploy)} disabled={isDeploying}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-green-400 hover:text-green-300 hover:bg-white/[0.04] transition-colors disabled:opacity-50">
                          {isDeploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                          {isDeploying ? "Deploying..." : "Deploy to Web"}
                        </button>
                        {deployError && (
                          <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-2.5">
                            <p className="text-[12px] text-red-400">{deployError}</p>
                          </div>
                        )}
                        {lastDeployUrl && (
                          <div className="border-t border-green-500/20 bg-green-500/5">
                            <div className="px-4 py-2.5 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-[12px] font-semibold text-green-400 uppercase tracking-wider">Live</span>
                            </div>
                            <div className="px-4 pb-1">
                              <p className="text-[13px] text-green-300 font-medium break-all leading-relaxed">{lastDeployUrl.replace("https://", "")}</p>
                            </div>
                            <div className="flex gap-2 px-4 py-3">
                              <a href={lastDeployUrl} target="_blank" rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" /> Open
                              </a>
                              <button onClick={() => {
                                navigator.clipboard.writeText(lastDeployUrl).catch(() => {});
                                setCopyToast(true);
                                setTimeout(() => setCopyToast(false), 2000);
                              }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                                aria-label="Copy deploy URL">
                                <Copy className="w-3.5 h-3.5" /> Copy URL
                              </button>
                            </div>
                          </div>
                        )}
                        {lastDeployUrl && projectId && (
                          <div className="border-t border-white/[0.06]">
                            <DomainManager
                              projectId={projectId}
                              isPro={isPro ?? false}
                              onUpgradeClick={onUpgradeClick}
                            />
                          </div>
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
      </div>

      {/* Copy toast */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            role="status"
            aria-live="polite"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-lg px-4 py-2 shadow-lg z-50"
          >
            <p className="text-[13px] text-green-400 font-medium">Copied to clipboard</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
