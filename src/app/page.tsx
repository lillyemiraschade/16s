"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, ImagePlus, X } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { VoiceCall } from "@/components/chat/VoiceCall";
import { processImageFiles } from "@/lib/images";
import { saveProject, loadProject, listProjects, deleteProject } from "@/lib/projects";
import type { Message, Viewport, SavedProjectMeta } from "@/lib/types";

const HEADLINES = [
  "What shall we build?",
  "What idea should we bring to life?",
  "Ready to design something new?",
  "What\u2019s the vision?",
  "Let\u2019s build something together.",
  "Describe your dream site.",
  "What are we creating today?",
  "Got a project in mind?",
];

const TEMPLATE_CATEGORIES = [
  { label: "Portfolio", prompt: "Design a modern portfolio website for a creative professional" },
  { label: "Business", prompt: "Build a professional business website with services and contact sections" },
  { label: "Restaurant", prompt: "Create a restaurant website with menu, hours, and reservation info" },
  { label: "E-commerce", prompt: "Design an online store with product grid, cart, and checkout" },
  { label: "Blog", prompt: "Build a clean, minimal blog with featured posts and categories" },
  { label: "Landing Page", prompt: "Create a conversion-focused landing page with hero, features, and CTA" },
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [isGenerating, setIsGenerating] = useState(false);
  const [inspoImages, setInspoImages] = useState<string[]>([]);
  const [isOnCall, setIsOnCall] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);

  // Project state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled");
  const [savedProjects, setSavedProjects] = useState<SavedProjectMeta[]>([]);

  // Randomized on each mount/reset
  const [welcomeKey, setWelcomeKey] = useState(0);
  const headline = useMemo(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)], [welcomeKey]);

  const [welcomeInput, setWelcomeInput] = useState("");
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeFileRef = useRef<HTMLInputElement>(null);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved projects list on mount
  useEffect(() => {
    setSavedProjects(listProjects());
  }, []);

  // Auto-restore last project on mount
  useEffect(() => {
    const projects = listProjects();
    if (projects.length > 0) {
      const last = loadProject(projects[0].id);
      if (last && last.messages.length > 0) {
        setCurrentProjectId(last.id);
        setProjectName(last.name);
        setMessages(last.messages);
        setCurrentPreview(last.currentPreview);
        setPreviewHistory(last.previewHistory);
        setHasStarted(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save project (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasStarted || messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const id = currentProjectId || generateId();
      if (!currentProjectId) setCurrentProjectId(id);
      const name = projectName === "Untitled" && messages.length > 0
        ? messages.find((m) => m.role === "user")?.content.slice(0, 40) || "Untitled"
        : projectName;
      if (name !== projectName) setProjectName(name);
      saveProject({
        id,
        name,
        messages,
        currentPreview,
        previewHistory,
        updatedAt: Date.now(),
      });
      setSavedProjects(listProjects());
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [messages, currentPreview, previewHistory, hasStarted, currentProjectId, projectName]);

  const captureScreenshot = useCallback(async (iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const canvas = await html2canvas(doc.body, {
        useCORS: true,
        scale: 0.5,
        logging: false,
        height: Math.min(doc.body.scrollHeight, 900),
        windowHeight: 900,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      setPreviewScreenshot(dataUrl);
    } catch (err) {
      console.error("Screenshot capture failed:", err);
    }
  }, []);

  const handleIframeLoad = useCallback((iframe: HTMLIFrameElement) => {
    if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
    screenshotTimerRef.current = setTimeout(() => captureScreenshot(iframe), 500);
  }, [captureScreenshot]);

  useEffect(() => {
    return () => {
      if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
    };
  }, []);

  // Abort controller for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (text: string, imagesToInclude?: string[]) => {
    const imagesToSend = imagesToInclude || [...inspoImages];
    if (!imagesToInclude) setInspoImages([]);

    if (!hasStarted) setHasStarted(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    };

    // Add user message optimistically
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const cleanMessages = [...messagesRef.current, userMessage].map(
        ({ images, pills, showUpload, ...rest }) => rest
      );

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: cleanMessages,
          inspoImages: imagesToSend,
          currentPreview,
          previewScreenshot,
        }),
        signal: controller.signal,
      });

      // Handle error responses - try to get specific error message
      if (!response.ok) {
        let errorMsg = "Something went wrong. Please try again.";
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          // If we can't parse error response, use status-based message
          if (response.status === 413) errorMsg = "Request too large. Try with fewer or smaller images.";
          else if (response.status === 429) errorMsg = "Too many requests. Please wait a moment.";
        }
        throw new Error(errorMsg);
      }

      const responseText = await response.text();
      const lines = responseText.trim().split("\n").filter((l) => l.trim());
      const data = JSON.parse(lines[lines.length - 1]);

      // Check if API returned an error in the response body
      if (data.error) {
        throw new Error(data.error);
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        pills: data.pills,
        showUpload: data.showUpload,
      };
      setMessages((prev) => [...prev, aiMessage]);

      if (data.html) {
        if (currentPreview) {
          setPreviewHistory((prev) => [...prev, currentPreview]);
        }
        setRedoHistory([]); // Clear redo on new version
        // Inject navigation guard to keep all clicks inside iframe
        const navGuard = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a){var h=a.getAttribute('href');if(h&&h.startsWith('http')){e.preventDefault();return;}if(h&&!h.startsWith('javascript:')){e.preventDefault();}}},true);</script>`;
        const safeHtml = data.html.replace(/<head([^>]*)>/i, `<head$1>${navGuard}`);
        setCurrentPreview(safeHtml);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error sending message:", error);

      // Remove the failed user message to keep history clean
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));

      // Show the actual error message
      const errorMsg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMsg,
        },
      ]);
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false);
      }
    }
  };

  const handlePillClick = (pill: string) => {
    if (isGenerating) return;
    if (pill.toLowerCase().includes("hop on a call")) {
      setIsOnCall(true);
      return;
    }
    handleSendMessage(pill);
  };

  const handleCallComplete = (summary: string) => {
    setIsOnCall(false);
    handleSendMessage(summary);
  };

  const handleImageUpload = (base64: string) => {
    setInspoImages((prev) => [...prev, base64]);
  };

  const handleImageRemove = (index: number) => {
    setInspoImages((prev) => prev.filter((_, i) => i !== index));
  };

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
      setPreviewHistory((prev) => [...prev, currentPreview]);
      setCurrentPreview(next);
    }
  }, [redoHistory, currentPreview]);

  const handleExport = useCallback(() => {
    if (!currentPreview) return;
    const blob = new Blob([currentPreview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [currentPreview]);

  const handleCopyToClipboard = useCallback(() => {
    if (!currentPreview) return;
    navigator.clipboard.writeText(currentPreview);
  }, [currentPreview]);

  const handleOpenInNewTab = useCallback(() => {
    if (!currentPreview) return;
    const blob = new Blob([currentPreview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [currentPreview]);

  const handleRestoreVersion = useCallback((index: number) => {
    if (currentPreview) {
      // Push current and all history after index into redo
      const historyAfter = previewHistory.slice(index + 1);
      setRedoHistory((r) => [...r, ...historyAfter, currentPreview]);
      setCurrentPreview(previewHistory[index]);
      setPreviewHistory(previewHistory.slice(0, index));
    }
  }, [currentPreview, previewHistory]);

  const handleNewProject = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setCurrentPreview(null);
    setPreviewHistory([]);
    setRedoHistory([]);
    setInspoImages([]);
    setIsGenerating(false);
    setHasStarted(false);
    setWelcomeInput("");
    setWelcomeKey((k) => k + 1);
    setIsOnCall(false);
    setPreviewScreenshot(null);
    setCurrentProjectId(null);
    setProjectName("Untitled");
  }, []);

  const handleLoadProject = useCallback((id: string) => {
    const proj = loadProject(id);
    if (!proj) return;
    abortRef.current?.abort();
    setMessages(proj.messages);
    setCurrentPreview(proj.currentPreview);
    setPreviewHistory(proj.previewHistory);
    setRedoHistory([]);
    setInspoImages([]);
    setIsGenerating(false);
    setHasStarted(true);
    setIsOnCall(false);
    setPreviewScreenshot(null);
    setCurrentProjectId(proj.id);
    setProjectName(proj.name);
  }, []);

  const handleDeleteProject = useCallback((id: string) => {
    deleteProject(id);
    setSavedProjects(listProjects());
    if (id === currentProjectId) {
      handleNewProject();
    }
  }, [currentProjectId, handleNewProject]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!hasStarted) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.code === "KeyN" && !e.shiftKey) {
        e.preventDefault();
        handleNewProject();
      } else if (e.code === "KeyE" && !e.shiftKey) {
        e.preventDefault();
        handleExport();
      } else if (e.code === "KeyC" && e.shiftKey) {
        e.preventDefault();
        handleCopyToClipboard();
      } else if (e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.code === "KeyZ" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-code-view"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasStarted, handleNewProject, handleExport, handleCopyToClipboard, handleUndo, handleRedo]);

  const handleWelcomeSend = () => {
    if ((!welcomeInput.trim() && inspoImages.length === 0) || isGenerating) return;
    const text = welcomeInput.trim() || "Here are my inspiration images. Please design based on these.";
    const imgs = [...inspoImages];
    setWelcomeInput("");
    setInspoImages([]);
    handleSendMessage(text, imgs);
  };

  const handleWelcomeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleWelcomeSend();
    }
  };

  const handleWelcomeError = (msg: string) => {
    setWelcomeError(msg);
    setTimeout(() => setWelcomeError(null), 4000);
  };

  const handleWelcomeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processImageFiles(e.target.files, handleImageUpload, handleWelcomeError);
      e.target.value = "";
    }
  };

  // Welcome screen
  if (!hasStarted) {
    return (
      <div id="main-content" className="h-screen welcome-bg flex flex-col">
        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          <img src="/logo.png" alt="16s logo" className="w-8 h-8 object-contain" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center gap-8 w-full max-w-[640px]"
          >
            <div className="flex flex-col items-center gap-4">
              <img src="/logo.png" alt="" className="w-12 h-12 object-contain" />
              <h1 className="text-[36px] font-semibold text-zinc-100 tracking-[-0.03em] text-center">
                {headline}
              </h1>
            </div>

            {/* Error toast */}
            <AnimatePresence>
              {welcomeError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full glass rounded-xl px-4 py-3 border border-red-500/20"
                >
                  <p className="text-[13px] text-red-400 text-center">{welcomeError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="w-full glass-input-glow rounded-2xl">
              {inspoImages.length > 0 && (
                <div className="flex gap-2 flex-wrap px-4 pt-4">
                  {inspoImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`Upload ${idx + 1}`} className="h-14 w-14 object-cover rounded-lg ring-1 ring-white/[0.06]" />
                      <button
                        onClick={() => handleImageRemove(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ring-1 ring-white/[0.06]"
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        <X className="w-3 h-3 text-zinc-300" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => welcomeFileRef.current?.click()}
                    className="h-14 w-14 rounded-lg glass glass-hover flex items-center justify-center transition-all duration-200"
                    aria-label="Add more images"
                  >
                    <ImagePlus className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 px-5 py-4">
                <textarea
                  ref={welcomeTextareaRef}
                  value={welcomeInput}
                  onChange={(e) => {
                    setWelcomeInput(e.target.value);
                    const el = welcomeTextareaRef.current;
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 160) + "px";
                    }
                  }}
                  onKeyDown={handleWelcomeKeyDown}
                  placeholder="Describe what you want to build..."
                  disabled={isGenerating}
                  aria-label="Message input"
                  autoComplete="off"
                  rows={1}
                  className="flex-1 bg-transparent text-[16px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-40 resize-none overflow-y-auto leading-relaxed"
                  style={{ maxHeight: 160 }}
                />
                <button
                  onClick={handleWelcomeSend}
                  disabled={(!welcomeInput.trim() && inspoImages.length === 0) || isGenerating}
                  className="p-3 bg-green-500/60 hover:bg-green-400/70 disabled:bg-zinc-800/60 disabled:cursor-not-allowed rounded-full transition-all duration-200 flex-shrink-0 glow-green-strong disabled:shadow-none"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="flex items-center gap-1 px-5 pb-3">
                <button
                  onClick={() => welcomeFileRef.current?.click()}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors"
                  title="Upload images"
                  aria-label="Upload images"
                >
                  <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
                </button>
                <input
                  ref={welcomeFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleWelcomeFileUpload}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Template categories */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[480px]">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => handleSendMessage(cat.prompt)}
                  disabled={isGenerating}
                  className="px-4 py-3 text-[13px] font-medium text-zinc-400 hover:text-zinc-200 glass-pill disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all duration-200 text-center"
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Chat + Preview split layout
  return (
    <AnimatePresence>
      <motion.div
        id="main-content"
        className="flex h-screen overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <nav className="w-1/3 min-w-[360px] max-w-[480px]" aria-label="Chat">
          <ChatPanel
            messages={messages}
            onSend={handleSendMessage}
            onPillClick={handlePillClick}
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            isGenerating={isGenerating}
            inspoImages={inspoImages}
            onNewProject={handleNewProject}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            savedProjects={savedProjects}
            currentProjectId={currentProjectId}
            isOnCall={isOnCall}
            onStartCall={() => setIsOnCall(true)}
            onEndCall={() => setIsOnCall(false)}
            hasPreview={!!currentPreview}
          />
        </nav>
        <main className="flex-1 relative" aria-label="Preview">
          <PreviewPanel
            html={currentPreview}
            viewport={viewport}
            onViewportChange={setViewport}
            isGenerating={isGenerating}
            canGoBack={previewHistory.length > 0}
            canRedo={redoHistory.length > 0}
            onBack={handleUndo}
            onRedo={handleRedo}
            onExport={handleExport}
            onCopyToClipboard={handleCopyToClipboard}
            onOpenInNewTab={handleOpenInNewTab}
            onIframeLoad={handleIframeLoad}
            previewHistory={previewHistory}
            onRestoreVersion={handleRestoreVersion}
          />
          {/* Voice call widget — top-right of preview area */}
          <AnimatePresence>
            {isOnCall && (
              <div className="absolute top-14 right-4 z-30">
                <VoiceCall
                  onCallComplete={handleCallComplete}
                  onHangUp={() => setIsOnCall(false)}
                />
              </div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>
    </AnimatePresence>
  );
}
