"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, X, ImagePlus, Plus, Phone, Info, ChevronDown, Trash2, Pencil } from "lucide-react";
import Image from "next/image";
import { TypingIndicator } from "./TypingIndicator";
import { processImageFiles } from "@/lib/images";
import type { Message, SavedProjectMeta, SelectedElement, UploadedImage } from "@/lib/types";

interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string, imagesToInclude?: UploadedImage[]) => void;
  onPillClick: (pill: string) => void;
  onImageUpload: (base64: string, type?: "inspo" | "content", label?: string) => void;
  onImageRemove: (index: number) => void;
  onImageTypeToggle: (index: number) => void;
  isGenerating: boolean;
  uploadedImages: UploadedImage[];
  onNewProject: () => void;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  savedProjects: SavedProjectMeta[];
  currentProjectId: string | null;
  isOnCall: boolean;
  onStartCall: () => void;
  hasPreview: boolean;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
  onEditMessage: (messageId: string, newContent: string) => void;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ChatPanel({
  messages,
  onSend,
  onPillClick,
  onImageUpload,
  onImageRemove,
  onImageTypeToggle,
  isGenerating,
  uploadedImages,
  onNewProject,
  onLoadProject,
  onDeleteProject,
  savedProjects,
  currentProjectId,
  isOnCall,
  onStartCall,
  hasPreview,
  selectedElement,
  onClearSelection,
  onEditMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showCallDisclaimer, setShowCallDisclaimer] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadContext, setUploadContext] = useState<{ type: "inspo" | "content"; label?: string }>({ type: "inspo" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

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
    if ((!input.trim() && uploadedImages.length === 0) || isGenerating) return;
    onSend(input.trim() || "Here are my images.");
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageError = useCallback((msg: string) => {
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 4000);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    // Use uploadContext to determine image type
    const uploadWithType = (base64: string) => {
      onImageUpload(base64, uploadContext.type, uploadContext.label);
    };
    processImageFiles(files, uploadWithType, handleImageError);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const uploadWithType = (base64: string) => {
      onImageUpload(base64, uploadContext.type, uploadContext.label);
    };
    processImageFiles(e.dataTransfer.files, uploadWithType, handleImageError);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Close project menu on outside click or Escape
  useEffect(() => {
    if (!showProjectMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowProjectMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showProjectMenu]);

  const handleCallClick = () => {
    if (isOnCall) return;
    setShowCallDisclaimer(true);
  };

  const handleAcceptCall = () => {
    setShowCallDisclaimer(false);
    onStartCall();
  };

  const placeholder = selectedElement
    ? `Edit this ${selectedElement.tagName}...`
    : hasPreview
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
          <Image src="/logo.png" alt="16s logo" width={32} height={32} className="object-contain" />
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
          <div className="relative" ref={projectMenuRef}>
            <button
              onClick={() => setShowProjectMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:text-zinc-100 glass-pill rounded-full transition-all duration-200"
              title="Projects"
            >
              <Plus className="w-3.5 h-3.5" />
              New
              <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {showProjectMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full right-0 mt-1 z-30 glass rounded-xl overflow-hidden min-w-[220px] py-1 shadow-xl shadow-black/40"
                >
                  <button
                    onClick={() => { onNewProject(); setShowProjectMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-green-400 hover:bg-white/[0.04] transition-colors font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Project
                  </button>
                  {savedProjects.length > 0 && (
                    <>
                      <div className="h-px bg-white/[0.06] mx-3 my-1" />
                      <div className="max-h-[240px] overflow-y-auto">
                        {savedProjects.map((proj) => (
                          <div
                            key={proj.id}
                            className={`flex items-center gap-2 px-4 py-2 hover:bg-white/[0.04] transition-colors group ${
                              proj.id === currentProjectId ? "bg-green-500/10" : ""
                            }`}
                          >
                            <button
                              onClick={() => { onLoadProject(proj.id); setShowProjectMenu(false); }}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className={`text-[13px] truncate ${proj.id === currentProjectId ? "text-green-400 font-medium" : "text-zinc-300"}`}>
                                {proj.name}
                              </div>
                              <div className="text-[11px] text-zinc-600">{formatRelativeTime(proj.updatedAt)}</div>
                            </button>
                            {deleteConfirmId === proj.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id); setDeleteConfirmId(null); }}
                                  className="px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 rounded transition-colors"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                  className="px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(proj.id); }}
                                className="p-1 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                title="Delete project"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 relative flex flex-col" role="log" aria-label="Conversation" aria-live="polite">
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

        {/* Upload error toast */}
        <AnimatePresence>
          {uploadError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 left-4 right-4 z-20 glass rounded-xl px-4 py-3 border border-red-500/20"
            >
              <p className="text-[13px] text-red-400">{uploadError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {messages.map((message, index) => {
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const isFirstInGroup = !prev || prev.role !== message.role;
            const isLastInGroup = !next || next.role !== message.role;
            const isUser = message.role === "user";

            const cornerClass = isLastInGroup
              ? isUser ? "bubble-tail-right" : "bubble-tail-left"
              : isUser ? "bubble-grouped-right" : "bubble-grouped-left";

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex ${isUser ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-4" : "mt-1.5"}`}
                style={index === 0 ? { marginTop: 0 } : undefined}
              >
                <div
                  className={`${
                    isUser
                      ? "glass-bubble glass-bubble-user text-green-100 ml-auto max-w-[85%]"
                      : "glass-bubble text-zinc-200 max-w-[90%]"
                  } ${cornerClass} px-4 py-3`}
                >
                  {/* Attached images (new typed format) */}
                  {message.uploadedImages && message.uploadedImages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {message.uploadedImages.map((img, idx) => (
                        <div key={idx} className="relative">
                          <button
                            onClick={() => setLightboxImage(img.data)}
                            className="rounded-lg overflow-hidden hover:ring-2 hover:ring-green-500/50 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.data}
                              alt={`${img.type === "content" ? "Content" : "Inspiration"} image ${idx + 1}`}
                              className="h-16 w-16 object-cover"
                            />
                          </button>
                          <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-medium rounded ${
                            img.type === "content" ? "bg-green-500/80 text-white" : "bg-zinc-700 text-zinc-300"
                          }`}>
                            {img.type === "content" ? (img.label || "content") : "inspo"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Legacy attached images */}
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {message.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setLightboxImage(img)}
                          className="rounded-lg overflow-hidden hover:ring-2 hover:ring-green-500/50 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`Inspiration image ${idx + 1}`}
                            className="h-16 w-16 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Message content or edit form */}
                  {editingMessageId === message.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full bg-black/20 text-[15px] text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500/50 resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditingMessageId(null); setEditingContent(""); }}
                          className="px-3 py-1 text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (editingContent.trim()) {
                              onEditMessage(message.id, editingContent.trim());
                              setEditingMessageId(null);
                              setEditingContent("");
                            }
                          }}
                          disabled={!editingContent.trim() || isGenerating}
                          className="px-3 py-1 text-[12px] font-medium text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
                        >
                          Save & Regenerate
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group/msg relative">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                      {isUser && !isGenerating && (
                        <button
                          onClick={() => { setEditingMessageId(message.id); setEditingContent(message.content); }}
                          className="absolute -right-1 -top-1 p-1 rounded-full bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 opacity-0 group-hover/msg:opacity-100 transition-all"
                          title="Edit message"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Pills */}
                  {message.pills && message.pills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.pills.map((pill, idx) => (
                        <button
                          key={idx}
                          onClick={() => onPillClick(pill)}
                          disabled={isGenerating}
                          className="px-4 py-2 text-[13px] font-medium glass-pill text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-all duration-200"
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
                        onClick={() => {
                          // Determine if this is content (logo, photos, etc.) or inspo based on label
                          const label = typeof message.showUpload === "string" ? message.showUpload.toLowerCase() : "";
                          const isContent = label.includes("logo") || label.includes("photo") || label.includes("team") ||
                                          label.includes("product") || label.includes("work") || label.includes("menu") ||
                                          label.includes("food") || label.includes("portfolio");
                          setUploadContext({
                            type: isContent ? "content" : "inspo",
                            label: isContent ? label : undefined
                          });
                          fileInputRef.current?.click();
                        }}
                        className="w-full px-4 py-3 text-[13px] font-medium glass-pill text-zinc-300 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <ImagePlus className="w-4 h-4" />
                        {typeof message.showUpload === "string" ? message.showUpload : "Upload inspiration images"}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-start mt-4"
          >
            <div className="glass-bubble bubble-tail-left px-4 py-3">
              <TypingIndicator />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-5 pb-5 pt-3">
        {/* Selected element indicator */}
        <AnimatePresence>
          {selectedElement && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-green-400 bg-green-500/20 rounded">
                  {selectedElement.tagName}
                </span>
                <span className="text-[12px] text-zinc-400 truncate flex-1">
                  {selectedElement.textContent?.slice(0, 30) || selectedElement.className?.split(" ")[0] || "Element selected"}
                </span>
                <button
                  onClick={onClearSelection}
                  className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image previews */}
        {uploadedImages.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {uploadedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <button
                  onClick={() => setLightboxImage(img.data)}
                  className="rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.data}
                    alt={`${img.type === "content" ? "Content" : "Inspiration"} image ${idx + 1}`}
                    className="h-14 w-14 object-cover ring-1 ring-white/[0.06]"
                  />
                </button>
                <button
                  onClick={() => onImageTypeToggle(idx)}
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-medium rounded cursor-pointer hover:opacity-80 transition-opacity ${
                    img.type === "content" ? "bg-green-500/80 text-white" : "bg-zinc-700 text-zinc-300"
                  }`}
                  title="Click to toggle: inspo (design reference) / content (use in website)"
                >
                  {img.type === "content" ? (img.label || "content") : "inspo"}
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
        <div className="glass-input-glow rounded-2xl">
          <div className="flex items-end gap-2 px-4 py-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 mb-0.5 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0"
              title="Upload images"
              aria-label="Upload images"
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
              aria-hidden="true"
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
              placeholder={placeholder}
              disabled={isGenerating}
              aria-label="Message input"
              autoComplete="off"
              rows={1}
              className="flex-1 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-40 resize-none overflow-y-auto leading-relaxed"
              style={{ maxHeight: 160 }}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && uploadedImages.length === 0) || isGenerating}
              className="p-2.5 mb-0.5 bg-green-500/60 hover:bg-green-400/70 disabled:bg-zinc-800/50 disabled:cursor-not-allowed rounded-full transition-all duration-200 flex-shrink-0 glow-green-strong disabled:shadow-none"
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4 text-white" />
            </button>
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
}
