"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { VoiceCall, VoiceCallHandle } from "@/components/chat/VoiceCall";
import { processImageFiles, compressForContent } from "@/lib/images";
import { saveProject, loadProject, listProjects, deleteProject } from "@/lib/projects";
import type { Message, Viewport, SavedProjectMeta, SelectedElement, VersionBookmark, UploadedImage } from "@/lib/types";

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
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isOnCall, setIsOnCall] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [bookmarks, setBookmarks] = useState<VersionBookmark[]>([]);

  // Project state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled");
  const [savedProjects, setSavedProjects] = useState<SavedProjectMeta[]>([]);

  // Randomized on each mount/reset
  const [welcomeKey, setWelcomeKey] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headline = useMemo(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)], [welcomeKey]);

  const [welcomeInput, setWelcomeInput] = useState("");
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeFileRef = useRef<HTMLInputElement>(null);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceCallRef = useRef<VoiceCallHandle>(null);

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
        setBookmarks(last.bookmarks || []);
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
        bookmarks,
        updatedAt: Date.now(),
      });
      setSavedProjects(listProjects());
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [messages, currentPreview, previewHistory, bookmarks, hasStarted, currentProjectId, projectName]);

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

  const handleSendMessage = useCallback(async (text: string, imagesToInclude?: UploadedImage[]) => {
    // If on a call, route typed messages to the voice agent instead
    if (isOnCall && voiceCallRef.current) {
      voiceCallRef.current.injectTypedMessage(text);
      return; // Don't send to main chat
    }

    const imagesToSend = imagesToInclude || [...uploadedImages];
    if (!imagesToInclude) setUploadedImages([]);

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
      // Use messageText (with element context) for API, not the displayed text
      const apiUserMessage = { ...userMessage, content: messageText };
      const cleanMessages = [...messagesRef.current, apiUserMessage].map(
        ({ images, pills, showUpload, ...rest }) => rest
      );

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: cleanMessages,
          uploadedImages: imagesToSend,
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
      const lastLine = lines[lines.length - 1];

      // Safely parse JSON with multiple fallback strategies
      let data;

      // Strategy 1: Try parsing the last line directly (most common case)
      if (lastLine && lastLine !== "undefined" && lastLine.startsWith("{")) {
        try {
          data = JSON.parse(lastLine);
        } catch {
          // Continue to fallback strategies
        }
      }

      // Strategy 2: Find the last complete JSON object in the response
      if (!data) {
        // Look for JSON that starts with { and ends with }
        const jsonStart = responseText.lastIndexOf("\n{");
        if (jsonStart !== -1) {
          const jsonCandidate = responseText.slice(jsonStart + 1).trim();
          try {
            data = JSON.parse(jsonCandidate);
          } catch {
            // Continue to next strategy
          }
        }
      }

      // Strategy 3: Try to find any JSON object with "message" field
      if (!data) {
        // Find the last occurrence of {"message" which is our response format
        const msgIndex = responseText.lastIndexOf('{"message"');
        if (msgIndex !== -1) {
          const jsonCandidate = responseText.slice(msgIndex);
          // Try to parse, handling potential trailing content
          try {
            data = JSON.parse(jsonCandidate);
          } catch {
            // Try to find where the JSON ends by counting braces
            let depth = 0;
            let endIndex = -1;
            for (let i = 0; i < jsonCandidate.length; i++) {
              const char = jsonCandidate[i];
              if (char === "{") depth++;
              else if (char === "}") {
                depth--;
                if (depth === 0) {
                  endIndex = i + 1;
                  break;
                }
              }
            }
            if (endIndex > 0) {
              try {
                data = JSON.parse(jsonCandidate.slice(0, endIndex));
              } catch {
                // Continue to fallback
              }
            }
          }
        }
      }

      // Strategy 4: Graceful fallback - never throw, always show something
      if (!data) {
        console.error("Failed to parse response:", responseText.slice(0, 500));
        data = { message: "I'm working on that. Give me one more try?" };
      }

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

        // Replace content image placeholders with actual base64 data
        let processedHtml = data.html;
        const contentImages = imagesToSend.filter(img => img.type === "content");
        for (let i = 0; i < contentImages.length; i++) {
          const placeholder = `{{CONTENT_IMAGE_${i}}}`;
          processedHtml = processedHtml.split(placeholder).join(contentImages[i].data);
        }

        // Inject navigation guard to keep all clicks inside iframe
        const navGuard = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a){var h=a.getAttribute('href');if(h&&h.startsWith('http')){e.preventDefault();return;}if(h&&!h.startsWith('javascript:')){e.preventDefault();}}},true);</script>`;
        const safeHtml = processedHtml.replace(/<head([^>]*)>/i, `<head$1>${navGuard}`);
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
  }, [isOnCall, uploadedImages, hasStarted, selectedElement, currentPreview, previewScreenshot]);

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
    const imagesToSend = imagesToInclude || [...uploadedImages];
    if (!imagesToInclude) setUploadedImages([]);

    if (!hasStarted) setHasStarted(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: visibleText || apiText, // Show visible text to user
      uploadedImages: imagesToSend.length > 0 ? imagesToSend : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiUserMessage = { ...userMessage, content: apiText }; // Use full text for API
      const cleanMessages = [...messagesRef.current, apiUserMessage].map(
        ({ images, pills, showUpload, ...rest }) => rest
      );

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: cleanMessages,
          uploadedImages: imagesToSend,
          currentPreview,
          previewScreenshot,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMsg = "Something went wrong. Please try again.";
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          if (response.status === 413) errorMsg = "Request too large. Try with fewer or smaller images.";
          else if (response.status === 429) errorMsg = "Too many requests. Please wait a moment.";
        }
        throw new Error(errorMsg);
      }

      const responseText = await response.text();
      const lines = responseText.trim().split("\n").filter((l) => l.trim());
      const lastLine = lines[lines.length - 1];

      // Safely parse JSON with multiple fallback strategies
      let data;

      // Strategy 1: Try parsing the last line directly
      if (lastLine && lastLine !== "undefined" && lastLine.startsWith("{")) {
        try {
          data = JSON.parse(lastLine);
        } catch {
          // Continue to fallback
        }
      }

      // Strategy 2: Find the last complete JSON object
      if (!data) {
        const jsonStart = responseText.lastIndexOf("\n{");
        if (jsonStart !== -1) {
          const jsonCandidate = responseText.slice(jsonStart + 1).trim();
          try {
            data = JSON.parse(jsonCandidate);
          } catch {
            // Continue
          }
        }
      }

      // Strategy 3: Find JSON with "message" field
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

      // Strategy 4: Graceful fallback
      if (!data) {
        console.error("Failed to parse response:", responseText.slice(0, 500));
        data = { message: "I'm working on that. Give me one more try?" };
      }

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
        setRedoHistory([]);

        // Replace content image placeholders with actual base64 data
        let processedHtml = data.html;
        const contentImages = imagesToSend.filter(img => img.type === "content");
        for (let i = 0; i < contentImages.length; i++) {
          const placeholder = `{{CONTENT_IMAGE_${i}}}`;
          processedHtml = processedHtml.split(placeholder).join(contentImages[i].data);
        }

        const navGuard = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a){var h=a.getAttribute('href');if(h&&h.startsWith('http')){e.preventDefault();return;}if(h&&!h.startsWith('javascript:')){e.preventDefault();}}},true);</script>`;
        const safeHtml = processedHtml.replace(/<head([^>]*)>/i, `<head$1>${navGuard}`);
        setCurrentPreview(safeHtml);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error sending message:", error);

      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));

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
  }, [uploadedImages, hasStarted, currentPreview, previewScreenshot]);

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

  const handleImageUpload = (base64: string, type: "inspo" | "content" = "inspo", label?: string) => {
    setUploadedImages((prev) => [...prev, { data: base64, type, label }]);
  };

  const handleImageRemove = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageTypeToggle = async (index: number) => {
    const img = uploadedImages[index];
    if (!img) return;

    const newType = img.type === "inspo" ? "content" : "inspo";

    // If switching to content, re-compress for smaller size (fits in HTML output)
    if (newType === "content") {
      try {
        const compressed = await compressForContent(img.data);
        setUploadedImages((prev) =>
          prev.map((img, i) =>
            i === index ? { ...img, type: newType, data: compressed } : img
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
      // Switching to inspo - no re-compression needed
      setUploadedImages((prev) =>
        prev.map((img, i) =>
          i === index ? { ...img, type: newType } : img
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

  const handleRestoreVersion = useCallback((index: number) => {
    if (currentPreview) {
      // Push current and all history after index into redo
      const historyAfter = previewHistory.slice(index + 1);
      setRedoHistory((r) => [...r, ...historyAfter, currentPreview]);
      setCurrentPreview(previewHistory[index]);
      setPreviewHistory(previewHistory.slice(0, index));
      // Invalidate bookmarks that point to versions no longer in history
      setBookmarks((prev) => prev.filter((b) => b.versionIndex <= index));
    }
  }, [currentPreview, previewHistory]);

  const handleNewProject = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setCurrentPreview(null);
    setPreviewHistory([]);
    setRedoHistory([]);
    setUploadedImages([]);
    setIsGenerating(false);
    setHasStarted(false);
    setWelcomeInput("");
    setWelcomeKey((k) => k + 1);
    setIsOnCall(false);
    setPreviewScreenshot(null);
    setCurrentProjectId(null);
    setProjectName("Untitled");
    setSelectMode(false);
    setSelectedElement(null);
    setBookmarks([]);
  }, []);

  const handleLoadProject = useCallback((id: string) => {
    const proj = loadProject(id);
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
  }, []);

  const handleDeleteProject = useCallback((id: string) => {
    deleteProject(id);
    setSavedProjects(listProjects());
    if (id === currentProjectId) {
      handleNewProject();
    }
  }, [currentProjectId, handleNewProject]);

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
        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          <Image src="/logo.png" alt="16s logo" width={32} height={32} className="object-contain" />
        </div>

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
            onImageTypeToggle={handleImageTypeToggle}
            onImageUpdate={handleImageUpdate}
            isGenerating={isGenerating}
            uploadedImages={uploadedImages}
            onNewProject={handleNewProject}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            savedProjects={savedProjects}
            currentProjectId={currentProjectId}
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
  );
}
