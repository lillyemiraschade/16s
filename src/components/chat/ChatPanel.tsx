"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, X, ImagePlus } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean;
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
}

export function ChatPanel({
  messages,
  onSend,
  onPillClick,
  onImageUpload,
  onImageRemove,
  isGenerating,
  inspoImages,
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
    if ((!input.trim() && inspoImages.length === 0) || isGenerating) return;
    onSend(input.trim() || "Here are my inspiration images. Please design based on these.");
    setInput("");
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

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so the same files can be selected again
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="flex flex-col h-full bg-zinc-950 border-r border-zinc-700"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-100">16s</h1>
      </div>

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
                } rounded-xl p-4`}
              >
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Inspo ${idx + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border border-zinc-600"
                      />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Pills */}
                {message.pills && message.pills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {message.pills.map((pill, idx) => (
                      <button
                        key={idx}
                        onClick={() => onPillClick(pill)}
                        className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-full border border-zinc-600 transition-colors"
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
                      className="w-full px-4 py-3 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-dashed border-zinc-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <ImagePlus className="w-4 h-4" />
                      Upload inspiration images
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

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
        {/* Image previews */}
        {inspoImages.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {inspoImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img}
                  alt={`Inspo ${idx + 1}`}
                  className="h-14 w-14 object-cover rounded-lg border border-zinc-700"
                />
                <button
                  onClick={() => onImageRemove(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-14 w-14 rounded-lg border border-dashed border-zinc-600 flex items-center justify-center hover:bg-zinc-800 transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Upload inspo images"
          >
            <Paperclip className="w-5 h-5 text-zinc-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isGenerating}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && inspoImages.length === 0) || isGenerating}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-full transition-colors"
          >
            <ArrowUp className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
