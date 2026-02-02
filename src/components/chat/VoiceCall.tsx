"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { PhoneOff } from "lucide-react";

type CallState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceCallProps {
  onSend: (text: string) => void;
  onHangUp: () => void;
  aiResponse: string | null;
  isGenerating: boolean;
}

export function VoiceCall({ onSend, onHangUp, aiResponse, isGenerating }: VoiceCallProps) {
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const stateRef = useRef<CallState>("idle");

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const startListening = useCallback(() => {
    if (!mountedRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Stop any existing recognition
    recognitionRef.current?.stop();

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(interimTranscript || finalTranscript);
      if (finalTranscript.trim()) {
        recognition.stop();
        recognitionRef.current = null;
        setState("thinking");
        setTranscript("");
        onSend(finalTranscript.trim());
      }
    };

    recognition.onerror = () => {
      // no-op, onend will handle restart
    };

    recognition.onend = () => {
      // Restart if we're still supposed to be listening (browser may auto-stop)
      if (mountedRef.current && stateRef.current === "listening") {
        try {
          recognition.start();
        } catch {
          // If restart fails, create a fresh one
          recognitionRef.current = null;
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setState("listening");
    } catch {}
  }, [onSend]);

  const speak = useCallback((text: string) => {
    setState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (mountedRef.current) {
        startListening();
      }
    };
    utterance.onerror = () => {
      if (mountedRef.current) startListening();
    };
    speechSynthesis.speak(utterance);
  }, [startListening]);

  // Greeting on mount
  useEffect(() => {
    mountedRef.current = true;
    const greeting = "Hey! Tell me what you want to build.";
    speak(greeting);
    return () => {
      mountedRef.current = false;
      speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When AI responds, speak it
  useEffect(() => {
    if (aiResponse && aiResponse !== lastSpokenRef.current && !isGenerating) {
      lastSpokenRef.current = aiResponse;
      speak(aiResponse);
    }
  }, [aiResponse, isGenerating, speak]);

  // Update state when generating
  useEffect(() => {
    if (isGenerating) setState("thinking");
  }, [isGenerating]);

  const handleHangUp = () => {
    mountedRef.current = false;
    speechSynthesis.cancel();
    recognitionRef.current?.stop();
    onHangUp();
  };

  const statusText: Record<CallState, string> = {
    idle: "Connecting...",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  };

  const pulseScale = state === "listening" ? [1, 1.3, 1] : state === "speaking" ? [1, 1.15, 1] : [1, 1.05, 1];

  return (
    <div className="absolute inset-0 z-20 bg-[#0a0a0b] flex flex-col items-center justify-center gap-8">
      {/* Animated circle */}
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: pulseScale, opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: state === "listening" ? 1.5 : 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-32 h-32 rounded-full bg-indigo-500/20"
        />
        <motion.div
          animate={{ scale: pulseScale }}
          transition={{ duration: state === "listening" ? 1.5 : 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          className="absolute w-24 h-24 rounded-full bg-indigo-500/30"
        />
        <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center">
          <span className="text-white text-sm font-bold">16s</span>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        <p className="text-zinc-200 text-lg font-medium">{statusText[state]}</p>
        {transcript && (
          <p className="text-zinc-500 text-sm mt-2 max-w-[250px] truncate">{transcript}</p>
        )}
      </div>

      {/* Hang up */}
      <button
        onClick={handleHangUp}
        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors"
        title="End call"
      >
        <PhoneOff className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
