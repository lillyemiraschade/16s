"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { processImageFiles } from "@/lib/images";
import type { UploadedImage } from "@/lib/types";

const HEADLINES = [
  "What shall we build?",
  "What idea should we bring to life?",
  "Ready to design something new?",
  "What\u2019s the vision?",
  "Let\u2019s build something together.",
  "Describe your dream site.",
  "What are we creating today?",
  "Got a project in mind?",
];

// Evocative examples that hint at design quality and diversity
const IDEA_POOL = [
  "A Tokyo ramen shop with a moody, editorial menu layout",
  "A brutalist architect's portfolio with raw concrete vibes",
  "A landing page for an AI startup called Nexus",
  "A luxury day spa called Sage & Stone",
  "A criminal defense law firm with a bold, authoritative feel",
  "A Brooklyn coffee roaster with vintage typography",
  "A fitness studio with high-energy dark theme and neon accents",
  "A Napa Valley winery with elegant serif type and earth tones",
  "A freelance photographer's portfolio with full-bleed galleries",
  "A SaaS dashboard landing page with glassmorphism",
  "A plant shop called Verdant with botanical illustrations",
  "A tattoo artist portfolio with dark industrial aesthetic",
  "A Nashville recording studio with warm analog vibes",
  "A meditation app with calming gradients and gentle animations",
  "A sneaker resale store with bold streetwear energy",
  "A wedding planner called Paper & Lace",
  "A craft brewery with hand-drawn label illustrations",
  "A personal blog with magazine-style editorial layout",
  "A coworking space with clean Scandinavian design",
  "An interior design firm with asymmetric bento grid layout",
  "A food truck collective with colorful illustrated menu cards",
  "A ceramics studio with warm earthy tones and texture",
  "A tech conference with bold geometric branding",
  "A pet adoption nonprofit with playful, friendly design",
  "A vintage record shop with retro 70s typography",
  "A real estate firm specializing in luxury lofts",
  "A podcast network with dark mode and audio player",
  "A bookshop called The Last Page with literary charm",
  "A meal prep service with clean, health-focused design",
  "A film production company with cinematic full-bleed layout",
];

function getRandomIdeas(count: number): string[] {
  const shuffled = [...IDEA_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

interface UseWelcomeOptions {
  uploadedImages: UploadedImage[];
  isGenerating: boolean;
  onSend: (text: string, images?: UploadedImage[]) => void;
  onImageUpload: (base64: string, type?: "inspo" | "content", label?: string) => void;
}

export function useWelcome({ uploadedImages, isGenerating, onSend, onImageUpload }: UseWelcomeOptions) {
  // Randomized on client only to avoid hydration mismatch
  const [headline, setHeadline] = useState(HEADLINES[0]);
  const [randomIdeas, setRandomIdeas] = useState<string[]>([]);
  useEffect(() => {
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
    setRandomIdeas(getRandomIdeas(8));
  }, []);

  const [welcomeInput, setWelcomeInput] = useState("");
  const [welcomeError, setWelcomeError] = useState<string | null>(null);

  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeFileRef = useRef<HTMLInputElement>(null);
  const welcomeErrorTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleWelcomeError = useCallback((msg: string) => {
    clearTimeout(welcomeErrorTimerRef.current);
    setWelcomeError(msg);
    welcomeErrorTimerRef.current = setTimeout(() => setWelcomeError(null), 6000);
  }, []);

  const handleWelcomeSend = useCallback(() => {
    if ((!welcomeInput.trim() && uploadedImages.length === 0) || isGenerating) return;
    const text = welcomeInput.trim() || "Here are my images.";
    const imgs = [...uploadedImages];
    setWelcomeInput("");
    onSend(text, imgs);
  }, [welcomeInput, uploadedImages, isGenerating, onSend]);

  const handleWelcomeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleWelcomeSend();
    }
  }, [handleWelcomeSend]);

  const handleWelcomePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    processImageFiles(imageFiles, onImageUpload, handleWelcomeError);
  }, [onImageUpload, handleWelcomeError]);

  const handleWelcomeFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processImageFiles(e.target.files, onImageUpload, handleWelcomeError);
      e.target.value = "";
    }
  }, [onImageUpload, handleWelcomeError]);

  const handleWelcomeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    processImageFiles(e.dataTransfer.files, onImageUpload, handleWelcomeError);
  }, [onImageUpload, handleWelcomeError]);

  const resetWelcome = useCallback(() => {
    setWelcomeInput("");
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  }, []);

  return {
    headline,
    randomIdeas,
    welcomeInput,
    setWelcomeInput,
    welcomeError,
    setWelcomeError,
    welcomeTextareaRef,
    welcomeFileRef,
    handleWelcomeSend,
    handleWelcomeKeyDown,
    handleWelcomePaste,
    handleWelcomeError,
    handleWelcomeFileUpload,
    handleWelcomeDrop,
    resetWelcome,
  };
}
