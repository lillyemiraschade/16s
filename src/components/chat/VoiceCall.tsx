"use client";

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { motion } from "framer-motion";
import { PhoneOff, Mic, Volume2 } from "lucide-react";

type CallState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
  source?: "voice" | "typed"; // Track if message was typed in chat
}

interface VoiceCallProps {
  onCallComplete: (visibleSummary: string, privateData: string) => void;
  onHangUp: () => void;
}

export interface VoiceCallHandle {
  injectTypedMessage: (text: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function compileCallData(messages: VoiceMessage[]): { visibleSummary: string; privateData: string } {
  // Filter out empty or invalid messages
  const validMessages = messages.filter((m) => m.content && m.content.trim().length > 0);

  // Extract all user info for the private summary (sent to AI but not shown to user)
  const allUserInfo = validMessages
    .filter((m) => m.role === "user")
    .map((m) => {
      const sourceLabel = m.source === "typed" ? "[typed in chat]" : "[spoken]";
      return `${sourceLabel} ${m.content}`;
    });

  // Extract key info from the conversation for structured data
  const fullConversation = validMessages
    .map((m) => `${m.role === "assistant" ? "Agent" : "User"}: ${m.content}`)
    .join("\n");

  // Private data - full details for the AI to use
  // Include a structured summary to help the main chat AI parse the info
  const privateData = `[VOICE CALL TRANSCRIPT - Use this information to build the website, but DO NOT show this raw data to the user]

CONVERSATION:
${fullConversation}

KEY INFO FROM USER:
${allUserInfo.join("\n")}

[END TRANSCRIPT]

Based on this call, please design and build the website. Ask for inspiration images before generating if the user didn't mention them already.`;

  // Visible summary - just a brief note shown in chat
  const userMessageCount = allUserInfo.length;
  const visibleSummary = userMessageCount >= 3
    ? "Great call! I've got all the details. Let me ask one more thing..."
    : userMessageCount > 0
    ? "Got some info from our chat. Let me ask a few more things..."
    : "Quick call! Let's get some more details...";

  return { visibleSummary, privateData };
}

export const VoiceCall = forwardRef<VoiceCallHandle, VoiceCallProps>(
  function VoiceCall({ onCallComplete, onHangUp }, ref) {
    const [state, setState] = useState<CallState>("idle");
    const [transcript, setTranscript] = useState("");
    const [unsupported, setUnsupported] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const mountedRef = useRef(true);
    const stateRef = useRef<CallState>("idle");
    const voiceMessagesRef = useRef<VoiceMessage[]>([]);

    useEffect(() => { stateRef.current = state; }, [state]);
    // Sync ref immediately on every voiceMessages change
    useEffect(() => {
      voiceMessagesRef.current = voiceMessages;
    }, [voiceMessages]);
    // Also update ref synchronously when setting state
    const updateVoiceMessages = useCallback((updater: (prev: VoiceMessage[]) => VoiceMessage[]) => {
      setVoiceMessages((prev) => {
        const next = updater(prev);
        voiceMessagesRef.current = next; // Sync ref immediately
        return next;
      });
    }, []);

    // Timer
    useEffect(() => {
      const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(interval);
    }, []);

    const endCall = useCallback((messages: VoiceMessage[]) => {
      mountedRef.current = false;
      speechSynthesis.cancel();
      recognitionRef.current?.stop();
      const { visibleSummary, privateData } = compileCallData(messages);
      onCallComplete(visibleSummary, privateData);
    }, [onCallComplete]);

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
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interimTranscript += result[0].transcript;
        }
        setTranscript(interimTranscript || finalTranscript);
        if (finalTranscript.trim()) {
          recognition.stop();
          recognitionRef.current = null;
          setState("thinking");
          setTranscript("");

          // Add user message and send to voice API
          const userMessage: VoiceMessage = { role: "user", content: finalTranscript.trim(), source: "voice" };
          updateVoiceMessages((prev) => {
            const updated = [...prev, userMessage];
            sendToVoiceAPI(updated);
            return updated;
          });
        }
      };

      recognition.onerror = () => {};
      recognition.onend = () => {
        if (mountedRef.current && stateRef.current === "listening") {
          try { recognition.start(); } catch { recognitionRef.current = null; }
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); setState("listening"); } catch {}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const speak = useCallback((text: string, onEnd?: () => void) => {
      speechSynthesis.cancel();
      setState("speaking");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.onend = () => {
        if (mountedRef.current) {
          if (onEnd) onEnd();
          else startListening();
        }
      };
      utterance.onerror = () => {
        if (mountedRef.current) {
          if (onEnd) onEnd();
          else startListening();
        }
      };
      speechSynthesis.speak(utterance);
    }, [startListening]);

    const sendToVoiceAPI = useCallback(async (messages: VoiceMessage[], isTypedInput = false) => {
      if (!mountedRef.current) return;

      try {
        const response = await fetch("/api/chat/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceMessages: messages,
            hasTypedInput: isTypedInput,
          }),
        });

        if (!response.ok) throw new Error("Voice API failed");

        const data = await response.json();
        const aiMessage: VoiceMessage = { role: "assistant", content: data.message };

        if (!mountedRef.current) return;

        updateVoiceMessages((prev) => {
          const updated = [...prev, aiMessage];

          // If complete, end the call after speaking the final message
          if (data.complete) {
            speak(data.message, () => endCall(updated));
          } else {
            speak(data.message);
          }

          return updated;
        });
      } catch (error) {
        console.error("Voice API error:", error);
        if (mountedRef.current) {
          speak("Sorry, I didn't catch that. Could you say that again?");
        }
      }
    }, [speak, endCall]);

    // Expose method to inject typed messages from chat
    useImperativeHandle(ref, () => ({
      injectTypedMessage: (text: string) => {
        if (!mountedRef.current) return;

        // Add the typed message to the conversation
        const typedMessage: VoiceMessage = { role: "user", content: text, source: "typed" };
        updateVoiceMessages((prev) => {
          const updated = [...prev, typedMessage];
          // Send to voice API with flag indicating it's typed
          sendToVoiceAPI(updated, true);
          return updated;
        });
      },
    }), [sendToVoiceAPI, updateVoiceMessages]);

    // Initial greeting and setup
    useEffect(() => {
      mountedRef.current = true;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR || !window.speechSynthesis) { setUnsupported(true); return; }

      // Initial greeting
      const greeting = "Hey! Tell me about your project.";
      const initialMessage: VoiceMessage = { role: "assistant", content: greeting };
      updateVoiceMessages(() => [initialMessage]);
      speak(greeting);

      return () => {
        mountedRef.current = false;
        speechSynthesis.cancel();
        recognitionRef.current?.stop();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleHangUp = () => {
      endCall(voiceMessagesRef.current);
    };

    const StateIcon = state === "speaking" ? Volume2 : Mic;

    const statusLabel: Record<CallState, string> = {
      idle: "Connecting...",
      listening: "Listening",
      thinking: "Thinking...",
      speaking: "Speaking",
    };

    if (unsupported) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          className="glass-matte rounded-2xl p-4 max-w-[260px]"
        >
          <p className="text-zinc-300 text-[13px] font-medium">Voice requires Chrome or Edge</p>
          <button onClick={() => onHangUp()} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-zinc-300 glass glass-hover rounded-full transition-all duration-200">
            Dismiss
          </button>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        className="glass-matte rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-black/30"
      >
        {/* Pulsing orb */}
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute w-10 h-10 rounded-full bg-green-500/15"
            animate={{
              scale: state === "listening" ? [1, 1.5, 1] : [1, 1.15, 1],
              opacity: [0.15, 0.4, 0.15],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="w-8 h-8 rounded-full bg-green-500/70 flex items-center justify-center">
            <StateIcon className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Status + timer */}
        <div className="min-w-[80px]">
          <div className="flex items-center gap-2">
            <p className="text-zinc-200 text-[13px] font-medium leading-tight">{statusLabel[state]}</p>
            <span className="text-zinc-500 text-[11px] tabular-nums">{formatTime(elapsed)}</span>
          </div>
          {transcript && (
            <p className="text-zinc-500 text-[11px] truncate max-w-[160px]">{transcript}</p>
          )}
        </div>

        {/* Hang up */}
        <button
          onClick={handleHangUp}
          className="w-8 h-8 rounded-full bg-red-500/60 hover:bg-red-400/70 flex items-center justify-center transition-all duration-200 flex-shrink-0"
          title="End call"
        >
          <PhoneOff className="w-3.5 h-3.5 text-white" />
        </button>
      </motion.div>
    );
  }
);
