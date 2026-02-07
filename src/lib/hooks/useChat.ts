"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { VoiceCallHandle } from "@/components/chat/VoiceCall";
import { ensureBlobUrls } from "@/lib/hooks/useImages";
import { parseAIResponse } from "@/lib/ai/parse-response";
import type { Message, UploadedImage, SelectedElement, ProjectContext, ChatAPIResponse } from "@/lib/types";

/** Generate contextual fallback pills when the AI response is missing them */
function getContextualFallbackPills(
  hasPreview: boolean,
  hasNewHtml: boolean,
  hasPlan: boolean,
  messageCount: number,
): string[] {
  if (hasPlan) return ["Looks good, build it!", "Let's adjust the plan"];
  if (hasNewHtml && !hasPreview) return ["Love it, keep going", "Different direction", "Send me my photos"];
  if (hasNewHtml && hasPreview) return ["Looks great", "Make more changes", "Let's deploy"];
  if (hasPreview && messageCount > 6) return ["Add animations", "Add contact form", "Let's deploy"];
  if (hasPreview) return ["Make changes", "Send me photos", "Different direction"];
  return ["I'll drop some inspo", "Surprise me with a style", "Hop on a call"];
}

/** Extract message text from partially-streamed JSON response */
function extractStreamingMessage(raw: string): { messageText: string; phase: "thinking" | "message" | "html" } {
  const prefix = '"message":"';
  const msgStart = raw.indexOf(prefix);
  if (msgStart === -1) return { messageText: "", phase: "thinking" };

  const contentStart = msgStart + prefix.length;

  // Find where message value ends (unescaped quote)
  let messageEnd = -1;
  let i = contentStart;
  while (i < raw.length) {
    if (raw[i] === "\\") { i += 2; continue; }
    if (raw[i] === '"') { messageEnd = i; break; }
    i++;
  }

  const endIndex = messageEnd === -1 ? raw.length : messageEnd;
  const messageContent = raw.substring(contentStart, endIndex);

  // Unescape JSON string escapes
  const unescaped = messageContent
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\t/g, "\t");

  // Check if we've moved past message into HTML
  const htmlStart = raw.indexOf('"html":"', contentStart);

  return {
    messageText: unescaped,
    phase: htmlStart !== -1 ? "html" : "message",
  };
}

interface UseChatOptions {
  currentPreview: string | null;
  previewScreenshot: string | null;
  projectContext: ProjectContext | undefined;
  uploadedImages: UploadedImage[];
  selectedElement: SelectedElement | null;
  isConfigured: boolean;
  user: { id: string } | null;
  onPushPreview: (html: string) => void;
  onContextUpdate: (context: Partial<ProjectContext>) => void;
  onClearImages: () => void;
  onRestoreImages: (images: UploadedImage[]) => void;
  onClearSelection: () => void;
  onResetPreview: () => void;
}

export function useChat({
  currentPreview,
  previewScreenshot,
  projectContext,
  uploadedImages,
  selectedElement,
  isConfigured,
  user,
  onPushPreview,
  onContextUpdate,
  onClearImages,
  onRestoreImages,
  onClearSelection,
  onResetPreview,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Auth state for new user flow
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<{ text: string; images?: UploadedImage[] } | null>(null);
  const [authModalMessage, setAuthModalMessage] = useState<{ title?: string; subtitle?: string } | null>(null);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const abortRef = useRef<AbortController | null>(null);
  const voiceCallRef = useRef<VoiceCallHandle>(null);
  const sendMessageRef = useRef<((text: string, images?: UploadedImage[]) => void) | null>(null);

  // When user logs in after submitting a pending prompt, send it
  const pendingPromptRef = useRef(pendingPrompt);
  useEffect(() => { pendingPromptRef.current = pendingPrompt; }, [pendingPrompt]);

  useEffect(() => {
    if (user && pendingPromptRef.current && sendMessageRef.current) {
      const { text, images } = pendingPromptRef.current;
      setPendingPrompt(null);
      setShowAuthModal(false);
      const timer = setTimeout(() => {
        sendMessageRef.current?.(text, images);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Helper function to replace image placeholders in HTML
  const replaceImagePlaceholders = useCallback((html: string, currentImages?: UploadedImage[]): string => {
    const allContentImages: UploadedImage[] = [];
    const allInspoImages: UploadedImage[] = [];

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

    if (currentImages) {
      for (const img of currentImages) {
        if (img.type === "content" && !allContentImages.some(existing => existing.data === img.data)) {
          allContentImages.push(img);
        } else if (img.type === "inspo" && !allInspoImages.some(existing => existing.data === img.data)) {
          allInspoImages.push(img);
        }
      }
    }

    const fallbackPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    const currentMessageImages: UploadedImage[] = [];
    if (currentImages && currentImages.length > 0) {
      currentMessageImages.push(...currentImages);
    } else {
      for (let i = messagesRef.current.length - 1; i >= 0; i--) {
        const msg = messagesRef.current[i];
        if (msg.role === "user" && msg.uploadedImages && msg.uploadedImages.length > 0) {
          currentMessageImages.push(...msg.uploadedImages);
          break;
        }
      }
    }

    let result = html;

    const resolveImage = (images: UploadedImage[], index: number): string => {
      if (images[index]) return images[index].url || images[index].data;
      if (images.length > 0) return images[images.length - 1].url || images[images.length - 1].data;
      return fallbackPixel;
    };

    // Step 0: Replace {{CURRENT_IMAGE_N}}
    const currentPlaceholderRegex = /\{\{\s*CURRENT_IMAGE_(\d+)\s*\}\}/g;
    result = result.replace(currentPlaceholderRegex, (_match, indexStr) => {
      return resolveImage(currentMessageImages, parseInt(indexStr, 10));
    });

    // Step 1a: Replace {{INSPO_IMAGE_N}}
    const inspoPlaceholderRegex = /\{\{\s*INSPO_IMAGE_(\d+)\s*\}\}/g;
    result = result.replace(inspoPlaceholderRegex, (_match, indexStr) => {
      return resolveImage(allInspoImages, parseInt(indexStr, 10));
    });

    // Step 1b: Replace {{CONTENT_IMAGE_N}}
    const imagesToUse = allContentImages.length > 0 ? allContentImages : allInspoImages;
    const placeholderRegex = /\{\{\s*CONTENT_IMAGE_(\d+)\s*\}\}/g;
    result = result.replace(placeholderRegex, (_match, indexStr) => {
      return resolveImage(imagesToUse, parseInt(indexStr, 10));
    });

    const allImages = [...allContentImages, ...allInspoImages];
    const allValidUrls = allImages.map(img => img.url).filter(Boolean);

    // Step 2: Validate blob URLs
    const blobUrlRegex = /src="(https:\/\/[^"]*\.public\.blob\.vercel-storage\.com\/[^"]*)"/g;
    result = result.replace(blobUrlRegex, (match, url) => {
      if (allValidUrls.includes(url)) return match;
      if (allImages.length > 0) {
        const last = allImages[allImages.length - 1];
        return `src="${last.url || last.data}"`;
      }
      return `src="${fallbackPixel}"`;
    });

    // Step 3: Replace AI-generated base64 with real images
    if (allImages.length > 0) {
      const aiBase64Regex = /src="(data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,})"/g;
      const validBase64s = allImages.map(img => img.data);
      result = result.replace(aiBase64Regex, (match, base64) => {
        if (validBase64s.includes(base64)) return match;
        const last = allImages[allImages.length - 1];
        return `src="${last.url || last.data}"`;
      });
    }

    // Step 4: Safety net — force first img tag if current images unused
    if (currentMessageImages.length > 0) {
      const currentSrcs = currentMessageImages
        .map(img => img.url || img.data)
        .filter(Boolean);
      const anyCurrentImageUsed = currentSrcs.some(src => result.includes(src));
      if (!anyCurrentImageUsed) {
        const firstImgSrc = currentSrcs[0];
        if (firstImgSrc) {
          let replaced = false;
          result = result.replace(/(<img\s[^>]*?)src="[^"]*"/, (match, prefix) => {
            if (replaced) return match;
            replaced = true;
            return `${prefix}src="${firstImgSrc}"`;
          });
        }
      }
    }

    return result;
  }, []);

  // Shared helper to build clean messages array for API
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

  // Shared helper: send to API, read streaming response, update state progressively
  const sendAndProcessChat = useCallback(async (
    cleanMessages: Partial<Message>[],
    imagesToSend: UploadedImage[],
    userMessage: Message,
    controller: AbortController,
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
        outputFormat: "html",
        context: projectContext,
      }),
      signal: controller.signal,
    });

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

    // Create streaming placeholder message
    const streamingMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: streamingMsgId,
      role: "assistant" as const,
      content: "",
    }]);

    // Read NDJSON stream
    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback: non-streaming (shouldn't happen but be safe)
      const text = await response.text();
      const lines = text.trim().split("\n").filter(l => l.trim());
      let data: ChatAPIResponse = { message: "Let me try that again..." };
      for (const line of lines.reverse()) {
        try {
          const event = JSON.parse(line);
          if (event.type === "done" && event.response) { data = event.response; break; }
          if (event.message) { data = event; break; }
        } catch { continue; }
      }
      setMessages(prev => prev.map(m =>
        m.id === streamingMsgId
          ? { ...m, content: data.message || "...", pills: data.pills, showUpload: data.showUpload, plan: data.plan, qaReport: data.qaReport }
          : m
      ));
      if (data.html) {
        const processedHtml = replaceImagePlaceholders(data.html, imagesToSend);
        const navGuard = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a){var h=a.getAttribute('href');if(h&&h.startsWith('http')){e.preventDefault();return;}if(h&&!h.startsWith('javascript:')){e.preventDefault();}}},true);<\/script>`;
        onPushPreview(processedHtml.replace(/<head([^>]*)>/i, `<head$1>${navGuard}`));
      }
      if (data.context) onContextUpdate(data.context);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let rawTokens = "";
    let doneResponse: ChatAPIResponse | null = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 50; // ms — ~20 updates/sec for smooth text display

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "token") {
              rawTokens += event.text;

              const now = Date.now();
              if (now - lastUpdateTime >= UPDATE_INTERVAL) {
                lastUpdateTime = now;
                const { messageText } = extractStreamingMessage(rawTokens);
                setMessages(prev => prev.map(m =>
                  m.id === streamingMsgId
                    ? { ...m, content: messageText || "" }
                    : m
                ));
              }
            } else if (event.type === "done") {
              doneResponse = event.response;
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User stopped — keep whatever streaming content is shown
        return;
      }
      // Stream error after tokens started — show partial content + error note
      const { messageText } = extractStreamingMessage(rawTokens);
      if (messageText) {
        setMessages(prev => prev.map(m =>
          m.id === streamingMsgId
            ? { ...m, content: messageText + "\n\n*Generation interrupted. Try again?*", pills: ["Try again"] }
            : m
        ));
        return;
      }
      throw error;
    } finally {
      reader.releaseLock();
    }

    // If no done event, fallback parse accumulated tokens
    const finalResponse: ChatAPIResponse = doneResponse ?? parseAIResponse(rawTokens);

    // Finalize message with pills, HTML, context
    const isErrorResponse = !finalResponse.html && !finalResponse.plan && /unavailable|try again|timed? out|too many|busy/i.test(finalResponse.message || "");
    const pills = isErrorResponse
      ? undefined
      : (finalResponse.pills && finalResponse.pills.length > 0)
        ? finalResponse.pills
        : getContextualFallbackPills(!!currentPreview, !!finalResponse.html, !!finalResponse.plan, cleanMessages.length);

    setMessages(prev => prev.map(m =>
      m.id === streamingMsgId
        ? {
            id: streamingMsgId,
            role: "assistant" as const,
            content: finalResponse.message || "I'm working on your request...",
            pills,
            showUpload: finalResponse.showUpload,
            plan: finalResponse.plan,
            qaReport: finalResponse.qaReport,
          }
        : m
    ));

    if (finalResponse.html) {
      const processedHtml = replaceImagePlaceholders(finalResponse.html, imagesToSend);
      const navGuard = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a){var h=a.getAttribute('href');if(h&&h.startsWith('http')){e.preventDefault();return;}if(h&&!h.startsWith('javascript:')){e.preventDefault();}}},true);<\/script>`;
      const safeHtml = processedHtml.replace(/<head([^>]*)>/i, `<head$1>${navGuard}`);
      onPushPreview(safeHtml);
    }

    if (finalResponse.context) {
      onContextUpdate(finalResponse.context);
    }
  }, [currentPreview, previewScreenshot, projectContext, replaceImagePlaceholders, onPushPreview, onContextUpdate]);

  const handleSendMessage = useCallback(async (text: string, imagesToInclude?: UploadedImage[]) => {
    // If auth is configured but user is not signed in
    if (isConfigured && !user) {
      setPendingPrompt({ text, images: imagesToInclude || [...uploadedImages] });
      setAuthModalMessage({
        title: "Let's get you signed in",
        subtitle: "Before we bring your dream site to life, we need you to create an account or sign in."
      });
      setShowAuthModal(true);
      return;
    }

    // If on a call, route typed messages to the voice agent
    if (isOnCall && voiceCallRef.current) {
      voiceCallRef.current.injectTypedMessage(text);
      return;
    }

    let imagesToSend = imagesToInclude || [...uploadedImages];
    const hadOwnImages = !imagesToInclude && uploadedImages.length > 0;
    if (!imagesToInclude) onClearImages();

    imagesToSend = await ensureBlobUrls(imagesToSend);

    if (!hasStarted) setHasStarted(true);

    // Include selected element context
    let messageText = text;
    if (selectedElement) {
      const elementDesc = `[User has selected a <${selectedElement.tagName}> element${selectedElement.id ? ` with id="${selectedElement.id}"` : ""}${selectedElement.className ? ` with class="${selectedElement.className}"` : ""}. Apply the following change to this specific element:]`;
      messageText = `${elementDesc}\n${text}`;
      onClearSelection();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      uploadedImages: imagesToSend.length > 0 ? imagesToSend : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Upload history content images missing blob URLs in background
      const hasHistoryUploads = messagesRef.current.some(msg =>
        msg.uploadedImages?.some(img => img.type === "content" && !img.url)
      );
      if (hasHistoryUploads) {
        Promise.allSettled(
          messagesRef.current
            .filter(msg => msg.uploadedImages?.some(img => img.type === "content" && !img.url))
            .map(async (msg) => {
              if (!msg.uploadedImages) return;
              const updated = await ensureBlobUrls(msg.uploadedImages);
              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, uploadedImages: updated } : m));
            })
        );
      }

      const apiUserMessage = { ...userMessage, content: messageText };
      const cleanMessages = buildCleanMessages(messagesRef.current, [apiUserMessage]);

      await sendAndProcessChat(cleanMessages, imagesToSend, userMessage, controller);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.debug("Error sending message:", error);

      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));

      if (hadOwnImages) {
        onRestoreImages(imagesToSend);
      }

      const isNetwork = error instanceof TypeError && /fetch|network/i.test(error.message);
      const isCredits = error instanceof Error && /credits|insufficient/i.test(error.message);
      const errorMsg = isNetwork
        ? "Connection lost. Your project is safe — try again when you're back online."
        : error instanceof Error ? error.message : "Let me try that again...";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMsg,
          pills: isCredits ? ["Upgrade plan"] : isNetwork ? ["Try again"] : undefined,
        },
      ]);
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false);
      }
    }
  }, [isOnCall, uploadedImages, hasStarted, selectedElement, isConfigured, user, sendAndProcessChat, buildCleanMessages, onClearImages, onRestoreImages, onClearSelection]);

  // Keep ref updated for auth callback
  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  const handlePillClick = useCallback((pill: string) => {
    if (isGenerating) return;
    const lowerPill = pill.toLowerCase();
    if (lowerPill.includes("call") || lowerPill.includes("phone") || lowerPill.includes("voice")) {
      setIsOnCall(true);
      return;
    }
    handleSendMessage(pill);
  }, [isGenerating, handleSendMessage]);

  // Internal send that allows custom visible text vs actual API text
  const handleSendMessageInternal = useCallback(async (
    apiText: string,
    imagesToInclude?: UploadedImage[],
    visibleText?: string
  ) => {
    let imagesToSend = imagesToInclude || [...uploadedImages];
    if (!imagesToInclude) onClearImages();

    imagesToSend = await ensureBlobUrls(imagesToSend);

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

      const isNetwork = error instanceof TypeError && /fetch|network/i.test(error.message);
      const isCredits = error instanceof Error && /credits|insufficient/i.test(error.message);
      const errorMsg = isNetwork
        ? "Connection lost. Your project is safe — try again when you're back online."
        : error instanceof Error ? error.message : "Let me try that again...";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMsg,
          pills: isCredits ? ["Upgrade plan"] : isNetwork ? ["Try again"] : undefined,
        },
      ]);
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false);
      }
    }
  }, [uploadedImages, hasStarted, sendAndProcessChat, buildCleanMessages, onClearImages]);

  const handleCallComplete = useCallback((visibleSummary: string, privateData: string) => {
    setIsOnCall(false);
    handleSendMessageInternal(privateData, undefined, visibleSummary);
  }, [handleSendMessageInternal]);

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const originalMessage = messages[messageIndex];
    if (originalMessage.role !== "user") return;

    const truncatedMessages = messages.slice(0, messageIndex);
    setMessages(truncatedMessages);

    // Reset preview state since we're replaying from an earlier point
    onResetPreview();

    handleSendMessage(newContent, originalMessage.uploadedImages);
  }, [messages, handleSendMessage, onResetPreview]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === "user") {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  const handleStartCall = useCallback(() => {
    setIsOnCall(true);
  }, []);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsGenerating(false);
    setHasStarted(false);
    setIsOnCall(false);
  }, []);

  return {
    messages,
    setMessages,
    isGenerating,
    isOnCall,
    setIsOnCall,
    hasStarted,
    setHasStarted,
    showAuthModal,
    setShowAuthModal,
    pendingPrompt,
    setPendingPrompt,
    authModalMessage,
    setAuthModalMessage,
    voiceCallRef,
    sendMessageRef,
    abortRef,
    handleSendMessage,
    handlePillClick,
    handleEditMessage,
    handleStop,
    handleStartCall,
    handleCallComplete,
    resetChat,
  };
}
