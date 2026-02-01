"use client";

import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";

type Viewport = "desktop" | "tablet" | "mobile";
type ConversationPhase = "greeting" | "gathering" | "vibe" | "inspo" | "generating" | "iterating";

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
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [isGenerating, setIsGenerating] = useState(false);
  const [inspoImage, setInspoImage] = useState<string | null>(null);
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>("greeting");

  // Initial greeting
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
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      // Call API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          inspoImage,
          currentPreview,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        pills: data.pills,
        showUpload: data.showUpload,
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Update preview if HTML was generated
      if (data.html) {
        setCurrentPreview(data.html);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Can you try again?",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePillClick = (pill: string) => {
    handleSendMessage(pill);
  };

  const handleImageUpload = (base64: string) => {
    setInspoImage(base64 || null);
  };

  const handleViewportChange = (newViewport: Viewport) => {
    setViewport(newViewport);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Chat panel - 1/3 width */}
      <div className="w-1/3">
        <ChatPanel
          messages={messages}
          onSend={handleSendMessage}
          onPillClick={handlePillClick}
          onImageUpload={handleImageUpload}
          isGenerating={isGenerating}
          inspoImage={inspoImage}
        />
      </div>

      {/* Preview panel - 2/3 width */}
      <div className="flex-1">
        <PreviewPanel
          html={currentPreview}
          viewport={viewport}
          onViewportChange={handleViewportChange}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
