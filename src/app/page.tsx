"use client";

import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";

type Viewport = "desktop" | "tablet" | "mobile";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean;
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [isGenerating, setIsGenerating] = useState(false);
  const [inspoImages, setInspoImages] = useState<string[]>([]);

  useEffect(() => {
    setMessages([
      {
        id: "initial",
        role: "assistant",
        content: "Hey! What are we building today?",
      },
    ]);
  }, []);

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          inspoImages,
          currentPreview,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        pills: data.pills,
        showUpload: data.showUpload,
      };
      setMessages((prev) => [...prev, aiMessage]);

      if (data.html) {
        if (currentPreview) {
          setPreviewHistory((prev) => [...prev, currentPreview]);
        }
        setCurrentPreview(data.html);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, something went wrong. Can you try again?",
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePillClick = (pill: string) => {
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

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-1/3 min-w-[360px]">
        <ChatPanel
          messages={messages}
          onSend={handleSendMessage}
          onPillClick={handlePillClick}
          onImageUpload={handleImageUpload}
          onImageRemove={handleImageRemove}
          isGenerating={isGenerating}
          inspoImages={inspoImages}
        />
      </div>
      <div className="flex-1">
        <PreviewPanel
          html={currentPreview}
          viewport={viewport}
          onViewportChange={setViewport}
          isGenerating={isGenerating}
          canGoBack={previewHistory.length > 0}
          onBack={handleBack}
        />
      </div>
    </div>
  );
}
