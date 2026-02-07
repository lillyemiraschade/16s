"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, X, Plus, Phone, Info, Sparkles, Mic } from "lucide-react";
import Image from "next/image";
import { TypingIndicator } from "./TypingIndicator";
import { ChatMessage } from "./ChatMessage";
import { ImageUploadBar } from "./ImageUploadBar";
import { ChatInput } from "./ChatInput";
import { UserMenu } from "@/components/auth/UserMenu";
import { processImageFiles } from "@/lib/images";
import type { ChatPanelProps } from "@/lib/types";

export const ChatPanel = memo(function ChatPanel({
  messages,
  onSend,
  onPillClick,
  onImageUpload,
  onImageRemove,
  onImageTypeToggle,
  onImageUpdate,
  isGenerating,
  onStop,
  uploadedImages,
  onNewProject,
  isOnCall,
  onStartCall,
  hasPreview,
  selectedElement,
  onClearSelection,
  onEditMessage,
  saveStatus,
}: ChatPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showCallDisclaimer, setShowCallDisclaimer] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadContext, setUploadContext] = useState<{ type: "inspo" | "content"; label?: string }>({ type: "inspo" });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);

  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
    lightboxTriggerRef.current?.focus();
    lightboxTriggerRef.current = null;
  }, []);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleImageError = useCallback((msg: string) => {
    clearTimeout(errorTimerRef.current);
    setUploadError(msg);
    errorTimerRef.current = setTimeout(() => setUploadError(null), 6000);
  }, []);

  // Lightbox escape + focus trap
  useEffect(() => {
    if (!lightboxImage) return;
    requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "Tab") { e.preventDefault(); lightboxCloseRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxImage, closeLightbox]);

  // Call disclaimer escape + focus trap
  useEffect(() => {
    if (!showCallDisclaimer) return;
    requestAnimationFrame(() => {
      const dialog = document.querySelector<HTMLElement>('[aria-labelledby="call-disclaimer-title"]');
      dialog?.querySelector<HTMLElement>("button:last-of-type")?.focus();
    });
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCallDisclaimer(false);
      if (e.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>('[aria-labelledby="call-disclaimer-title"]');
        const focusable = dialog?.querySelectorAll<HTMLElement>("button");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showCallDisclaimer]);

  // Auto-scroll
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    if (!userScrolledUpRef.current) scrollToBottom();
  }, [messages, isGenerating]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const uploadWithType = (base64: string) => onImageUpload(base64, uploadContext.type, uploadContext.label);
    processImageFiles(files, uploadWithType, handleImageError, uploadContext.type === "content");
    e.target.value = "";
  };

  // Paste handler
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const uploadWithType = (base64: string) => onImageUpload(base64, uploadContext.type, uploadContext.label);
    processImageFiles(imageFiles, uploadWithType, handleImageError, uploadContext.type === "content");
  }, [onImageUpload, uploadContext, handleImageError]);

  // Drag handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const uploadWithType = (base64: string) => onImageUpload(base64, uploadContext.type, uploadContext.label);
    processImageFiles(e.dataTransfer.files, uploadWithType, handleImageError, uploadContext.type === "content");
  };

  // Callbacks for sub-components
  const handleLightboxOpen = useCallback((src: string, trigger: HTMLElement) => {
    lightboxTriggerRef.current = trigger;
    setLightboxImage(src);
  }, []);

  const handleUploadTrigger = useCallback((type: "inspo" | "content", label?: string) => {
    setUploadContext({ type, label });
    fileInputRef.current?.click();
  }, []);

  const handleAttach = useCallback(() => {
    if (!uploadContext.label) {
      setUploadContext({ type: hasPreview ? "content" : "inspo" });
    }
    fileInputRef.current?.click();
  }, [uploadContext.label, hasPreview]);

  const handleCallClick = () => {
    if (isOnCall) return;
    setShowCallDisclaimer(true);
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0a0a0b] dot-grid border-r border-white/[0.04] relative"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
    >
      {/* Call disclaimer modal */}
      <AnimatePresence>
        {showCallDisclaimer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="call-disclaimer-title"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="glass-matte rounded-2xl p-8 max-w-[400px] w-full shadow-2xl shadow-black/50"
            >
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-b from-green-400 to-green-600 flex items-center justify-center">
                    <Phone className="w-7 h-7 text-white" />
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-green-400/30"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </div>
              <h2 id="call-disclaimer-title" className="text-zinc-100 text-[18px] font-semibold text-center mb-2">
                Start AI Voice Call
              </h2>
              <p className="text-zinc-400 text-[14px] leading-relaxed text-center mb-6">
                You&apos;re about to speak with an <span className="text-green-400 font-medium">AI design assistant</span>.
                Tell it about your project and it will help design your website.
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-[13px] text-zinc-300">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Mic className="w-3 h-3 text-green-400" />
                  </div>
                  <span>Speak naturally about your project</span>
                </div>
                <div className="flex items-center gap-3 text-[13px] text-zinc-300">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-green-400" />
                  </div>
                  <span>AI will ask clarifying questions</span>
                </div>
                <div className="flex items-center gap-3 text-[13px] text-zinc-300">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Info className="w-3 h-3 text-green-400" />
                  </div>
                  <span>Hang up anytime to start designing</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCallDisclaimer(false)}
                  className="flex-1 px-4 py-3 text-[14px] font-medium text-zinc-400 glass glass-hover rounded-xl transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowCallDisclaimer(false); onStartCall(); }}
                  className="flex-1 px-4 py-3 text-[14px] font-medium text-black bg-gradient-to-b from-green-400 to-green-500 hover:from-green-300 hover:to-green-400 rounded-xl transition-all duration-200 shadow-lg shadow-green-500/25"
                >
                  Start Call
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-[52px] px-4 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="16s logo" width={28} height={28} className="object-contain" />
          <button
            onClick={handleCallClick}
            disabled={isOnCall}
            className={`flex items-center gap-1.5 px-2.5 py-2 md:py-1.5 text-[12px] md:text-[11px] font-medium rounded-lg transition-all duration-200 min-h-[44px] md:min-h-0 ${
              isOnCall
                ? "text-green-400 bg-green-500/15"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
            } disabled:cursor-not-allowed`}
            title={isOnCall ? "Call in progress..." : "Voice call with AI"}
            aria-label={isOnCall ? "Call in progress" : "Start voice call with AI"}
          >
            <Phone className="w-4 h-4 md:w-3.5 md:h-3.5" />
            <span>{isOnCall ? "On Call" : "Call"}</span>
          </button>
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-2.5 py-2 md:py-1.5 text-[12px] md:text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded-lg transition-all duration-200 min-h-[44px] md:min-h-0"
            title="Start new project"
            aria-label="Start new project"
          >
            <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />
            <span>New</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && saveStatus !== "idle" && (
            <span className={`text-[11px] font-medium transition-opacity duration-300 ${
              saveStatus === "saving" ? "text-zinc-500" : "text-zinc-500"
            }`}>
              {saveStatus === "saving" ? "Saving..." : "Saved"}
            </span>
          )}
          <UserMenu />
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 py-5 relative flex flex-col"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        onScroll={() => {
          const el = scrollContainerRef.current;
          if (!el) return;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
          userScrolledUpRef.current = !nearBottom;
        }}
      >
        <div className="flex-1" />

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-green-500/[0.03] border-2 border-dashed border-green-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm"
            >
              <div className="text-center">
                <ImagePlus className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-green-400 font-medium">Drop images here</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload error toast */}
        <AnimatePresence>
          {uploadError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 left-4 right-4 z-20 glass rounded-xl px-4 py-3 border border-red-500/20"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-red-400">{uploadError}</p>
                <button onClick={() => setUploadError(null)} className="text-red-400/60 hover:text-red-400 text-xs flex-shrink-0" aria-label="Dismiss error">&times;</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message list */}
        <AnimatePresence>
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              prevMessage={messages[index - 1]}
              nextMessage={messages[index + 1]}
              isGenerating={isGenerating}
              onPillClick={onPillClick}
              onEditMessage={onEditMessage}
              onLightboxOpen={handleLightboxOpen}
              onUploadTrigger={handleUploadTrigger}
            />
          ))}
        </AnimatePresence>

        {/* Typing indicator + stop button */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-end gap-2 mt-4"
          >
            {(!messages.length || messages[messages.length - 1].role !== "assistant") && (
              <div className="glass-bubble bubble-tail-left px-4 py-3">
                <TypingIndicator label={hasPreview ? "Making changes..." : "Designing your site..."} />
              </div>
            )}
            <button
              onClick={onStop}
              className="px-3 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-colors"
            >
              Stop
            </button>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image upload bar + input */}
      <div className="px-5 pb-0">
        {uploadedImages.length > 0 && (
          <ImageUploadBar
            images={uploadedImages}
            onRemove={onImageRemove}
            onTypeToggle={onImageTypeToggle}
            onUpdate={onImageUpdate}
            onLightboxOpen={handleLightboxOpen}
            onAddMore={() => fileInputRef.current?.click()}
            onError={handleImageError}
          />
        )}
      </div>

      <ChatInput
        onSend={onSend}
        isGenerating={isGenerating}
        hasPreview={hasPreview}
        selectedElement={selectedElement}
        onClearSelection={onClearSelection}
        onAttach={handleAttach}
        uploadedImages={uploadedImages}
        onPaste={handlePaste}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        aria-hidden="true"
        id="chat-file-upload"
        name="chat-file-upload"
      />

      {/* Image lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-pointer"
            onClick={closeLightbox}
            role="dialog"
            aria-label="Image preview"
            aria-modal="true"
          >
            <button
              ref={lightboxCloseRef}
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 rounded-lg glass glass-hover transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5 text-zinc-300" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={{ duration: 0.15 }}
              src={lightboxImage}
              alt="Full size inspiration image"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
