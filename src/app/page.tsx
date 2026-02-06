"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import html2canvas from "html2canvas";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, ImagePlus, X, FolderOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { VoiceCall, VoiceCallHandle } from "@/components/chat/VoiceCall";
import { processImageFiles, compressForContent, uploadToBlob } from "@/lib/images";
import { useProjects } from "@/lib/hooks/useProjects";
import { useDeployment } from "@/lib/hooks/useDeployment";
import { MigrationBanner } from "@/components/auth/MigrationBanner";
import { UserMenu } from "@/components/auth/UserMenu";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Message, Viewport, SavedProjectMeta, SelectedElement, VersionBookmark, UploadedImage, CodeMode, ProjectContext, BMadPlan, BMadQAReport } from "@/lib/types";

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

// Large pool of random buildable website ideas
const IDEA_POOL = [
  "A minimalist portfolio for a photographer with a masonry gallery",
  "A coffee shop website with menu, locations, and online ordering",
  "A personal blog with dark mode and reading time estimates",
  "A SaaS landing page with pricing tiers and feature comparison",
  "A fitness studio site with class schedules and trainer bios",
  "A podcast website with episode player and show notes",
  "A recipe collection site with search and dietary filters",
  "A music artist page with discography and tour dates",
  "A real estate listing site with property cards and filters",
  "A freelancer portfolio with case studies and testimonials",
  "A bookstore website with featured reads and wishlists",
  "A travel blog with destination guides and photo galleries",
  "A startup landing page with waitlist signup",
  "A wedding website with RSVP form and photo timeline",
  "A vinyl record shop with collection browser",
  "A yoga studio site with booking calendar",
  "A tech conference website with speakers and schedule",
  "A pet adoption site with animal profiles",
  "A cocktail recipe app with ingredient search",
  "A movie review site with ratings and watchlists",
  "A coworking space website with amenities and pricing",
  "A bakery site with custom cake order form",
  "A newsletter landing page with archive access",
  "A tattoo artist portfolio with booking integration",
  "A plant shop with care guides for each species",
  "A language learning app dashboard",
  "A vintage clothing store with era filters",
  "A game studio website with trailer embeds",
  "A charity organization site with donation goals",
  "A barber shop with appointment booking",
  "An architecture firm portfolio with project galleries",
  "A meal prep service with weekly menu preview",
  "A car dealership site with inventory and financing",
  "A meditation app landing page with audio previews",
  "A sneaker resale marketplace layout",
  "A film production company portfolio",
  "A local newspaper homepage with sections",
  "A wine subscription service landing page",
  "A coding bootcamp site with curriculum preview",
  "A therapist practice website with booking",
  "A ceramics studio with workshop calendar",
  "A food truck finder with map and menus",
  "A digital agency site with services and work samples",
  "A museum website with exhibits and ticket booking",
  "A cryptocurrency dashboard interface",
  "A fashion brand lookbook with seasonal collections",
  "A home renovation portfolio with before/after sliders",
  "A DJ booking site with mixes and availability",
  "A book club platform with reading lists",
  "A sports team fan site with stats and news",
];

// Shuffle and pick n random items
function getRandomIdeas(count: number): string[] {
  const shuffled = [...IDEA_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateId(): string {
  // Use crypto.randomUUID for proper UUID format (required by Supabase)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers - generate UUID v4 format
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface ChatAPIResponse {
  message?: string;
  pills?: string[];
  showUpload?: boolean | string;
  html?: string;
  react?: string;
  plan?: BMadPlan;
  qaReport?: BMadQAReport;
  context?: ProjectContext;
  error?: string;
}

async function fetchAndParseChat(response: Response): Promise<ChatAPIResponse> {
  if (!response.ok) {
    let errorMsg = "Let me try that again...";
    try {
      const errorData = await response.json();
      if (errorData.message) errorMsg = errorData.message;
      else if (errorData.error) errorMsg = errorData.error;
    } catch {
      if (response.status === 413) errorMsg = "Request too large. Try with fewer or smaller images.";
      else if (response.status === 429) errorMsg = "Too many requests. Please wait a moment.";
      else if (response.status === 503) errorMsg = "The AI is busy right now. Please try again.";
      else if (response.status === 504) errorMsg = "Request timed out. Please try again.";
    }
    throw new Error(errorMsg);
  }

  const responseText = await response.text();
  const lines = responseText.trim().split("\n").filter((l) => l.trim());
  const lastLine = lines[lines.length - 1];

  let data: ChatAPIResponse | undefined;

  // Strategy 1: Try parsing the last line directly (most common case)
  if (lastLine && lastLine !== "undefined" && lastLine.startsWith("{")) {
    try {
      data = JSON.parse(lastLine);
    } catch { /* continue */ }
  }

  // Strategy 2: Handle markdown-wrapped JSON (```json...```)
  if (!data) {
    const jsonMatch = responseText.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
    if (jsonMatch) {
      try {
        data = JSON.parse(jsonMatch[1].trim());
      } catch { /* continue */ }
    }
  }

  // Strategy 3: Find the last complete JSON object in the response
  if (!data) {
    const jsonStart = responseText.lastIndexOf("\n{");
    if (jsonStart !== -1) {
      const jsonCandidate = responseText.slice(jsonStart + 1).trim();
      try {
        data = JSON.parse(jsonCandidate);
      } catch { /* continue */ }
    }
  }

  // Strategy 4: Find JSON with "message" field
  if (!data) {
    const msgIndex = responseText.lastIndexOf('{"message"');
    if (msgIndex !== -1) {
      const jsonCandidate = responseText.slice(msgIndex);
      try {
        data = JSON.parse(jsonCandidate);
      } catch {
        let depth = 0;
        let endIndex = -1;
        for (let i = 0; i < jsonCandidate.length; i++) {
          if (jsonCandidate[i] === "{") depth++;
          else if (jsonCandidate[i] === "}") {
            depth--;
            if (depth === 0) { endIndex = i + 1; break; }
          }
        }
        if (endIndex > 0) {
          try { data = JSON.parse(jsonCandidate.slice(0, endIndex)); } catch { /* continue */ }
        }
      }
    }
  }

  // Strategy 5: Extract any JSON object from the response
  if (!data) {
    const objMatch = responseText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        data = JSON.parse(objMatch[0]);
      } catch { /* continue */ }
    }
  }

  // Strategy 6: Use raw text as message if available, else show error
  if (!data) {
    console.debug("Failed to parse API response");
    const rawText = responseText.trim();
    data = { message: rawText || "Let me try that again..." };
  }

  if (data.error) {
    throw new Error(String(data.error));
  }

  return data;
}

function HomePageContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isOnCall, setIsOnCall] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [bookmarks, setBookmarks] = useState<VersionBookmark[]>([]);
  const [codeMode, setCodeMode] = useState<CodeMode>("html");
  const [outputFormat, setOutputFormat] = useState<"html" | "react">("html");
  const [reactCode, setReactCode] = useState<string | null>(null);

  // Project state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled");
  const [savedProjects, setSavedProjects] = useState<SavedProjectMeta[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext | undefined>(undefined);

  // Cloud-aware projects API
  const { save: saveProject, load: loadProject, list: listProjects, remove: deleteProject, isCloud, isAuthLoading, migrationStatus, migratedCount } = useProjects();
  const { user, isConfigured } = useAuth();
  const { deploy, isDeploying, lastDeployment } = useDeployment();
  const searchParams = useSearchParams();

  // Randomized on client only to avoid hydration mismatch
  const [headline, setHeadline] = useState(HEADLINES[0]);
  const [randomIdeas, setRandomIdeas] = useState<string[]>([]);
  useEffect(() => {
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
    // Get more ideas for the marquee
    setRandomIdeas(getRandomIdeas(8));
  }, []);

  const [welcomeInput, setWelcomeInput] = useState("");
  const [welcomeError, setWelcomeError] = useState<string | null>(null);

  // Check for auth errors in URL and display them
  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      const errorMessage = decodeURIComponent(authError);
      console.debug("[Auth] Error from callback:", errorMessage);
      setWelcomeError(`Sign in failed: ${errorMessage}`);
      // Clear the error from URL
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  // Auth state for new user flow
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<{ text: string; images?: UploadedImage[] } | null>(null);
  const [authModalMessage, setAuthModalMessage] = useState<{ title?: string; subtitle?: string } | null>(null);

  // Ref to store the send function for use in auth callback
  const sendMessageRef = useRef<((text: string, images?: UploadedImage[]) => void) | null>(null);

  // When user logs in after submitting a pending prompt, send it
  const pendingPromptRef = useRef(pendingPrompt);
  useEffect(() => { pendingPromptRef.current = pendingPrompt; }, [pendingPrompt]);

  useEffect(() => {
    if (user && pendingPromptRef.current && sendMessageRef.current) {
      const { text, images } = pendingPromptRef.current;
      setPendingPrompt(null);
      setShowAuthModal(false);
      // Small delay to ensure auth state is fully propagated
      setTimeout(() => {
        sendMessageRef.current?.(text, images);
      }, 100);
    }
  }, [user]);

  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeFileRef = useRef<HTMLInputElement>(null);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceCallRef = useRef<VoiceCallHandle>(null);

  // Load saved projects list on mount and when auth changes
  useEffect(() => {
    if (isAuthLoading) return;
    const loadProjectsList = async () => {
      const projects = await listProjects();
      setSavedProjects(projects);
    };
    loadProjectsList();
  }, [isAuthLoading, listProjects, isCloud]);

  // Auto-restore last project on mount or load from URL param
  useEffect(() => {
    if (isAuthLoading) return;
    const projectIdFromUrl = searchParams.get("project");

    const restoreProject = async () => {
      // If URL has project param, load that specific project
      if (projectIdFromUrl) {
        const proj = await loadProject(projectIdFromUrl);
        if (proj) {
          setCurrentProjectId(proj.id);
          setProjectName(proj.name);
          setMessages(proj.messages);
          setCurrentPreview(proj.currentPreview);
          setPreviewHistory(proj.previewHistory);
          setBookmarks(proj.bookmarks || []);
          setProjectContext(proj.context);
          setHasStarted(true);
          // Clear the URL param
          window.history.replaceState({}, "", "/");
          return;
        }
      }

      // Otherwise, restore last project
      const projects = await listProjects();
      if (projects.length > 0) {
        const last = await loadProject(projects[0].id);
        if (last && last.messages.length > 0) {
          setCurrentProjectId(last.id);
          setProjectName(last.name);
          setMessages(last.messages);
          setCurrentPreview(last.currentPreview);
          setPreviewHistory(last.previewHistory);
          setBookmarks(last.bookmarks || []);
          setProjectContext(last.context);
          setHasStarted(true);
        }
      }
    };
    restoreProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, searchParams]);

  // Auto-save project (debounced) - saves immediately when project starts
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  const pendingProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Save as soon as project starts (hasStarted), don't wait for messages
    if (!hasStarted || isAuthLoading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Create the save function so we can call it immediately on page leave
    const doSave = async () => {
      try {
        // Use existing ID, pending ID, or generate new one
        const id = currentProjectId || pendingProjectIdRef.current || generateId();
        if (!currentProjectId) {
          pendingProjectIdRef.current = id;
          setCurrentProjectId(id);
        }

        // Generate name from first user message, or use "Untitled" / "New Project"
        let name = projectName;
        if (projectName === "Untitled" && messages.length > 0) {
          const firstUserMsg = messages.find((m) => m.role === "user");
          name = firstUserMsg?.content.slice(0, 40) || "New Project";
        } else if (projectName === "Untitled" && messages.length === 0) {
          name = "New Project";
        }
        if (name !== projectName) setProjectName(name);

        await saveProject({
          id,
          name,
          messages,
          currentPreview,
          previewHistory,
          bookmarks,
          context: projectContext,
          updatedAt: Date.now(),
        });
        const updatedList = await listProjects();
        setSavedProjects(updatedList);
        pendingSaveRef.current = null;
        pendingProjectIdRef.current = null;
      } catch (error) {
        console.debug("[AutoSave] Failed to save project:", error);
        // Don't clear pendingSaveRef so it can retry
      }
    };

    pendingSaveRef.current = doSave;
    // Save immediately when project first starts, debounce subsequent saves
    const delay = currentProjectId ? 1000 : 0;
    saveTimerRef.current = setTimeout(doSave, delay);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [messages, currentPreview, previewHistory, bookmarks, hasStarted, currentProjectId, projectName, projectContext, saveProject, listProjects, isAuthLoading, isCloud]);

  // Save immediately when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        // Use sendBeacon for reliable save on page unload
        const id = currentProjectId || generateId();
        let name = projectName;
        if (projectName === "Untitled" && messages.length > 0) {
          const firstUserMsg = messages.find((m) => m.role === "user");
          name = firstUserMsg?.content.slice(0, 40) || "New Project";
        } else if (projectName === "Untitled") {
          name = "New Project";
        }
        const project = {
          id,
          name,
          messages,
          currentPreview,
          previewHistory,
          bookmarks,
          context: projectContext,
          updatedAt: Date.now(),
        };
        // Save to localStorage as backup (works synchronously)
        try {
          const key = `16s_projects`;
          const existing = JSON.parse(localStorage.getItem(key) || "[]");
          const idx = existing.findIndex((p: { id: string }) => p.id === id);
          if (idx >= 0) existing[idx] = project;
          else existing.unshift(project);
          localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
        } catch (e) {
          console.debug("[Save] Failed to save on unload:", e);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentProjectId, projectName, messages, currentPreview, previewHistory, bookmarks, projectContext]);

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
        // Try clean CORS mode first (exportable canvas, but may miss cross-origin images)
        canvas = await html2canvas(doc.body, { ...opts, useCORS: true, allowTaint: false });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        setPreviewScreenshot(dataUrl);
      } catch {
        // Fallback: allow tainted canvas (renders all images, but toDataURL may fail)
        canvas = await html2canvas(doc.body, { ...opts, allowTaint: true });
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
          setPreviewScreenshot(dataUrl);
        } catch {
          // Tainted canvas can't export — screenshot is optional, continue without
          console.debug("Screenshot skipped: tainted canvas");
        }
      }
    } catch {
      // html2canvas itself failed — screenshot is optional context
      console.debug("Screenshot capture failed");
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

  // Helper function to replace image placeholders in HTML
  const replaceImagePlaceholders = useCallback((html: string, currentImages?: UploadedImage[]): string => {
    // Collect ALL images from the conversation history AND current message
    // We collect both content AND inspo images because users often want inspo images embedded too
    const allContentImages: UploadedImage[] = [];
    const allInspoImages: UploadedImage[] = [];

    // Add images from conversation history
    for (const msg of messagesRef.current) {
      if (msg.uploadedImages) {
        for (const img of msg.uploadedImages) {
          if (img.type === "content") {
            allContentImages.push(img);
          } else {
            allInspoImages.push(img);
          }
        }
      }
    }

    // Add current images that might not be in messagesRef yet
    if (currentImages) {
      for (const img of currentImages) {
        if (img.type === "content" && !allContentImages.some(existing => existing.data === img.data)) {
          allContentImages.push(img);
        } else if (img.type === "inspo" && !allInspoImages.some(existing => existing.data === img.data)) {
          allInspoImages.push(img);
        }
      }
    }

    // If no content images but we have inspo images, use inspo as fallback
    // This handles the common case where user uploads an image tagged as inspo
    // but actually wants it embedded in the website
    const imagesToUse = allContentImages.length > 0 ? allContentImages : allInspoImages;

    let result = html;

    // Step 1: Replace {{CONTENT_IMAGE_N}} placeholders with image data
    const placeholderRegex = /\{\{\s*CONTENT_IMAGE_(\d+)\s*\}\}/g;

    result = result.replace(placeholderRegex, (_match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (imagesToUse[index]) {
        return imagesToUse[index].url || imagesToUse[index].data;
      } else if (imagesToUse.length > 0) {
        return imagesToUse[0].url || imagesToUse[0].data;
      } else {
        return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      }
    });

    // Step 2: Validate blob URLs - replace any unrecognized blob URLs
    const blobUrlRegex = /src="(https:\/\/[^"]*\.public\.blob\.vercel-storage\.com\/[^"]*)"/g;
    const validUrls = imagesToUse.map(img => img.url).filter(Boolean);

    result = result.replace(blobUrlRegex, (match, url) => {
      if (validUrls.includes(url)) return match;
      if (imagesToUse.length > 0) {
        return `src="${imagesToUse[0].url || imagesToUse[0].data}"`;
      }
      return 'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"';
    });

    // Step 3: Replace AI-generated base64 (gibberish) with real images
    if (imagesToUse.length > 0) {
      const aiBase64Regex = /src="(data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,})"/g;
      const validBase64s = imagesToUse.map(img => img.data);

      result = result.replace(aiBase64Regex, (match, base64) => {
        if (validBase64s.includes(base64)) return match;
        return `src="${imagesToUse[0].url || imagesToUse[0].data}"`;
      });
    }

    return result;
  }, []);

  // [Ralph R2] Shared helper to build clean messages array for API
  const buildCleanMessages = useCallback((msgs: Message[], extra: Partial<Message>[]) => {
    return [...msgs, ...extra]
      .map(({ images, pills, showUpload, ...rest }) => rest)
      .filter(msg => msg.id && msg.role && typeof msg.content === "string")
      .map(msg => ({
        ...msg,
        id: msg.id || `msg-${Date.now()}`,
        content: msg.content || (msg.role === "user" ? "[Empty]" : "..."),
      }));
  }, []);

  // [Ralph R2] Shared helper: send to API, parse response, update preview state
  const sendAndProcessChat = useCallback(async (
    cleanMessages: Partial<Message>[],
    imagesToSend: UploadedImage[],
    userMessage: Message,
    controller: AbortController,
    onError?: () => void,
  ) => {
    const MAX_PREVIEW_FOR_API = 30_000;
    const previewForApi = currentPreview && currentPreview.length > MAX_PREVIEW_FOR_API
      ? currentPreview.substring(0, MAX_PREVIEW_FOR_API)
      : currentPreview;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: cleanMessages,
        uploadedImages: imagesToSend,
        currentPreview: previewForApi,
        previewScreenshot,
        outputFormat,
        context: projectContext,
      }),
      signal: controller.signal,
    });

    const data = await fetchAndParseChat(response);

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: data.message || "I'm working on your request...",
      pills: data.pills,
      showUpload: data.showUpload,
      plan: data.plan,
      qaReport: data.qaReport,
    };
    setMessages((prev) => [...prev, aiMessage]);

    if (data.html) {
      if (currentPreview) {
        setPreviewHistory((prev) => [...prev, currentPreview]);
      }
      setRedoHistory([]);
      const processedHtml = replaceImagePlaceholders(data.html, imagesToSend);
      const navGuard = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a){var h=a.getAttribute('href');if(h&&h.startsWith('http')){e.preventDefault();return;}if(h&&!h.startsWith('javascript:')){e.preventDefault();}}},true);</script>`;
      const safeHtml = processedHtml.replace(/<head([^>]*)>/i, `<head$1>${navGuard}`);
      setCurrentPreview(safeHtml);
      setReactCode(null);
    }

    if (data.react) {
      setReactCode(data.react);
    }

    // Save learned context (invisible memory) if AI returned it
    if (data.context) {
      setProjectContext((prev) => prev ? { ...prev, ...data.context } : data.context);
    }
  }, [currentPreview, previewScreenshot, outputFormat, projectContext, replaceImagePlaceholders]);

  const handleSendMessage = useCallback(async (text: string, imagesToInclude?: UploadedImage[]) => {
    // If auth is configured but user is not signed in, prompt them to sign up
    if (isConfigured && !user) {
      setPendingPrompt({ text, images: imagesToInclude || [...uploadedImages] });
      setAuthModalMessage({
        title: "Let's get you signed in",
        subtitle: "Before we bring your dream site to life, we need you to create an account or sign in."
      });
      setShowAuthModal(true);
      return;
    }

    // If on a call, route typed messages to the voice agent instead
    if (isOnCall && voiceCallRef.current) {
      voiceCallRef.current.injectTypedMessage(text);
      return; // Don't send to main chat
    }

    let imagesToSend = imagesToInclude || [...uploadedImages];
    const hadOwnImages = !imagesToInclude && uploadedImages.length > 0;
    if (!imagesToInclude) setUploadedImages([]);

    // Ensure all content images have blob URLs before sending
    const contentImagesNeedingUpload = imagesToSend.filter(img => img.type === "content" && !img.url);
    if (contentImagesNeedingUpload.length > 0) {
      const uploadPromises = contentImagesNeedingUpload.map(async (img) => {
        try {
          const url = await uploadToBlob(img.data, img.label);
          return { ...img, url };
        } catch (error) {
          console.debug("[Blob Upload] Failed:", error);
          return img; // Keep original without URL as fallback
        }
      });
      const uploadedResults = await Promise.all(uploadPromises);
      // Update imagesToSend with the uploaded URLs
      imagesToSend = imagesToSend.map(img => {
        if (img.type === "content" && !img.url) {
          const uploaded = uploadedResults.find(u => u.data === img.data);
          return uploaded || img;
        }
        return img;
      });
    }

    if (!hasStarted) setHasStarted(true);

    // Include selected element context in the message
    let messageText = text;
    if (selectedElement) {
      const elementDesc = `[User has selected a <${selectedElement.tagName}> element${selectedElement.id ? ` with id="${selectedElement.id}"` : ""}${selectedElement.className ? ` with class="${selectedElement.className}"` : ""}. Apply the following change to this specific element:]`;
      messageText = `${elementDesc}\n${text}`;
      // Clear selection after sending
      setSelectedElement(null);
      setSelectMode(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text, // Show original text to user
      uploadedImages: imagesToSend.length > 0 ? imagesToSend : undefined,
    };

    // Add user message optimistically
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Collect all content images from history that need URLs
      const historyImagesNeedingUpload: { msgIndex: number; imgIndex: number; img: UploadedImage }[] = [];
      messagesRef.current.forEach((msg, msgIndex) => {
        msg.uploadedImages?.forEach((img, imgIndex) => {
          if (img.type === "content" && !img.url) {
            historyImagesNeedingUpload.push({ msgIndex, imgIndex, img });
          }
        });
      });

      // Upload history images if needed
      if (historyImagesNeedingUpload.length > 0) {
        const uploadPromises = historyImagesNeedingUpload.map(async ({ img }) => {
          try {
            const url = await uploadToBlob(img.data, img.label);
            return { ...img, url };
          } catch (error) {
            console.debug("[Blob Upload] History upload failed:", error);
            return img;
          }
        });
        const uploadedHistoryImages = await Promise.all(uploadPromises);

        // Update messages with uploaded URLs
        setMessages((prev) =>
          prev.map((msg, msgIndex) => {
            const updates = historyImagesNeedingUpload.filter(h => h.msgIndex === msgIndex);
            if (updates.length === 0 || !msg.uploadedImages) return msg;
            return {
              ...msg,
              uploadedImages: msg.uploadedImages.map((img, imgIndex) => {
                const update = updates.find(u => u.imgIndex === imgIndex);
                if (update) {
                  const uploaded = uploadedHistoryImages.find(u => u.data === img.data);
                  return uploaded || img;
                }
                return img;
              }),
            };
          })
        );
      }

      // Use messageText (with element context) for API, not the displayed text
      const apiUserMessage = { ...userMessage, content: messageText };
      const cleanMessages = buildCleanMessages(messagesRef.current, [apiUserMessage]);

      await sendAndProcessChat(cleanMessages, imagesToSend, userMessage, controller, () => {
        if (hadOwnImages) setUploadedImages(imagesToSend);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.debug("Error sending message:", error);

      // Remove the failed user message to keep history clean
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));

      // Restore uploaded images so user doesn't lose them on error
      if (hadOwnImages) {
        setUploadedImages(imagesToSend);
      }

      // Show the actual error message
      const errorMsg = error instanceof Error ? error.message : "Let me try that again...";
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
  }, [isOnCall, uploadedImages, hasStarted, selectedElement, isConfigured, user, sendAndProcessChat, buildCleanMessages]);

  // Keep ref updated for auth callback
  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  const handlePillClick = (pill: string) => {
    if (isGenerating) return;
    const lowerPill = pill.toLowerCase();
    // Detect any call-related pill
    if (lowerPill.includes("call") || lowerPill.includes("phone") || lowerPill.includes("voice")) {
      setIsOnCall(true);
      return;
    }
    handleSendMessage(pill);
  };

  // Internal send that allows custom visible text vs actual API text
  const handleSendMessageInternal = useCallback(async (
    apiText: string,
    imagesToInclude?: UploadedImage[],
    visibleText?: string
  ) => {
    let imagesToSend = imagesToInclude || [...uploadedImages];
    if (!imagesToInclude) setUploadedImages([]);

    // Upload content images that don't have blob URLs yet
    const contentImagesNeedingUpload = imagesToSend.filter(img => img.type === "content" && !img.url);
    if (contentImagesNeedingUpload.length > 0) {
      const uploadPromises = contentImagesNeedingUpload.map(async (img) => {
        try {
          const url = await uploadToBlob(img.data, img.label);
          return { ...img, url };
        } catch {
          return img;
        }
      });
      const uploadedResults = await Promise.all(uploadPromises);
      imagesToSend = imagesToSend.map(img => {
        if (img.type === "content" && !img.url) {
          const uploaded = uploadedResults.find(u => u.data === img.data);
          return uploaded || img;
        }
        return img;
      });
    }

    if (!hasStarted) setHasStarted(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: visibleText || apiText,
      uploadedImages: imagesToSend.length > 0 ? imagesToSend : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiUserMessage = { ...userMessage, content: apiText };
      const cleanMessages = buildCleanMessages(messagesRef.current, [apiUserMessage]);
      await sendAndProcessChat(cleanMessages, imagesToSend, userMessage, controller);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.debug("Error sending message:", error);

      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));

      const errorMsg = error instanceof Error ? error.message : "Let me try that again...";
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
  }, [uploadedImages, hasStarted, sendAndProcessChat, buildCleanMessages]);

  const handleCallComplete = useCallback((visibleSummary: string, privateData: string) => {
    setIsOnCall(false);
    // Send the private data to the AI (not visible to user as their message)
    // but show a brief visible summary
    handleSendMessageInternal(privateData, undefined, visibleSummary);
  }, [handleSendMessageInternal]);

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    // Find the message index
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Get the message to edit
    const originalMessage = messages[messageIndex];
    if (originalMessage.role !== "user") return;

    // Truncate messages after this one (keep messages up to and including the edited one)
    const truncatedMessages = messages.slice(0, messageIndex);

    // Update messages state
    setMessages(truncatedMessages);

    // Find the preview state at this point - roll back preview history
    // Each user message after a preview change means we need to go back in history
    const messagesWithPreview = truncatedMessages.filter(
      (m) => m.role === "assistant"
    ).length;
    const historyTarget = Math.max(0, messagesWithPreview - 1);

    if (previewHistory.length > historyTarget) {
      const newHistory = previewHistory.slice(0, historyTarget);
      const restoredPreview = historyTarget > 0 ? previewHistory[historyTarget - 1] : null;
      setPreviewHistory(newHistory);
      setCurrentPreview(restoredPreview);
    }

    // Send the edited message
    handleSendMessage(newContent, originalMessage.uploadedImages);
  }, [messages, previewHistory, handleSendMessage]);

  const handleImageUpload = async (base64: string, type: "inspo" | "content" = "content", label?: string) => {
    // Add image immediately with base64 for preview
    const newImage: UploadedImage = { data: base64, type, label };
    setUploadedImages((prev) => [...prev, newImage]);

    // For content images, upload to Vercel Blob in background
    if (type === "content") {
      try {
        const url = await uploadToBlob(base64, label);
        // Update the image with the blob URL
        setUploadedImages((prev) =>
          prev.map((img) =>
            img.data === base64 && img.type === "content" ? { ...img, url } : img
          )
        );
      } catch {
        // Image still works with base64 fallback
      }
    }
  };

  const handleImageRemove = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageTypeToggle = async (index: number) => {
    const img = uploadedImages[index];
    if (!img) return;

    const newType = img.type === "inspo" ? "content" : "inspo";

    // If switching to content, re-compress and upload to blob
    if (newType === "content") {
      try {
        const compressed = await compressForContent(img.data);
        // Update type and compressed data first
        setUploadedImages((prev) =>
          prev.map((img, i) =>
            i === index ? { ...img, type: newType, data: compressed } : img
          )
        );
        // Then upload to blob
        const url = await uploadToBlob(compressed, img.label);
        setUploadedImages((prev) =>
          prev.map((img, i) =>
            i === index ? { ...img, url } : img
          )
        );
      } catch {
        // Fallback: just change type without re-compressing
        setUploadedImages((prev) =>
          prev.map((img, i) =>
            i === index ? { ...img, type: newType } : img
          )
        );
      }
    } else {
      // Switching to inspo - no re-compression needed, clear url
      setUploadedImages((prev) =>
        prev.map((img, i) =>
          i === index ? { ...img, type: newType, url: undefined } : img
        )
      );
    }
  };

  const handleImageUpdate = (index: number, newData: string) => {
    setUploadedImages((prev) =>
      prev.map((img, i) =>
        i === index ? { ...img, data: newData } : img
      )
    );
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

  const handleDeploy = useCallback(async () => {
    if (!currentPreview || !currentProjectId) return;
    const result = await deploy(currentPreview, currentProjectId, projectName);
    if (result.success && result.url) {
      // Open the deployed site in a new tab
      window.open(result.url, "_blank");
    }
  }, [currentPreview, currentProjectId, projectName, deploy]);

  const handleRestoreVersion = useCallback((index: number) => {
    if (currentPreview && previewHistory[index]) {
      // NON-DESTRUCTIVE restore: save current to history, then switch to selected version
      // This preserves ALL versions - nothing is ever deleted
      const selectedVersion = previewHistory[index];

      // Add current preview to history (it becomes a new version)
      // Keep all existing history intact
      setPreviewHistory((prev) => [...prev, currentPreview]);

      // Switch to the selected version
      setCurrentPreview(selectedVersion);

      // Clear redo since we're branching from a historical point
      setRedoHistory([]);
    }
  }, [currentPreview, previewHistory]);

  const handleNewProject = useCallback(() => {
    abortRef.current?.abort();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingProjectIdRef.current = null;
    pendingSaveRef.current = null;
    setMessages([]);
    setCurrentPreview(null);
    setPreviewHistory([]);
    setRedoHistory([]);
    setUploadedImages([]);
    setIsGenerating(false);
    setHasStarted(false);
    setWelcomeInput("");
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
    setIsOnCall(false);
    setPreviewScreenshot(null);
    setCurrentProjectId(null);
    setProjectName("Untitled");
    setSelectMode(false);
    setSelectedElement(null);
    setBookmarks([]);
    setCodeMode("html");
    setProjectContext(undefined);
  }, []);

  const handleLoadProject = useCallback(async (id: string) => {
    const proj = await loadProject(id);
    if (!proj) return;
    abortRef.current?.abort();
    setMessages(proj.messages);
    setCurrentPreview(proj.currentPreview);
    setPreviewHistory(proj.previewHistory);
    setRedoHistory([]);
    setUploadedImages([]);
    setIsGenerating(false);
    setHasStarted(true);
    setIsOnCall(false);
    setPreviewScreenshot(null);
    setCurrentProjectId(proj.id);
    setProjectName(proj.name);
    setSelectMode(false);
    setSelectedElement(null);
    setBookmarks(proj.bookmarks || []);
    setProjectContext(proj.context);
  }, [loadProject]);

  const handleDeleteProject = useCallback(async (id: string) => {
    await deleteProject(id);
    const updatedList = await listProjects();
    setSavedProjects(updatedList);
    if (id === currentProjectId) {
      handleNewProject();
    }
  }, [currentProjectId, handleNewProject, deleteProject, listProjects]);

  const handleAddBookmark = useCallback((name: string) => {
    const newBookmark: VersionBookmark = {
      id: generateId(),
      name,
      versionIndex: previewHistory.length, // Current version is at end of history
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [...prev, newBookmark]);
  }, [previewHistory.length]);

  const handleRemoveBookmark = useCallback((bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  }, []);

  const handleRestoreBookmark = useCallback((bookmark: VersionBookmark) => {
    if (bookmark.versionIndex === previewHistory.length) {
      // Already at current version
      return;
    }
    if (bookmark.versionIndex < previewHistory.length) {
      // Restore to a historical version
      handleRestoreVersion(bookmark.versionIndex);
    }
  }, [previewHistory.length, handleRestoreVersion]);

  // Handle code edits from the Monaco editor (debounced to avoid too many history entries)
  const codeEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCodeRef = useRef<string | null>(null);

  const handleCodeChange = useCallback((newCode: string) => {
    // Update preview immediately for live feedback
    setCurrentPreview(newCode);

    // Debounce history push - only create a history entry after 1s of no edits
    if (codeEditTimerRef.current) clearTimeout(codeEditTimerRef.current);

    codeEditTimerRef.current = setTimeout(() => {
      // Only push to history if this is the first edit or after a pause
      if (lastCodeRef.current && lastCodeRef.current !== newCode) {
        setPreviewHistory((prev) => {
          // Avoid duplicate entries
          if (prev[prev.length - 1] === lastCodeRef.current) return prev;
          return [...prev, lastCodeRef.current!];
        });
        setRedoHistory([]); // Clear redo on manual edit
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
        // Don't override native text undo in inputs/textareas
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        handleUndo();
      } else if (e.code === "KeyZ" && e.shiftKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
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
    if ((!welcomeInput.trim() && uploadedImages.length === 0) || isGenerating) return;
    const text = welcomeInput.trim() || "Here are my images.";
    const imgs = [...uploadedImages];
    setWelcomeInput("");
    setUploadedImages([]);
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
                setAuthModalMessage(null);
                setShowAuthModal(true);
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
            <div className="flex flex-col items-center gap-4">
              <Image src="/logo.png" alt="" width={48} height={48} className="object-contain" />
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
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 flex-wrap px-4 pt-4">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.data} alt={`Upload ${idx + 1}`} className="h-14 w-14 object-cover rounded-lg ring-1 ring-white/[0.06]" />
                      <button
                        onClick={() => handleImageTypeToggle(idx)}
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-medium rounded cursor-pointer hover:opacity-80 transition-opacity ${
                          img.type === "content" ? "bg-green-500/80 text-white" : "bg-zinc-700 text-zinc-300"
                        }`}
                        title="Click to toggle: inspo (design reference) / content (use in website)"
                        aria-label={`Toggle image ${idx + 1} type: currently ${img.type === "content" ? "content" : "inspiration"}`}
                      >
                        {img.type === "content" ? (img.label || "content") : "inspo"}
                      </button>
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
                  disabled={(!welcomeInput.trim() && uploadedImages.length === 0) || isGenerating}
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

            {/* Scrolling idea suggestions marquee */}
            {randomIdeas.length > 0 && (
              <div
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
                  {/* Duplicate ideas for seamless loop */}
                  {[...randomIdeas, ...randomIdeas].map((idea, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(idea)}
                      disabled={isGenerating}
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

        {/* Auth modal for new user sign-up flow */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setAuthModalMessage(null);
          }}
          title={authModalMessage?.title}
          subtitle={authModalMessage?.subtitle}
        />
      </div>
    );
  }

  // Chat + Preview split layout
  return (
    <>
      <MigrationBanner status={migrationStatus} count={migratedCount} />
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
            onImageTypeToggle={handleImageTypeToggle}
            onImageUpdate={handleImageUpdate}
            isGenerating={isGenerating}
            uploadedImages={uploadedImages}
            onNewProject={handleNewProject}
            isOnCall={isOnCall}
            onStartCall={() => setIsOnCall(true)}
            hasPreview={!!currentPreview}
            selectedElement={selectedElement}
            onClearSelection={() => { setSelectedElement(null); setSelectMode(false); }}
            onEditMessage={handleEditMessage}
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
            selectMode={selectMode}
            onSelectModeChange={setSelectMode}
            selectedElement={selectedElement}
            onElementSelect={setSelectedElement}
            bookmarks={bookmarks}
            onAddBookmark={handleAddBookmark}
            onRemoveBookmark={handleRemoveBookmark}
            onRestoreBookmark={handleRestoreBookmark}
            onDeploy={handleDeploy}
            isDeploying={isDeploying}
            lastDeployUrl={lastDeployment?.url}
            onCodeChange={handleCodeChange}
            codeMode={codeMode}
            onCodeModeChange={setCodeMode}
          />
          {/* Voice call widget — top-right of preview area */}
          <AnimatePresence>
            {isOnCall && (
              <div className="absolute top-14 right-4 z-30">
                <VoiceCall
                  ref={voiceCallRef}
                  onCallComplete={handleCallComplete}
                  onHangUp={() => setIsOnCall(false)}
                />
              </div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>
    </AnimatePresence>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-screen welcome-bg" />}>
      <HomePageContent />
    </Suspense>
  );
}
