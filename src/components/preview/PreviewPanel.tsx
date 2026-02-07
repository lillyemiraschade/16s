"use client";

import { useRef, useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { PreviewPanelProps, Viewport } from "@/lib/types";
import Image from "next/image";
import dynamic from "next/dynamic";
import { createReactPreviewHtml } from "@/lib/react-preview";
import { GeneratingState } from "./GeneratingState";
import { PreviewToolbar } from "./PreviewToolbar";
import { VersionHistory } from "./VersionHistory";
import { DeploymentHistory } from "@/components/deploy/DeploymentHistory";
import { QualityCard } from "./QualityCard";

const CodeEditor = dynamic(() => import("./CodeEditor").then((m) => m.CodeEditor), {
  loading: () => <div className="flex items-center justify-center h-full text-zinc-500 text-sm">Loading editor...</div>,
});

const viewportWidths: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

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

export const PreviewPanel = memo(function PreviewPanel({
  html,
  viewport,
  onViewportChange,
  isGenerating,
  canGoBack,
  canRedo,
  onBack,
  onRedo,
  onExport,
  onExportZip,
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
  deployError,
  onCodeChange,
  codeMode = "html",
  onCodeModeChange,
  onShare,
  onUnshare,
  isSharing,
  shareUrl,
  projectId,
  isPro,
  onUpgradeClick,
  onRevertToDeployment,
  onPublish,
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeployHistory, setShowDeployHistory] = useState(false);
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [showQuality, setShowQuality] = useState(false);

  // Listen for element selection messages from iframe
  // Sandboxed iframes without allow-same-origin have origin "null",
  // so we validate the message type prefix instead of origin
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (typeof e.data?.type !== 'string' || !e.data.type.startsWith('16s-')) return;
      if (e.data.type === '16s-element-selected') {
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
  // Inject CSP to prevent generated HTML from making network requests
  const PREVIEW_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; font-src * data:; style-src 'unsafe-inline' https://fonts.googleapis.com; connect-src 'none'; frame-src 'none';">`;
  const isReact = html && codeMode === "react";
  const injectCSP = (h: string) => h.replace(/<head([^>]*)>/i, `<head$1>${PREVIEW_CSP}`);
  const previewHtml = html
    ? isReact
      ? createReactPreviewHtml(html)
      : injectCSP(html.replace('</body>', `${SELECT_MODE_SCRIPT}</body>`))
    : null;

  // Keyboard shortcut for code view
  useEffect(() => {
    const handler = () => setShowCode((v) => !v);
    window.addEventListener("toggle-code-view", handler);
    return () => window.removeEventListener("toggle-code-view", handler);
  }, []);

  const totalVersions = previewHistory.length + (html ? 1 : 0);

  return (
    <div className="flex flex-col h-full bg-[#0c0c0d] dot-grid relative">
      <PreviewToolbar
        html={html}
        viewport={viewport}
        onViewportChange={onViewportChange}
        isGenerating={isGenerating}
        canGoBack={canGoBack}
        canRedo={canRedo}
        onBack={onBack}
        onRedo={onRedo}
        onReload={() => setReloadKey((k) => k + 1)}
        totalVersions={totalVersions}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory((v) => !v)}
        selectMode={selectMode}
        onSelectModeChange={onSelectModeChange}
        onElementSelect={onElementSelect}
        onBookmark={() => setShowBookmarkInput(true)}
        showCode={showCode}
        onToggleCode={() => setShowCode((v) => !v)}
        codeMode={codeMode}
        onCodeModeChange={onCodeModeChange}
        onExport={onExport}
        onExportZip={onExportZip}
        onCopyToClipboard={onCopyToClipboard}
        onOpenInNewTab={onOpenInNewTab}
        onDeploy={onDeploy}
        isDeploying={isDeploying}
        lastDeployUrl={lastDeployUrl}
        deployError={deployError}
        onShare={onShare}
        onUnshare={onUnshare}
        isSharing={isSharing}
        shareUrl={shareUrl}
        projectId={projectId}
        isPro={isPro}
        onUpgradeClick={onUpgradeClick}
        showDeployHistory={showDeployHistory}
        onToggleDeployHistory={() => setShowDeployHistory(v => !v)}
        hasDeployments={!!lastDeployUrl}
        onPublish={onPublish}
        showQuality={showQuality}
        onToggleQuality={() => setShowQuality(v => !v)}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
          {/* Empty state */}
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

          {/* Generating animation */}
          {isGenerating && (
            <GeneratingState isRevision={previewHistory.length > 0 || !!html} />
          )}

          {/* Preview iframe */}
          {html && !isGenerating && !showCode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full flex flex-col items-center"
            >
              <div
                className="glass rounded-t-xl transition-all duration-300"
                style={{
                  width: viewport === "desktop" ? "100%" : viewportWidths[viewport],
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
              <motion.div
                className="bg-white rounded-b-xl overflow-hidden border-x border-b border-white/[0.06] shadow-2xl shadow-black/40 transition-all duration-300"
                style={{
                  width: viewport === "desktop" ? "100%" : viewportWidths[viewport],
                  maxWidth: "100%",
                  height: "calc(100vh - 140px)",
                }}
                layout
              >
                <iframe
                  key={reloadKey}
                  ref={iframeRef}
                  srcDoc={previewHtml || ""}
                  sandbox="allow-scripts allow-popups"
                  className={`w-full h-full border-0 ${selectMode ? "cursor-crosshair" : ""}`}
                  title="Website Preview"
                  aria-label="Generated website preview"
                  onLoad={() => {
                    if (iframeRef.current) {
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

          {/* Code editor */}
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
            <VersionHistory
              previewHistory={previewHistory}
              totalVersions={totalVersions}
              bookmarks={bookmarks}
              onRestoreVersion={onRestoreVersion}
              onAddBookmark={onAddBookmark}
              onRemoveBookmark={onRemoveBookmark}
              onClose={() => setShowHistory(false)}
              showBookmarkInput={showBookmarkInput}
              onShowBookmarkInput={setShowBookmarkInput}
            />
          )}
        </AnimatePresence>

        {/* Deployment history slide-out */}
        {projectId && (
          <DeploymentHistory
            projectId={projectId}
            isOpen={showDeployHistory}
            onClose={() => setShowDeployHistory(false)}
            onRevert={(html) => onRevertToDeployment?.(html)}
            currentPreview={html}
            latestDeployUrl={lastDeployUrl || null}
          />
        )}
      </div>

      {/* Quality audit panel */}
      <AnimatePresence>
        {showQuality && html && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 right-4 z-40 w-[300px]"
          >
            <QualityCard html={html} />
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
                    <div className="w-4 h-4 rounded border border-white/10" style={{ backgroundColor: selectedElement.computedStyles.backgroundColor }} />
                    <span className="text-[11px] text-zinc-500">bg</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded border border-white/10" style={{ backgroundColor: selectedElement.computedStyles.color }} />
                    <span className="text-[11px] text-zinc-500">text</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">{selectedElement.computedStyles.fontSize}</span>
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
});
