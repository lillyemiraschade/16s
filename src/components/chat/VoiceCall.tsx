"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { PhoneOff, Mic, Volume2 } from "lucide-react";

type CallState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceCallProps {
  onSend: (text: string) => void;
  onHangUp: () => void;
  aiResponse: { text: string; id: number } | null;
  isGenerating: boolean;
}

export function VoiceCall({ onSend, onHangUp, aiResponse, isGenerating }: VoiceCallProps) {
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastSpokenRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const stateRef = useRef<CallState>("idle");
  const onSendRef = useRef(onSend);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  const startListening = useCallback(() => {
    if (!mountedRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

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
        onSendRef.current(finalTranscript.trim());
      }
    };

    recognition.onerror = () => {};

    recognition.onend = () => {
      if (mountedRef.current && stateRef.current === "listening") {
        try {
          recognition.start();
        } catch {
          recognitionRef.current = null;
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setState("listening");
    } catch {}
  }, []);

  const speak = useCallback((text: string) => {
    speechSynthesis.cancel();
    setState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (mountedRef.current) startListening();
    };
    utterance.onerror = () => {
      if (mountedRef.current) startListening();
    };
    speechSynthesis.speak(utterance);
  }, [startListening]);

  useEffect(() => {
    mountedRef.current = true;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !window.speechSynthesis) {
      setUnsupported(true);
      return;
    }
    speak("Hey! Tell me about your project.");
    return () => {
      mountedRef.current = false;
      speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (aiResponse && aiResponse.id !== lastSpokenRef.current && !isGenerating) {
      lastSpokenRef.current = aiResponse.id;
      speak(aiResponse.text);
    }
  }, [aiResponse, isGenerating, speak]);

  useEffect(() => {
    if (isGenerating) setState("thinking");
  }, [isGenerating]);

  const handleHangUp = () => {
    mountedRef.current = false;
    speechSynthesis.cancel();
    recognitionRef.current?.stop();
    onHangUp();
  };

  const stateIcon = state === "listening" ? Mic : state === "speaking" ? Volume2 : Mic;
  const StateIcon = stateIcon;

  const statusLabel: Record<CallState, string> = {
    idle: "Connecting...",
    listening: "Listening",
    thinking: "Thinking...",
    speaking: "Speaking",
  };

  if (unsupported) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="absolute bottom-4 left-4 z-30 glass rounded-2xl p-4 max-w-[260px]"
      >
        <p className="text-zinc-300 text-[13px] font-medium">Voice requires Chrome or Edge</p>
        <button
          onClick={handleHangUp}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-zinc-300 glass glass-hover rounded-full transition-all duration-200"
        >
          Dismiss
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="absolute bottom-20 left-4 z-30 glass rounded-2xl p-3 flex items-center gap-3"
    >
      {/* Pulsing status orb */}
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute w-10 h-10 rounded-full bg-green-500/20"
          animate={{
            scale: state === "listening" ? [1, 1.4, 1] : [1, 1.1, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="w-8 h-8 rounded-full bg-gradient-to-b from-green-400 to-green-600 flex items-center justify-center glow-green">
          <StateIcon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      {/* Status text */}
      <div className="min-w-[80px]">
        <p className="text-zinc-200 text-[13px] font-medium leading-tight">{statusLabel[state]}</p>
        {transcript && (
          <p className="text-zinc-500 text-[11px] truncate max-w-[140px]">{transcript}</p>
        )}
      </div>

      {/* Hang up */}
      <button
        onClick={handleHangUp}
        className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-400 flex items-center justify-center transition-all duration-200 flex-shrink-0"
        title="End call"
      >
        <PhoneOff className="w-3.5 h-3.5 text-white" />
      </button>
    </motion.div>
  );
}
