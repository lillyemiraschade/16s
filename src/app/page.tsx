"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";

type Viewport = "desktop" | "tablet" | "mobile";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean;
  images?: string[];
}

const INITIAL_MESSAGE: Message = {
  id: "initial",
  role: "assistant",
  content: "Hey! What are we building today?",
};

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [isGenerating, setIsGenerating] = useState(false);
  const [inspoImages, setInspoImages] = useState<string[]>([]);

  useEffect(() => {
    setMessages([INITIAL_MESSAGE]);
  }, []);

  const handleSendMessage = async (text: string) => {
    const imagesToSend = [...inspoImages];
    setInspoImages([]);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      // Strip images and UI-only fields from message history
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
      const data = JSON.parse(responseText.trim());

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
    setMessages([INITIAL_MESSAGE]);
    setCurrentPreview(null);
    setPreviewHistory([]);
    setInspoImages([]);
  }, []);

  return (
    <div id="main-content" className="flex h-screen overflow-hidden">
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
        />
      </nav>
      <main className="flex-1" aria-label="Preview">
        <PreviewPanel
          html={currentPreview}
          viewport={viewport}
          onViewportChange={setViewport}
          isGenerating={isGenerating}
          canGoBack={previewHistory.length > 0}
          onBack={handleBack}
          onExport={handleExport}
        />
      </main>
    </div>
  );
}
