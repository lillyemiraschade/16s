"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, X, ImagePlus, Plus, Phone, Info } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import { processImageFiles } from "@/lib/images";
import type { Message } from "@/lib/types";

interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string, imagesToInclude?: string[]) => void;
  onPillClick: (pill: string) => void;
  onImageUpload: (base64: string) => void;
  onImageRemove: (index: number) => void;
  isGenerating: boolean;
  inspoImages: string[];
  onNewProject: () => void;
  isOnCall: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  lastAiResponse: { text: string; id: number } | null;
  hasPreview: boolean;
}

export function ChatPanel({
  messages,
  onSend,
  onPillClick,
  onImageUpload,
  onImageRemove,
  isGenerating,
  inspoImages,
  onNewProject,
  isOnCall,
  onStartCall,
  onEndCall,
  hasPreview,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const closeLightbox = useCallback(() => setLightboxImage(null), []);

  useEffect(() => {
    if (!lightboxImage) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxImage, closeLightbox]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Focus textarea after generation completes
  useEffect(() => {
    if (!isGenerating) {
      textareaRef.current?.focus();
    }
  }, [isGenerating]);

  const handleSend = () => {
    if ((!input.trim() && inspoImages.length === 0) || isGenerating) return;
    onSend(input.trim() || "Here are my inspiration images. Please design based on these.");
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processImageFiles(files, onImageUpload);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processImageFiles(e.dataTransfer.files, onImageUpload);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const [showCallDisclaimer, setShowCallDisclaimer] = useState(false);

  const handleCallClick = () => {
    if (isOnCall) return;
    setShowCallDisclaimer(true);
  };

  const handleAcceptCall = () => {
    setShowCallDisclaimer(false);
    onStartCall();
  };

  const placeholder = hasPreview
    ? "Describe what you want to change..."
    : "Describe what you want to build...";

  return (
    <div
      className="flex flex-col h-full bg-[#0a0a0b] dot-grid border-r border-white/[0.04] relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Call disclaimer modal */}
      <AnimatePresence>
        {showCallDisclaimer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 max-w-[340px] w-full"
            >
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-green-400" />
                <p className="text-zinc-200 text-[14px] font-medium">Before you call</p>
              </div>
              <p className="text-zinc-400 text-[13px] leading-relaxed mb-5">
                You&apos;ll be speaking with an AI assistant about your project. Your call may be recorded for training and quality purposes.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCallDisclaimer(false)}
                  className="flex-1 px-4 py-2 text-[13px] font-medium text-zinc-400 glass glass-hover rounded-full transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcceptCall}
                  className="flex-1 px-4 py-2 text-[13px] font-medium text-black bg-gradient-to-b from-green-400 to-green-500 hover:from-green-300 hover:to-green-400 rounded-full transition-all duration-200 glow-green"
                >
                  Start call
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.png" alt="16s logo" className="w-8 h-8 object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCallClick}
            disabled={isOnCall}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:text-zinc-100 glass-pill disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-all duration-200"
            title="Talk about the project on the phone"
          >
            <Phone className="w-3.5 h-3.5" />
            Talk on phone
          </button>
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:text-zinc-100 glass-pill rounded-full transition-all duration-200"
            title="New project"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 relative flex flex-col" role="log" aria-label="Conversation" aria-live="polite">
        {/* Spacer pushes messages to bottom when few */}
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

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`${
                  message.role === "user"
                    ? "glass-bubble glass-bubble-user text-green-100 ml-auto max-w-[85%]"
                    : "glass-bubble text-zinc-200 max-w-[90%]"
                } rounded-2xl px-4 py-3`}
              >
                {/* Attached images */}
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {message.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setLightboxImage(img)}
                        className="rounded-lg overflow-hidden hover:ring-2 hover:ring-green-500/50 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                      >
                        <img
                          src={img}
                          alt={`Inspiration image ${idx + 1}`}
                          className="h-16 w-16 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>

                {/* Pills */}
                {message.pills && message.pills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {message.pills.map((pill, idx) => (
                      <button
                        key={idx}
                        onClick={() => onPillClick(pill)}
                        disabled={isGenerating}
                        className="px-3.5 py-1.5 text-[13px] font-medium glass-pill text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-all duration-200"
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                )}

                {/* Upload zone */}
                {message.showUpload && (
                  <div className="mt-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3 text-[13px] font-medium glass-pill text-zinc-300 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <ImagePlus className="w-4 h-4" />
                      {typeof message.showUpload === "string" ? message.showUpload : "Upload inspiration images"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-start"
          >
            <div className="glass-bubble rounded-2xl px-4 py-3">
              <TypingIndicator />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-5 pb-5 pt-3">
        {/* Image previews */}
        {inspoImages.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {inspoImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <button
                  onClick={() => setLightboxImage(img)}
                  className="rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                >
                  <img
                    src={img}
                    alt={`Inspiration image ${idx + 1}`}
                    className="h-14 w-14 object-cover ring-1 ring-white/[0.06]"
                  />
                </button>
                <button
                  onClick={() => onImageRemove(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ring-1 ring-white/[0.06]"
                  aria-label={`Remove image ${idx + 1}`}
                >
                  <X className="w-3 h-3 text-zinc-300" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-14 w-14 rounded-lg glass glass-hover flex items-center justify-center transition-all duration-200"
              aria-label="Add more images"
            >
              <ImagePlus className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        )}

        {/* Input container — glass with green glow border */}
        <div className="glass-input-glow rounded-2xl p-1">
          <div className="flex items-end gap-2 px-3 py-2">
            <img src="/logo.png" alt="" className="w-6 h-6 object-contain mb-1 opacity-30 flex-shrink-0" aria-hidden="true" />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = textareaRef.current;
                if (el) {
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 160) + "px";
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isGenerating}
              aria-label="Message input"
              autoComplete="off"
              rows={1}
              className="flex-1 bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-40 resize-none overflow-y-auto leading-relaxed"
              style={{ maxHeight: 160 }}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && inspoImages.length === 0) || isGenerating}
              className="p-2 mb-0.5 bg-green-500/60 hover:bg-green-400/70 disabled:bg-zinc-800/50 disabled:cursor-not-allowed rounded-full transition-all duration-200 flex-shrink-0 glow-green-strong disabled:shadow-none"
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4 text-white" />
            </button>
          </div>
          {/* Toolbar row */}
          <div className="flex items-center gap-1 px-3 pb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors flex-shrink-0"
              title="Upload images"
              aria-label="Upload images"
            >
              <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

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
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 rounded-lg glass glass-hover transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5 text-zinc-300" />
            </button>
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
}
