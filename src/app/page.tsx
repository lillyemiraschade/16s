"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, ImagePlus, X } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { VoiceCall } from "@/components/chat/VoiceCall";

type Viewport = "desktop" | "tablet" | "mobile";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean | string;
  images?: string[];
}

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

const ALL_QUICK_ACTIONS = [
  "Build me a landing page",
  "Design a portfolio site",
  "Create a restaurant website",
  "Make an agency homepage",
  "Design a SaaS product page",
  "Build an online store",
  "Create a personal blog",
  "Design a startup site",
  "Make a fitness studio page",
  "Build a photography portfolio",
  "Create a coffee shop site",
  "Design a law firm website",
  "Make a real estate page",
  "Build a wedding planner site",
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [isGenerating, setIsGenerating] = useState(false);
  const [inspoImages, setInspoImages] = useState<string[]>([]);
  const [isOnCall, setIsOnCall] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState<{ text: string; id: number } | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Randomized on each mount/reset
  const [welcomeKey, setWelcomeKey] = useState(0);
  const headline = useMemo(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)], [welcomeKey]);
  const quickActions = useMemo(() => pickRandom(ALL_QUICK_ACTIONS, 4), [welcomeKey]);

  const [welcomeInput, setWelcomeInput] = useState("");
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeFileRef = useRef<HTMLInputElement>(null);

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
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      const cleanMessages = [...messages, userMessage].map(
        ({ images, pills, showUpload, ...rest }) => rest
      );

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: cleanMessages,
          inspoImages: imagesToSend,
          currentPreview,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const responseText = await response.text();
      const lines = responseText.trim().split("\n").filter((l) => l.trim());
      const data = JSON.parse(lines[lines.length - 1]);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        pills: data.pills,
        showUpload: data.showUpload,
      };
      setMessages((prev) => [...prev, aiMessage]);
      if (isOnCall) setLastAiResponse({ text: data.message, id: Date.now() });

      if (data.html) {
        if (currentPreview) {
          setPreviewHistory((prev) => [...prev, currentPreview]);
        }
        setCurrentPreview(data.html);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMsg = "Sorry, something went wrong. Can you try again?";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMsg,
        },
      ]);
      if (isOnCall) setLastAiResponse({ text: errorMsg, id: Date.now() });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePillClick = (pill: string) => {
    if (isGenerating) return;
    handleSendMessage(pill);
  };

  const handleImageUpload = (base64: string) => {
    setInspoImages((prev) => [...prev, base64]);
  };

  const handleImageRemove = (index: number) => {
    setInspoImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBack = () => {
    if (previewHistory.length > 0) {
      const prev = [...previewHistory];
      const last = prev.pop()!;
      setPreviewHistory(prev);
      setCurrentPreview(last);
    }
  };

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

  const handleNewProject = useCallback(() => {
    setMessages([]);
    setCurrentPreview(null);
    setPreviewHistory([]);
    setInspoImages([]);
    setHasStarted(false);
    setWelcomeInput("");
    setWelcomeKey((k) => k + 1);
    setIsOnCall(false);
    setLastAiResponse(null);
  }, []);

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

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const MAX = 1200;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const processWelcomeFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await readFileAsDataURL(file);
        const compressed = await compressImage(dataUrl);
        handleImageUpload(compressed);
      } catch (err) {
        console.error("Failed to process image:", err);
      }
    }
  };

  const handleWelcomeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processWelcomeFiles(e.target.files);
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
              <h1 className="text-[32px] font-medium text-zinc-200 tracking-[-0.02em] text-center">
                {headline}
              </h1>
            </div>

            {/* Input bar */}
            <div className="w-full glass-matte rounded-2xl p-1">
              {inspoImages.length > 0 && (
                <div className="flex gap-2 flex-wrap px-3 pt-3">
                  {inspoImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`Upload ${idx + 1}`} className="h-14 w-14 object-cover rounded-lg ring-1 ring-white/[0.06]" />
                      <button
                        onClick={() => handleImageRemove(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ring-1 ring-white/[0.06]"
                      >
                        <X className="w-3 h-3 text-zinc-300" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => welcomeFileRef.current?.click()}
                    className="h-14 w-14 rounded-lg glass glass-hover flex items-center justify-center transition-all duration-200"
                  >
                    <ImagePlus className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 px-4 py-3">
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
                  className="flex-1 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-40 resize-none overflow-y-auto leading-relaxed"
                  style={{ maxHeight: 160 }}
                />
                <button
                  onClick={handleWelcomeSend}
                  disabled={(!welcomeInput.trim() && inspoImages.length === 0) || isGenerating}
                  className="p-2.5 bg-green-500/80 hover:bg-green-400/80 disabled:bg-zinc-800/60 disabled:cursor-not-allowed rounded-full transition-all duration-200 flex-shrink-0 glow-green disabled:shadow-none"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="flex items-center gap-1 px-4 pb-3">
                <button
                  onClick={() => welcomeFileRef.current?.click()}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors"
                  title="Upload images"
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
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSendMessage(action)}
                  className="px-4 py-2 text-[13px] font-medium text-zinc-400 hover:text-zinc-200 glass-matte glass-hover rounded-full transition-all duration-200"
                >
                  {action}
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
        <nav className="w-1/3 min-w-[360px]" aria-label="Chat">
          <ChatPanel
            messages={messages}
            onSend={handleSendMessage}
            onPillClick={handlePillClick}
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            isGenerating={isGenerating}
            inspoImages={inspoImages}
            onNewProject={handleNewProject}
            isOnCall={isOnCall}
            onStartCall={() => { setLastAiResponse(null); setIsOnCall(true); }}
            onEndCall={() => setIsOnCall(false)}
            lastAiResponse={lastAiResponse}
          />
        </nav>
        <main className="flex-1 relative" aria-label="Preview">
          <PreviewPanel
            html={currentPreview}
            viewport={viewport}
            onViewportChange={setViewport}
            isGenerating={isGenerating}
            canGoBack={previewHistory.length > 0}
            onBack={handleBack}
            onExport={handleExport}
          />
          {/* Voice call widget — top-right of preview area */}
          <AnimatePresence>
            {isOnCall && (
              <div className="absolute top-14 right-4 z-30">
                <VoiceCall
                  onSend={handleSendMessage}
                  onHangUp={() => setIsOnCall(false)}
                  aiResponse={lastAiResponse}
                  isGenerating={isGenerating}
                />
              </div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>
    </AnimatePresence>
  );
}
