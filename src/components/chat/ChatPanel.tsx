"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, X } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean;
}

interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string) => void;
  onPillClick: (pill: string) => void;
  onImageUpload: (base64: string) => void;
  isGenerating: boolean;
  inspoImage: string | null;
}

export function ChatPanel({
  messages,
  onSend,
  onPillClick,
  onImageUpload,
  isGenerating,
  inspoImage,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      onImageUpload(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-700">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`${
                  message.role === "user"
                    ? "bg-indigo-500 text-white ml-auto max-w-[80%]"
                    : "bg-zinc-900 border border-zinc-700 text-zinc-100"
                } rounded-xl p-4 animate-fade-in`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Pills */}
                {message.pills && message.pills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {message.pills.map((pill, idx) => (
                      <button
                        key={idx}
                        onClick={() => onPillClick(pill)}
                        className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-600 transition-colors"
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
                      className="w-full px-4 py-3 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Paperclip className="w-4 h-4" />
                      Upload inspiration image
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2">
              <TypingIndicator />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-950">
        {/* Image preview */}
        {inspoImage && (
          <div className="mb-3 relative inline-block">
            <img
              src={inspoImage}
              alt="Inspiration"
              className="h-16 rounded-lg border border-zinc-700"
            />
            <button
              onClick={() => onImageUpload("")}
              className="absolute -top-2 -right-2 w-5 h-5 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Upload image"
          >
            <Paperclip className="w-5 h-5 text-zinc-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isGenerating}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full transition-colors"
          >
            <ArrowUp className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
