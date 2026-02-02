"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, X, ImagePlus, Plus, Phone } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import { VoiceCall } from "./VoiceCall";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean | string;
  images?: string[];
}

interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string) => void;
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
  lastAiResponse,
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

  const processFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await readFileAsDataURL(file);
        const compressed = await compressImage(dataUrl);
        onImageUpload(compressed);
      } catch (err) {
        console.error("Failed to process image:", err);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0a0a0b] border-r border-zinc-800/80"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Voice call overlay */}
      {isOnCall && (
        <VoiceCall
          onSend={onSend}
          onHangUp={onEndCall}
          aiResponse={lastAiResponse}
          isGenerating={isGenerating}
        />
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-tight">16</span>
          </div>
          <span className="text-[15px] font-semibold text-zinc-100 tracking-[-0.01em]">16s</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onStartCall}
            disabled={isOnCall}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-150 shadow-sm shadow-indigo-500/20"
            title="Call an agent"
          >
            <Phone className="w-3.5 h-3.5" />
            Call an Agent
          </button>
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 hover:bg-zinc-800 rounded-lg border border-zinc-800/60 transition-all duration-150"
            title="New project"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 relative" role="log" aria-label="Conversation" aria-live="polite">
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 bg-indigo-500/5 border-2 border-dashed border-indigo-500/30 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <ImagePlus className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <p className="text-sm text-indigo-300 font-medium">Drop images here</p>
            </div>
          </div>
        )}

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
                    ? "bg-indigo-500/90 text-white ml-auto max-w-[85%]"
                    : "bg-zinc-900/80 border border-zinc-800/80 text-zinc-200 max-w-[90%]"
                } rounded-2xl px-4 py-3`}
              >
                {/* Attached images */}
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {message.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setLightboxImage(img)}
                        className="rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-400/50 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
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
                        className="px-3.5 py-1.5 text-[13px] font-medium bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 rounded-full border border-zinc-700/60 transition-all duration-150 hover:border-zinc-600"
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
                      className="w-full px-4 py-3 text-[13px] font-medium bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 rounded-xl border border-dashed border-zinc-700/60 transition-all duration-150 flex items-center justify-center gap-2 hover:border-zinc-600"
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
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl px-4 py-3">
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
                  className="rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <img
                    src={img}
                    alt={`Inspiration image ${idx + 1}`}
                    className="h-14 w-14 object-cover ring-1 ring-zinc-700/50"
                  />
                </button>
                <button
                  onClick={() => onImageRemove(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 ring-1 ring-zinc-700/50"
                >
                  <X className="w-3 h-3 text-zinc-300" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-14 w-14 rounded-lg border border-dashed border-zinc-700/50 flex items-center justify-center hover:bg-zinc-900/80 transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-3 py-2 focus-within:border-indigo-500/40 transition-colors">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 mb-0.5 hover:bg-zinc-800/80 rounded-lg transition-colors flex-shrink-0"
            title="Upload images"
          >
            <Paperclip className="w-4 h-4 text-zinc-500" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

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
            placeholder="Describe what you want to build..."
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
            className="p-1.5 mb-0.5 bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-800 disabled:cursor-not-allowed rounded-lg transition-all duration-150 flex-shrink-0"
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4 text-white" />
          </button>
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
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
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
