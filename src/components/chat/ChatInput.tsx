"use client";

import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, X, MessageSquare, Code2 } from "lucide-react";
import type { SelectedElement, UploadedImage } from "@/lib/types";

interface ChatInputProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
  hasPreview: boolean;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
  onAttach: () => void;
  uploadedImages: UploadedImage[];
  onPaste: (e: React.ClipboardEvent) => void;
  discussionMode?: boolean;
  onToggleDiscussionMode?: () => void;
}

export const ChatInput = memo(function ChatInput({
  onSend,
  isGenerating,
  hasPreview,
  selectedElement,
  onClearSelection,
  onAttach,
  uploadedImages,
  onPaste,
  discussionMode,
  onToggleDiscussionMode,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder = selectedElement
    ? `Edit this ${selectedElement.tagName}...`
    : hasPreview
    ? "Describe what you want to change..."
    : "Describe what you want to build...";

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

  // Focus textarea after generation completes
  useEffect(() => {
    if (!isGenerating) textareaRef.current?.focus();
  }, [isGenerating]);

  // Focus on Cmd+K custom event
  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    window.addEventListener("focus-chat-input", handler);
    return () => window.removeEventListener("focus-chat-input", handler);
  }, []);

  return (
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

      {/* Discussion mode indicator */}
      {discussionMode && (
        <div className="flex items-center gap-1.5 px-4 pb-1 text-[11px] text-blue-400 font-medium">
          <MessageSquare className="w-3 h-3" />
          Chat mode — no code generation
        </div>
      )}

      {/* Input container */}
      <div className={`glass-input-glow rounded-2xl ${discussionMode ? "ring-1 ring-blue-500/20" : ""}`}>
        <div className="flex items-end gap-2 px-4 py-3">
          <button
            onClick={onAttach}
            className="p-2.5 md:p-1.5 mb-0.5 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0"
            title={hasPreview ? "Upload content images (logo, photos)" : "Upload inspiration images"}
            aria-label={hasPreview ? "Upload content images" : "Upload inspiration images"}
          >
            <Paperclip className="w-4 h-4 text-zinc-500" />
          </button>
          <textarea
            ref={textareaRef}
            id="chat-input"
            name="chat-input"
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
            onPaste={onPaste}
            placeholder={placeholder}
            disabled={isGenerating}
            aria-label="Message input"
            autoComplete="off"
            maxLength={10000}
            rows={1}
            className="flex-1 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-40 resize-none overflow-y-auto leading-relaxed"
            style={{ maxHeight: 160 }}
          />
          {onToggleDiscussionMode && (
            <button
              onClick={onToggleDiscussionMode}
              className={`p-2.5 md:p-1.5 mb-0.5 rounded-lg transition-colors flex-shrink-0 ${
                discussionMode
                  ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                  : "hover:bg-white/[0.06] text-zinc-500"
              }`}
              title={discussionMode ? "Switch to build mode" : "Switch to chat-only mode"}
              aria-label={discussionMode ? "Switch to build mode" : "Switch to chat-only mode"}
            >
              {discussionMode ? <Code2 className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={(!input.trim() && uploadedImages.length === 0) || isGenerating}
            className="p-3 md:p-2.5 mb-0.5 bg-green-500/60 hover:bg-green-400/70 disabled:bg-zinc-800/50 disabled:cursor-not-allowed rounded-full transition-all duration-200 flex-shrink-0 glow-green-strong disabled:shadow-none"
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
});
