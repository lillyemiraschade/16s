"use client";

import { useState, memo } from "react";
import { motion } from "framer-motion";
import { ImagePlus, Pencil, CheckCircle, AlertCircle, FileText } from "lucide-react";
import type { Message } from "@/lib/types";

interface ChatMessageProps {
  message: Message;
  prevMessage?: Message;
  nextMessage?: Message;
  isGenerating: boolean;
  onPillClick: (pill: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onLightboxOpen: (src: string, trigger: HTMLElement) => void;
  onUploadTrigger: (type: "inspo" | "content", label?: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  prevMessage,
  nextMessage,
  isGenerating,
  onPillClick,
  onEditMessage,
  onLightboxOpen,
  onUploadTrigger,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  // Empty assistant messages are placeholders for streaming — typing indicator handles display
  if (message.role === "assistant" && !message.content) return null;

  const isUser = message.role === "user";
  const isFirstInGroup = !prevMessage || prevMessage.role !== message.role;
  const isLastInGroup = !nextMessage || nextMessage.role !== message.role;
  const isFirst = !prevMessage;

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
      style={isFirst ? { marginTop: 0 } : undefined}
    >
      <div
        className={`${
          isUser
            ? "glass-bubble glass-bubble-user text-green-100 ml-auto max-w-[85%]"
            : "glass-bubble text-zinc-200 max-w-[90%]"
        } ${cornerClass} px-4 py-3`}
      >
        {/* Typed images */}
        {message.uploadedImages && message.uploadedImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {message.uploadedImages.map((img, idx) => (
              <div key={idx} className="relative">
                <button
                  onClick={(e) => onLightboxOpen(img.data, e.currentTarget)}
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

        {/* Legacy images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {message.images.map((img, idx) => (
              <button
                key={idx}
                onClick={(e) => onLightboxOpen(img, e.currentTarget)}
                className="rounded-lg overflow-hidden hover:ring-2 hover:ring-green-500/50 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Inspiration image ${idx + 1}`} className="h-16 w-16 object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Content or edit form */}
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              id={`edit-msg-${message.id}`}
              name="edit-message"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setIsEditing(false); setEditContent(""); }
              }}
              className="w-full bg-black/20 text-[15px] text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500/50 resize-none"
              rows={3}
              maxLength={10000}
              autoFocus
              aria-label="Edit message"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setIsEditing(false); setEditContent(""); }}
                className="px-3 py-1 text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editContent.trim()) {
                    onEditMessage(message.id, editContent.trim());
                    setIsEditing(false);
                    setEditContent("");
                  }
                }}
                disabled={!editContent.trim() || isGenerating}
                className="px-3 py-1 text-[12px] font-medium text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
              >
                Save & Regenerate
              </button>
            </div>
          </div>
        ) : (
          <div className="group/msg relative">
            <p className={`text-[15px] leading-[1.7] whitespace-pre-wrap break-words ${!isUser ? "tracking-[-0.01em] text-zinc-200" : ""}`}>
              {message.content}
            </p>
            {isUser && !isGenerating && (
              <button
                onClick={() => { setIsEditing(true); setEditContent(message.content); }}
                className="absolute -right-1 -top-1 p-1 rounded-full bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100 transition-all"
                title="Edit message"
                aria-label="Edit message"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Plan card */}
        {message.plan && (
          <div className="mt-3 p-4 rounded-xl glass-matte">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-green-500/15 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-green-400" />
              </div>
              <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Build Plan</span>
            </div>
            <p className="text-[14px] text-zinc-200 leading-relaxed mb-3">{message.plan.summary}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {message.plan.sections.map((section, idx) => (
                <span key={idx} className="px-2.5 py-1 text-[11px] font-medium bg-green-500/8 text-green-300/80 rounded-md border border-green-500/10">
                  {section}
                </span>
              ))}
            </div>
            <p className="text-[12px] text-zinc-500 italic">{message.plan.style}</p>
          </div>
        )}

        {/* QA Report */}
        {message.qaReport && (
          <div className={`mt-3 p-4 rounded-xl glass-matte ${
            message.qaReport.status === "all_good" ? "border-green-500/15" : "border-amber-500/15"
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                message.qaReport.status === "all_good" ? "bg-green-500/15" : "bg-amber-500/15"
              }`}>
                {message.qaReport.status === "all_good"
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <span className={`text-[12px] font-semibold uppercase tracking-wider ${
                message.qaReport.status === "all_good" ? "text-green-400/70" : "text-amber-400/70"
              }`}>
                {message.qaReport.status === "all_good" ? "All Checks Passed" : "Review Notes"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {message.qaReport.checks.map((check, idx) => (
                <span key={idx} className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border ${
                  check.passed
                    ? "bg-green-500/8 border-green-500/15 text-green-300/80"
                    : "bg-amber-500/8 border-amber-500/15 text-amber-300/80"
                }`}>
                  {check.passed ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                  {check.name}
                </span>
              ))}
            </div>
            <p className="text-[12px] text-zinc-500">{message.qaReport.summary}</p>
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
                className="px-4 py-2 text-[13px] font-medium glass-pill text-zinc-200 hover:text-white hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-green-500/50 focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-all duration-200"
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
                const label = typeof message.showUpload === "string" ? message.showUpload.toLowerCase() : "";
                const isContent = label.includes("logo") || label.includes("photo") || label.includes("team") ||
                  label.includes("product") || label.includes("work") || label.includes("menu") ||
                  label.includes("food") || label.includes("portfolio");
                onUploadTrigger(isContent ? "content" : "inspo", isContent ? label : undefined);
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
});
