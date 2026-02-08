"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, ImagePlus, X, FolderOpen, MessageSquare, Monitor } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import dynamic from "next/dynamic";
const VoiceCall = dynamic(() => import("@/components/chat/VoiceCall").then(m => m.VoiceCall), {
  ssr: false,
  loading: () => <div className="glass-matte rounded-2xl p-6 text-zinc-500 text-sm">Loading voice call...</div>,
});
import { useProjects } from "@/lib/hooks/useProjects";
import { useDeployment } from "@/lib/hooks/useDeployment";
import { useImages } from "@/lib/hooks/useImages";
import { useWelcome } from "@/lib/hooks/useWelcome";
import { usePreview } from "@/lib/hooks/usePreview";
import { useChat } from "@/lib/hooks/useChat";
import { MigrationBanner } from "@/components/auth/MigrationBanner";
import { UserMenu } from "@/components/auth/UserMenu";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { OnboardingTooltip } from "@/components/onboarding/OnboardingTooltip";
import type { SavedProjectMeta, ProjectContext, UploadedImage } from "@/lib/types";


function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function HomePageContent() {
  // Project state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled");
  const [savedProjects, setSavedProjects] = useState<SavedProjectMeta[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext | undefined>(undefined);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // External hooks
  const { save: saveProject, load: loadProject, list: listProjects, remove: deleteProject, isCloud, isAuthLoading, migrationStatus, migratedCount } = useProjects();
  const { user, isConfigured } = useAuth();
  const { deploy, isDeploying, lastDeployment } = useDeployment();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // ─── Hook composition ───
  const images = useImages();
  const preview = usePreview(projectName);

  // Stable callbacks for cross-hook communication
  const handleContextUpdate = useCallback((ctx: Partial<ProjectContext>) => {
    setProjectContext((prev) => prev ? { ...prev, ...ctx } : ctx as ProjectContext);
  }, []);

  const handleClearImages = useCallback(() => {
    images.setUploadedImages([]);
  }, [images.setUploadedImages]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestoreImages = useCallback((imgs: UploadedImage[]) => {
    images.setUploadedImages(imgs);
  }, [images.setUploadedImages]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetPreview = useCallback(() => {
    preview.setPreviewHistory([]);
    preview.setCurrentPreview(null);
    preview.setRedoHistory([]);
  }, [preview.setPreviewHistory, preview.setCurrentPreview, preview.setRedoHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const chat = useChat({
    currentPreview: preview.currentPreview,
    previewScreenshot: preview.previewScreenshot,
    projectContext,
    uploadedImages: images.uploadedImages,
    selectedElement: preview.selectedElement,
    isConfigured,
    user,
    onPushPreview: preview.pushPreview,
    onContextUpdate: handleContextUpdate,
    onClearImages: handleClearImages,
    onRestoreImages: handleRestoreImages,
    onClearSelection: preview.handleClearSelection,
    onResetPreview: handleResetPreview,
  });

  const welcome = useWelcome({
    uploadedImages: images.uploadedImages,
    isGenerating: chat.isGenerating,
    onSend: chat.handleSendMessage,
    onImageUpload: images.handleImageUpload,
  });

  // ─── Auto-switch to preview on mobile when new preview arrives ───
  const prevPreviewRef = useRef(preview.currentPreview);
  useEffect(() => {
    if (preview.currentPreview && preview.currentPreview !== prevPreviewRef.current && window.innerWidth < 768) {
      setMobileView("preview");
    }
    prevPreviewRef.current = preview.currentPreview;
  }, [preview.currentPreview]);

  // ─── Auth error from URL ───
  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      let errorMessage: string;
      try { errorMessage = decodeURIComponent(authError); } catch { errorMessage = authError; }
      console.debug("[Auth] Error from callback:", errorMessage);
      welcome.setWelcomeError(`Sign in failed: ${errorMessage}`);
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams, welcome]);

  // ─── Load saved projects list on mount ───
  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;
    const loadProjectsList = async () => {
      const projects = await listProjects();
      if (!cancelled) setSavedProjects(projects);
    };
    loadProjectsList();
    return () => { cancelled = true; };
  }, [isAuthLoading, listProjects, isCloud]);

  // ─── Auto-restore last project on mount or load from URL param ───
  useEffect(() => {
    if (isAuthLoading) return;
    // Don't overwrite messages if user has already started chatting
    if (chat.hasStarted) return;
    let cancelled = false;
    const projectIdFromUrl = searchParams.get("project");

    const restoreProject = async () => {
      if (projectIdFromUrl) {
        const proj = await loadProject(projectIdFromUrl);
        if (cancelled) return;
        if (proj) {
          setCurrentProjectId(proj.id);
          setProjectName(proj.name);
          chat.setMessages(proj.messages);
          preview.setCurrentPreview(proj.currentPreview);
          preview.setPreviewHistory(proj.previewHistory);
          preview.setBookmarks(proj.bookmarks || []);
          setProjectContext(proj.context);
          chat.setHasStarted(true);
          window.history.replaceState({}, "", "/");
          return;
        }
      }

      const projects = await listProjects();
      if (cancelled) return;
      if (projects.length > 0) {
        const last = await loadProject(projects[0].id);
        if (cancelled) return;
        if (last && last.messages.length > 0) {
          setCurrentProjectId(last.id);
          setProjectName(last.name);
          chat.setMessages(last.messages);
          preview.setCurrentPreview(last.currentPreview);
          preview.setPreviewHistory(last.previewHistory);
          preview.setBookmarks(last.bookmarks || []);
          setProjectContext(last.context);
          chat.setHasStarted(true);
        }
      }
    };
    restoreProject();
    // When chat.hasStarted changes to true, cleanup cancels any in-flight restoration
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, searchParams, chat.hasStarted]);

  // ─── Auto-save project (debounced) ───
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  const pendingProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!chat.hasStarted || isAuthLoading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const doSave = async () => {
      try {
        setSaveStatus("saving");
        const id = currentProjectId || pendingProjectIdRef.current || generateId();
        if (!currentProjectId) {
          pendingProjectIdRef.current = id;
          setCurrentProjectId(id);
        }

        let name = projectName;
        if (projectName === "Untitled" && chat.messages.length > 0) {
          const firstUserMsg = chat.messages.find((m) => m.role === "user");
          name = firstUserMsg?.content.slice(0, 40) || "New Project";
        } else if (projectName === "Untitled" && chat.messages.length === 0) {
          name = "New Project";
        }
        if (name !== projectName) setProjectName(name);

        await saveProject({
          id,
          name,
          messages: chat.messages,
          currentPreview: preview.currentPreview,
          previewHistory: preview.previewHistory,
          bookmarks: preview.bookmarks,
          context: projectContext,
          updatedAt: Date.now(),
        });
        const updatedList = await listProjects();
        setSavedProjects(updatedList);
        pendingSaveRef.current = null;
        pendingProjectIdRef.current = null;
        setSaveStatus("saved");
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        setSaveStatus("idle");
        console.debug("[AutoSave] Failed to save project:", error);
      }
    };

    pendingSaveRef.current = doSave;
    const delay = currentProjectId ? 1000 : 0;
    saveTimerRef.current = setTimeout(doSave, delay);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [chat.messages, preview.currentPreview, preview.previewHistory, preview.bookmarks, chat.hasStarted, currentProjectId, projectName, projectContext, saveProject, listProjects, isAuthLoading, isCloud]);

  // ─── Save immediately when leaving the page ───
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        const id = currentProjectId || generateId();
        let name = projectName;
        if (projectName === "Untitled" && chat.messages.length > 0) {
          const firstUserMsg = chat.messages.find((m) => m.role === "user");
          name = firstUserMsg?.content.slice(0, 40) || "New Project";
        } else if (projectName === "Untitled") {
          name = "New Project";
        }
        const project = {
          id,
          name,
          messages: chat.messages,
          currentPreview: preview.currentPreview,
          previewHistory: preview.previewHistory,
          bookmarks: preview.bookmarks,
          context: projectContext,
          updatedAt: Date.now(),
        };
        try {
          const key = `16s_projects`;
          const existing = JSON.parse(localStorage.getItem(key) || "[]");
          const idx = existing.findIndex((p: { id: string }) => p.id === id);
          if (idx >= 0) existing[idx] = project;
          else existing.unshift(project);
          localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
        } catch (e) {
          if (e instanceof DOMException && e.name === "QuotaExceededError") {
            try {
              const key = `16s_projects`;
              const existing = JSON.parse(localStorage.getItem(key) || "[]");
              localStorage.setItem(key, JSON.stringify(existing.slice(0, 5)));
            } catch { /* truly out of space */ }
          }
          console.debug("[Save] Failed to save on unload:", e);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentProjectId, projectName, chat.messages, preview.currentPreview, preview.previewHistory, preview.bookmarks, projectContext]);

  // ─── Project management handlers ───
  const handleDeploy = useCallback(async () => {
    if (!preview.currentPreview || !currentProjectId) return;
    const result = await deploy(preview.currentPreview, currentProjectId, projectName);
    if (result.success && result.url) {
      toast("success", "Site deployed! Opening in new tab...");
      window.open(result.url, "_blank");
    } else if (result.error) {
      toast("error", result.error);
    }
  }, [preview.currentPreview, currentProjectId, projectName, deploy, toast]);

  const handleShare = useCallback(async () => {
    if (!currentProjectId) return;
    setIsSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: currentProjectId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setShareUrl(data.url);
        navigator.clipboard.writeText(data.url).catch(() => {});
        toast("success", "Link copied to clipboard!");
      } else {
        toast("error", data.error || "Failed to share");
      }
    } catch {
      toast("error", "Failed to share project");
    } finally {
      setIsSharing(false);
    }
  }, [currentProjectId, toast]);

  const handleUnshare = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const res = await fetch("/api/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: currentProjectId }),
      });
      if (res.ok) {
        setShareUrl(null);
        toast("success", "Project unshared");
      } else {
        toast("error", "Failed to unshare");
      }
    } catch {
      toast("error", "Failed to unshare project");
    }
  }, [currentProjectId, toast]);

  const handleNewProject = useCallback(() => {
    chat.resetChat();
    preview.resetPreview();
    images.setUploadedImages([]);
    welcome.resetWelcome();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingProjectIdRef.current = null;
    pendingSaveRef.current = null;
    setCurrentProjectId(null);
    setProjectName("Untitled");
    setProjectContext(undefined);
    setShareUrl(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- depending on stable hook functions
  }, [chat.resetChat, preview.resetPreview, images.setUploadedImages, welcome.resetWelcome]);

  // Reset to welcome screen when user signs out
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user && chat.hasStarted) {
      handleNewProject();
      window.history.replaceState({}, "", "/");
    }
    prevUserRef.current = user;
  }, [user, chat.hasStarted, handleNewProject]);

  const handleLoadProject = useCallback(async (id: string) => {
    setIsLoadingProject(true);
    const proj = await loadProject(id);
    setIsLoadingProject(false);
    if (!proj) return;
    chat.abortRef.current?.abort();
    chat.setMessages(proj.messages);
    chat.setHasStarted(true);
    chat.setIsOnCall(false);
    preview.setCurrentPreview(proj.currentPreview);
    preview.setPreviewHistory(proj.previewHistory);
    preview.setRedoHistory([]);
    preview.setSelectMode(false);
    preview.setSelectedElement(null);
    preview.setBookmarks(proj.bookmarks || []);
    images.setUploadedImages([]);
    setCurrentProjectId(proj.id);
    setProjectName(proj.name);
    setProjectContext(proj.context);
    setShareUrl(null);
    // Fetch share state for cloud projects
    if (isCloud) {
      fetch(`/api/share?projectId=${encodeURIComponent(proj.id)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.url) setShareUrl(data.url); })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- depending on stable hook functions
  }, [loadProject, chat.abortRef, chat.setMessages, chat.setHasStarted, chat.setIsOnCall, preview.setCurrentPreview, preview.setPreviewHistory, preview.setRedoHistory, preview.setSelectMode, preview.setSelectedElement, preview.setBookmarks, images.setUploadedImages, isCloud]);

  const handleDeleteProject = useCallback(async (id: string) => {
    await deleteProject(id);
    const updatedList = await listProjects();
    setSavedProjects(updatedList);
    if (id === currentProjectId) {
      handleNewProject();
    }
  }, [currentProjectId, handleNewProject, deleteProject, listProjects]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    if (!chat.hasStarted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (chat.isGenerating) {
          chat.handleStop();
        }
        setShowShortcuts(false);
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.code === "KeyN" && !e.shiftKey) {
        e.preventDefault();
        handleNewProject();
      } else if (e.code === "KeyE" && !e.shiftKey) {
        e.preventDefault();
        preview.handleExport();
      } else if (e.code === "KeyC" && e.shiftKey) {
        e.preventDefault();
        preview.handleCopyToClipboard();
      } else if (e.code === "KeyZ" && !e.shiftKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        preview.handleUndo();
      } else if (e.code === "KeyZ" && e.shiftKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        preview.handleRedo();
      } else if (e.key === "/" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-code-view"));
      } else if (e.code === "KeyK") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-chat-input"));
      } else if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- depending on stable hook functions
  }, [chat.hasStarted, chat.isGenerating, chat.handleStop, handleNewProject, preview.handleExport, preview.handleCopyToClipboard, preview.handleUndo, preview.handleRedo]);

  // ─── Welcome screen ───
  if (!chat.hasStarted) {
    return (
      <main id="main-content" className="h-screen welcome-bg flex flex-col" onDrop={welcome.handleWelcomeDrop} onDragOver={(e) => e.preventDefault()}>
        <header className="relative z-20 h-14 md:h-[60px] flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-8">
            <Image src="/logo.png" alt="16s logo" width={28} height={28} className="object-contain" />
            <nav className="flex items-center gap-0.5 md:gap-1">
              <span className="px-2.5 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-100 bg-white/[0.06] rounded-lg">
                Home
              </span>
              <Link
                href="/projects"
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">My Projects</span>
                <span className="sm:hidden">Projects</span>
              </Link>
            </nav>
          </div>
          {user ? (
            <UserMenu />
          ) : isConfigured ? (
            <button
              onClick={() => {
                chat.setAuthModalMessage(null);
                chat.setShowAuthModal(true);
              }}
              className="px-4 py-2 text-[13px] font-medium text-zinc-900 bg-white rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Sign up
            </button>
          ) : (
            <UserMenu />
          )}
        </header>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center gap-8 w-full max-w-[640px]"
          >
            <div className="flex flex-col items-center gap-3">
              <Image src="/logo.png" alt="" width={48} height={48} className="object-contain" />
              <h1 className="text-[40px] md:text-[48px] font-semibold text-white tracking-[-0.04em] text-center leading-[1.1]">
                {welcome.headline}
              </h1>
              <p className="text-[14px] md:text-[15px] text-zinc-500 font-medium tracking-wide">
                Describe it. We build it. In seconds.
              </p>
            </div>

            {/* Error toast */}
            <AnimatePresence>
              {welcome.welcomeError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  role="alert"
                  className="w-full glass rounded-xl px-4 py-3 border border-red-500/20"
                >
                  <p className="text-[13px] text-red-400 text-center">{welcome.welcomeError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="w-full glass-input-glow rounded-2xl">
              {images.uploadedImages.length > 0 && (
                <div className="flex gap-2 flex-wrap px-4 pt-4">
                  {images.uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.data} alt={`Upload ${idx + 1}`} className="h-14 w-14 object-cover rounded-lg ring-1 ring-white/[0.06]" />
                      <button
                        onClick={() => images.handleImageTypeToggle(idx)}
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-medium rounded cursor-pointer hover:opacity-80 transition-opacity ${
                          img.type === "content" ? "bg-green-500/80 text-white" : "bg-zinc-700 text-zinc-300"
                        }`}
                        title="Click to toggle: inspo (design reference) / content (use in website)"
                        aria-label={`Toggle image ${idx + 1} type: currently ${img.type === "content" ? "content" : "inspiration"}`}
                      >
                        {img.type === "content" ? (img.label || "content") : "inspo"}
                      </button>
                      <button
                        onClick={() => images.handleImageRemove(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ring-1 ring-white/[0.06]"
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        <X className="w-3 h-3 text-zinc-300" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => welcome.welcomeFileRef.current?.click()}
                    className="h-14 w-14 rounded-lg glass glass-hover flex items-center justify-center transition-all duration-200"
                    aria-label="Add more images"
                  >
                    <ImagePlus className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 px-5 py-4">
                <textarea
                  ref={welcome.welcomeTextareaRef}
                  value={welcome.welcomeInput}
                  onChange={(e) => {
                    welcome.setWelcomeInput(e.target.value);
                    const el = welcome.welcomeTextareaRef.current;
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 160) + "px";
                    }
                  }}
                  onKeyDown={welcome.handleWelcomeKeyDown}
                  onPaste={welcome.handleWelcomePaste}
                  placeholder="A minimalist portfolio for a photographer in Brooklyn..."
                  disabled={chat.isGenerating}
                  aria-label="Message input"
                  id="welcome-input"
                  name="welcome-input"
                  autoFocus
                  autoComplete="off"
                  rows={1}
                  className="flex-1 bg-transparent text-[16px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-40 resize-none overflow-y-auto leading-relaxed"
                  style={{ maxHeight: 160 }}
                />
                <button
                  onClick={welcome.handleWelcomeSend}
                  disabled={(!welcome.welcomeInput.trim() && images.uploadedImages.length === 0) || chat.isGenerating}
                  className="p-3 bg-green-500/60 hover:bg-green-400/70 disabled:bg-zinc-800/60 disabled:cursor-not-allowed rounded-full transition-all duration-200 flex-shrink-0 glow-green-strong disabled:shadow-none"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="flex items-center gap-1 px-5 pb-3">
                <button
                  onClick={() => welcome.welcomeFileRef.current?.click()}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors"
                  title="Upload images"
                  aria-label="Upload images"
                >
                  <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
                </button>
                <input
                  ref={welcome.welcomeFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={welcome.handleWelcomeFileUpload}
                  className="hidden"
                  aria-hidden="true"
                  id="welcome-file-upload"
                  name="welcome-file-upload"
                />
              </div>
            </div>

            {/* Scrolling idea suggestions marquee */}
            {welcome.randomIdeas.length > 0 && (
              <div
                data-onboarding="pills"
                className="w-full max-w-[90vw] md:max-w-[700px] overflow-hidden"
                style={{
                  maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                  WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                }}
              >
                <motion.div
                  className="flex gap-4 py-2"
                  animate={{ x: [0, "-50%"] }}
                  transition={{
                    x: {
                      duration: 18,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                >
                  {[...welcome.randomIdeas, ...welcome.randomIdeas].map((idea, idx) => (
                    <button
                      key={idx}
                      onClick={() => chat.handleSendMessage(idea)}
                      disabled={chat.isGenerating}
                      className="flex-shrink-0 px-5 py-2.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] glass-pill disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors duration-200 whitespace-nowrap"
                    >
                      {idea}
                    </button>
                  ))}
                </motion.div>
              </div>
            )}
          </motion.div>

        </div>

        <OnboardingTooltip />

        <AuthModal
          isOpen={chat.showAuthModal}
          onClose={() => {
            chat.setShowAuthModal(false);
            chat.setAuthModalMessage(null);
          }}
          title={chat.authModalMessage?.title}
          subtitle={chat.authModalMessage?.subtitle}
        />
      </main>
    );
  }

  // ─── Chat + Preview split layout ───
  return (
    <>
      <MigrationBanner status={migrationStatus} count={migratedCount} />
      {/* Project loading overlay */}
      <AnimatePresence>
        {isLoadingProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
          >
            <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        <motion.div
          id="main-content"
          className="flex flex-col md:flex-row h-screen overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <nav className={`md:w-1/3 md:min-w-[360px] md:max-w-[480px] ${mobileView === "chat" ? "flex-1" : "hidden"} md:block`} aria-label="Chat">
          <ErrorBoundary fallbackLabel="Chat panel crashed">
          <ChatPanel
            messages={chat.messages}
            onSend={chat.handleSendMessage}
            onPillClick={chat.handlePillClick}
            onImageUpload={images.handleImageUpload}
            onImageRemove={images.handleImageRemove}
            onImageTypeToggle={images.handleImageTypeToggle}
            onImageUpdate={images.handleImageUpdate}
            isGenerating={chat.isGenerating}
            onStop={chat.handleStop}
            uploadedImages={images.uploadedImages}
            onNewProject={handleNewProject}
            isOnCall={chat.isOnCall}
            onStartCall={chat.handleStartCall}
            hasPreview={!!preview.currentPreview}
            selectedElement={preview.selectedElement}
            onClearSelection={preview.handleClearSelection}
            onEditMessage={chat.handleEditMessage}
            saveStatus={saveStatus}
            discussionMode={chat.discussionMode}
            onToggleDiscussionMode={() => chat.setDiscussionMode(prev => !prev)}
          />
          </ErrorBoundary>
        </nav>
        <main className={`flex-1 relative ${mobileView === "preview" ? "block" : "hidden"} md:block`} aria-label="Preview">
          <ErrorBoundary fallbackLabel="Preview panel crashed">
          <PreviewPanel
            html={preview.currentPreview}
            viewport={preview.viewport}
            onViewportChange={preview.setViewport}
            isGenerating={chat.isGenerating}
            canGoBack={preview.previewHistory.length > 0}
            canRedo={preview.redoHistory.length > 0}
            onBack={preview.handleUndo}
            onRedo={preview.handleRedo}
            onExport={preview.handleExport}
            onExportZip={preview.handleExportZip}
            onCopyToClipboard={preview.handleCopyToClipboard}
            onOpenInNewTab={preview.handleOpenInNewTab}
            onIframeLoad={preview.handleIframeLoad}
            previewHistory={preview.previewHistory}
            onRestoreVersion={preview.handleRestoreVersion}
            selectMode={preview.selectMode}
            onSelectModeChange={preview.setSelectMode}
            selectedElement={preview.selectedElement}
            onElementSelect={preview.setSelectedElement}
            bookmarks={preview.bookmarks}
            onAddBookmark={preview.handleAddBookmark}
            onRemoveBookmark={preview.handleRemoveBookmark}
            onRestoreBookmark={preview.handleRestoreBookmark}
            onDeploy={handleDeploy}
            isDeploying={isDeploying}
            lastDeployUrl={lastDeployment?.url}
            deployError={lastDeployment?.success === false ? lastDeployment.error : null}
            onCodeChange={preview.handleCodeChange}
            codeMode={preview.codeMode}
            onCodeModeChange={preview.setCodeMode}
            onShare={handleShare}
            onUnshare={handleUnshare}
            isSharing={isSharing}
            shareUrl={shareUrl}
            projectId={currentProjectId}
            onRevertToDeployment={(html) => {
              preview.pushPreview(html);
              toast("success", "Reverted to previous deployment");
            }}
            onPublish={handleDeploy}
          />
          </ErrorBoundary>
          {/* Voice call widget */}
          <AnimatePresence>
            {chat.isOnCall && (
              <div className="absolute top-14 right-4 z-30">
                <VoiceCall
                  ref={chat.voiceCallRef}
                  onCallComplete={chat.handleCallComplete}
                  onHangUp={() => chat.setIsOnCall(false)}
                />
              </div>
            )}
          </AnimatePresence>
        </main>

          {/* Mobile tab bar */}
          <div className="md:hidden flex-shrink-0 h-12 border-t border-white/[0.06] bg-[#0a0a0b] flex">
            <button
              onClick={() => setMobileView("chat")}
              className={`flex-1 flex items-center justify-center gap-2 text-[13px] font-medium transition-colors ${
                mobileView === "chat" ? "text-green-400" : "text-zinc-500"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setMobileView("preview")}
              className={`flex-1 flex items-center justify-center gap-2 text-[13px] font-medium transition-colors ${
                mobileView === "preview" ? "text-green-400" : "text-zinc-500"
              }`}
            >
              <Monitor className="w-4 h-4" />
              Preview
            </button>
          </div>
      </motion.div>
    </AnimatePresence>

    {/* Keyboard shortcuts overlay */}
    <AnimatePresence>
      {showShortcuts && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-zinc-900 border border-white/[0.08] rounded-xl p-6 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-zinc-200 mb-4">Keyboard Shortcuts</h2>
            <div className="space-y-2.5 text-[13px]">
              {[
                ["Cmd+N", "New project"],
                ["Cmd+E", "Export HTML"],
                ["Cmd+Shift+C", "Copy to clipboard"],
                ["Cmd+Z", "Undo"],
                ["Cmd+Shift+Z", "Redo"],
                ["Cmd+/", "Toggle code view"],
                ["Cmd+K", "Focus chat input"],
                ["Esc", "Stop generating"],
                ["Cmd+?", "This help"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-zinc-400">{desc}</span>
                  <kbd className="px-2 py-0.5 text-[11px] font-mono bg-white/[0.06] border border-white/[0.08] rounded text-zinc-300">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600 mt-4 text-center">Press Esc or click outside to close</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-screen welcome-bg flex flex-col">
      <header className="h-14 md:h-[60px] flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="w-16 h-7 rounded-lg bg-white/[0.06] animate-pulse" />
        </div>
        <div className="w-16 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
      </header>
      <div className="flex-1 flex flex-col items-center justify-center -mt-16 gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/[0.06] animate-pulse" />
          <div className="w-72 h-10 rounded-lg bg-white/[0.06] animate-pulse" />
        </div>
        <div className="w-full max-w-[640px] h-16 rounded-2xl bg-white/[0.04] animate-pulse mx-6" />
        <div className="flex gap-4">
          <div className="w-48 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="w-56 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="w-44 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
