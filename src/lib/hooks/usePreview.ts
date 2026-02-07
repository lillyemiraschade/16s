"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import html2canvas from "html2canvas";
import type { Viewport, SelectedElement, VersionBookmark, CodeMode } from "@/lib/types";

// Cap version history to prevent memory bloat (50 x ~200KB HTML = ~10MB max)
const MAX_PREVIEW_HISTORY = 50;

export function usePreview(projectName: string) {
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [bookmarks, setBookmarks] = useState<VersionBookmark[]>([]);
  const [codeMode, setCodeMode] = useState<CodeMode>("html");

  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCodeRef = useRef<string | null>(null);

  // Cleanup screenshot timer on unmount
  useEffect(() => {
    return () => {
      if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
    };
  }, []);

  const captureScreenshot = useCallback(async (iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const opts = {
        scale: 0.5,
        logging: false,
        height: Math.min(doc.body.scrollHeight, 900),
        windowHeight: 900,
      };
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(doc.body, { ...opts, useCORS: true, allowTaint: false });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        setPreviewScreenshot(dataUrl);
      } catch {
        canvas = await html2canvas(doc.body, { ...opts, allowTaint: true });
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
          setPreviewScreenshot(dataUrl);
        } catch {
          console.debug("Screenshot skipped: tainted canvas");
        }
      }
    } catch {
      console.debug("Screenshot capture failed");
    }
  }, []);

  const handleIframeLoad = useCallback((iframe: HTMLIFrameElement) => {
    if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
    screenshotTimerRef.current = setTimeout(() => captureScreenshot(iframe), 500);
  }, [captureScreenshot]);

  const handleUndo = useCallback(() => {
    if (previewHistory.length > 0 && currentPreview) {
      const prev = [...previewHistory];
      const last = prev.pop()!;
      setPreviewHistory(prev);
      setRedoHistory((r) => [...r, currentPreview]);
      setCurrentPreview(last);
    }
  }, [previewHistory, currentPreview]);

  const handleRedo = useCallback(() => {
    if (redoHistory.length > 0 && currentPreview) {
      const redo = [...redoHistory];
      const next = redo.pop()!;
      setRedoHistory(redo);
      setPreviewHistory((prev) => [...prev, currentPreview].slice(-MAX_PREVIEW_HISTORY));
      setCurrentPreview(next);
    }
  }, [redoHistory, currentPreview]);

  const handleExport = useCallback(() => {
    if (!currentPreview) return;
    const blob = new Blob([currentPreview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "website"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentPreview, projectName]);

  const handleCopyToClipboard = useCallback(() => {
    if (!currentPreview) return;
    navigator.clipboard.writeText(currentPreview).catch(() => {});
  }, [currentPreview]);

  const handleOpenInNewTab = useCallback(() => {
    if (!currentPreview) return;
    const blob = new Blob([currentPreview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [currentPreview]);

  const handleRestoreVersion = useCallback((index: number) => {
    if (currentPreview && previewHistory[index]) {
      const selectedVersion = previewHistory[index];
      setPreviewHistory((prev) => [...prev, currentPreview].slice(-MAX_PREVIEW_HISTORY));
      setCurrentPreview(selectedVersion);
      setRedoHistory([]);
    }
  }, [currentPreview, previewHistory]);

  const handleAddBookmark = useCallback((name: string) => {
    const newBookmark: VersionBookmark = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      versionIndex: previewHistory.length,
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [...prev, newBookmark]);
  }, [previewHistory.length]);

  const handleRemoveBookmark = useCallback((bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  }, []);

  const handleRestoreBookmark = useCallback((bookmark: VersionBookmark) => {
    if (bookmark.versionIndex === previewHistory.length) return;
    if (bookmark.versionIndex < previewHistory.length) {
      handleRestoreVersion(bookmark.versionIndex);
    }
  }, [previewHistory.length, handleRestoreVersion]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCurrentPreview(newCode);
    if (codeEditTimerRef.current) clearTimeout(codeEditTimerRef.current);
    codeEditTimerRef.current = setTimeout(() => {
      if (lastCodeRef.current && lastCodeRef.current !== newCode) {
        setPreviewHistory((prev) => {
          if (prev[prev.length - 1] === lastCodeRef.current) return prev;
          return [...prev, lastCodeRef.current!];
        });
        setRedoHistory([]);
      }
      lastCodeRef.current = newCode;
    }, 1000);
  }, []);

  // Initialize lastCodeRef when preview changes from AI
  useEffect(() => {
    if (currentPreview && !lastCodeRef.current) {
      lastCodeRef.current = currentPreview;
    }
  }, [currentPreview]);

  const handleClearSelection = useCallback(() => {
    setSelectedElement(null);
    setSelectMode(false);
  }, []);

  /** Push new HTML into preview (used by chat when AI returns HTML) */
  const pushPreview = useCallback((html: string) => {
    setCurrentPreview((prev) => {
      if (prev) {
        setPreviewHistory((hist) => [...hist, prev].slice(-MAX_PREVIEW_HISTORY));
      }
      return html;
    });
    setRedoHistory([]);
    lastCodeRef.current = html;
  }, []);

  const resetPreview = useCallback(() => {
    setCurrentPreview(null);
    setPreviewHistory([]);
    setRedoHistory([]);
    setPreviewScreenshot(null);
    setSelectMode(false);
    setSelectedElement(null);
    setBookmarks([]);
    setCodeMode("html");
    lastCodeRef.current = null;
  }, []);

  return {
    currentPreview,
    setCurrentPreview,
    previewHistory,
    setPreviewHistory,
    redoHistory,
    setRedoHistory,
    viewport,
    setViewport,
    previewScreenshot,
    selectMode,
    setSelectMode,
    selectedElement,
    setSelectedElement,
    bookmarks,
    setBookmarks,
    codeMode,
    setCodeMode,
    handleIframeLoad,
    handleUndo,
    handleRedo,
    handleExport,
    handleCopyToClipboard,
    handleOpenInNewTab,
    handleRestoreVersion,
    handleAddBookmark,
    handleRemoveBookmark,
    handleRestoreBookmark,
    handleCodeChange,
    handleClearSelection,
    pushPreview,
    resetPreview,
  };
}
