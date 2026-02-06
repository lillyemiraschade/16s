"use client";

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { motion } from "framer-motion";
import { PhoneOff, Mic, Volume2 } from "lucide-react";

type CallState = "idle" | "listening" | "thinking" | "speaking" | "error";

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

  // Check if user provided substantive responses (more than just "yes", "no", "ok", etc.)
  const substantiveResponses = allUserInfo.filter((info) => {
    const content = info.replace(/\[.*?\]\s*/, "").trim().toLowerCase();
    const trivialResponses = ["yes", "no", "ok", "okay", "sure", "yeah", "yep", "nope", "uh", "um", "hmm"];
    return content.length > 10 || !trivialResponses.includes(content);
  });

  // Extract key info from the conversation for structured data
  const fullConversation = validMessages
    .map((m) => `${m.role === "assistant" ? "Agent" : "User"}: ${m.content}`)
    .join("\n");

  // Determine if we actually got useful information
  const hasSubstantiveInfo = substantiveResponses.length > 0;
  const userMessageCount = allUserInfo.length;

  // Private data - full details for the AI to use
  // Be honest about what was gathered
  const privateData = hasSubstantiveInfo
    ? `[VOICE CALL TRANSCRIPT - Use this information to build the website, but DO NOT show this raw data to the user]

CONVERSATION:
${fullConversation}

KEY INFO FROM USER:
${allUserInfo.join("\n")}

[END TRANSCRIPT]

Based on this call, please design and build the website. Ask for inspiration images before generating if the user didn't mention them already.`
    : `[VOICE CALL TRANSCRIPT - The call ended but limited information was gathered]

CONVERSATION:
${fullConversation || "(No conversation recorded)"}

[END TRANSCRIPT]

The call ended early or the user provided minimal information. Please ask the user to provide more details about what they want to build.`;

  // Visible summary - be honest about what was actually gathered
  let visibleSummary: string;
  if (!hasSubstantiveInfo) {
    visibleSummary = userMessageCount > 0
      ? "The call ended. I may have missed some details - could you type out what you're looking for?"
      : "The call ended before I could gather details. What would you like to build?";
  } else if (substantiveResponses.length >= 3) {
    visibleSummary = "Thanks for the info! Let me see if I need anything else...";
  } else {
    visibleSummary = "Got some initial details. I may have a few follow-up questions...";
  }

  return { visibleSummary, privateData };
}

export const VoiceCall = forwardRef<VoiceCallHandle, VoiceCallProps>(
  function VoiceCall({ onCallComplete, onHangUp }, ref) {
    const [state, setState] = useState<CallState>("idle");
    const [transcript, setTranscript] = useState("");
    const [unsupported, setUnsupported] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      // Accumulate transcript and use silence detection
      let accumulatedTranscript = "";
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      const SILENCE_TIMEOUT = 1500; // Wait 1.5s of silence before processing

      const processTranscript = () => {
        if (accumulatedTranscript.trim()) {
          recognition.stop();
          recognitionRef.current = null;
          setState("thinking");
          const finalText = accumulatedTranscript.trim();
          setTranscript("");
          accumulatedTranscript = "";

          // Add user message and send to voice API
          const userMessage: VoiceMessage = { role: "user", content: finalText, source: "voice" };
          updateVoiceMessages((prev) => {
            const updated = [...prev, userMessage];
            sendToVoiceAPI(updated);
            return updated;
          });
        }
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Clear previous silence timer
        if (silenceTimer) clearTimeout(silenceTimer);

        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interimTranscript += result[0].transcript;
        }

        // Accumulate final transcripts
        if (finalTranscript) {
          accumulatedTranscript += " " + finalTranscript;
        }

        // Show current transcript (accumulated + interim)
        setTranscript((accumulatedTranscript + " " + interimTranscript).trim());

        // Set silence timer - process when user stops speaking
        silenceTimer = setTimeout(() => {
          if (accumulatedTranscript.trim()) {
            processTranscript();
          }
        }, SILENCE_TIMEOUT);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        if (!mountedRef.current) return;

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setErrorMessage("Microphone access denied. Please allow microphone access.");
          setState("error");
        } else if (event.error === "no-speech") {
          // No speech detected - just restart listening
          if (stateRef.current === "listening") {
            try { recognition.start(); } catch { /* ignore */ }
          }
        } else if (event.error === "network") {
          setErrorMessage("Network error. Check your connection.");
          setState("error");
        } else if (event.error === "audio-capture") {
          setErrorMessage("No microphone found. Please connect a microphone.");
          setState("error");
        }
      };
      recognition.onend = () => {
        if (mountedRef.current && stateRef.current === "listening") {
          try { recognition.start(); } catch {
            console.error("Failed to restart recognition");
            recognitionRef.current = null;
          }
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setState("listening");
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setErrorMessage("Could not start voice recognition.");
        setState("error");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const speak = useCallback((text: string, onEnd?: () => void) => {
      speechSynthesis.cancel();
      setState("speaking");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1;

      // Timeout to prevent speech synthesis from hanging
      const maxDuration = Math.max(10000, text.length * 100); // At least 10s, or ~100ms per character
      const timeoutId = setTimeout(() => {
        console.warn("Speech synthesis timeout, forcing end");
        speechSynthesis.cancel();
        if (mountedRef.current) {
          if (onEnd) onEnd();
          else startListening();
        }
      }, maxDuration);

      utterance.onend = () => {
        clearTimeout(timeoutId);
        if (mountedRef.current) {
          if (onEnd) onEnd();
          else startListening();
        }
      };
      utterance.onerror = (event) => {
        clearTimeout(timeoutId);
        console.error("Speech synthesis error:", event);
        if (mountedRef.current) {
          if (onEnd) onEnd();
          else startListening();
        }
      };
      speechSynthesis.speak(utterance);
    }, [startListening]);

    const sendToVoiceAPI = useCallback(async (messages: VoiceMessage[], isTypedInput = false) => {
      if (!mountedRef.current) return;

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch("/api/chat/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceMessages: messages,
            hasTypedInput: isTypedInput,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`Voice API failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Don't claim to have received info if the message is empty
        if (!data.message || data.message.trim() === "") {
          console.warn("[VoiceCall] Empty response from API");
          speak("I didn't catch that. Could you repeat what you said?");
          return;
        }

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
        clearTimeout(timeoutId);
        console.error("Voice API error:", error);
        if (!mountedRef.current) return;

        if (error instanceof Error && error.name === "AbortError") {
          setErrorMessage("Request timed out. Please try again.");
          setState("error");
        } else {
          // Recoverable error - try to continue the call
          speak("Sorry, I had trouble hearing that. Could you say it again?");
        }
      }
    }, [speak, endCall, updateVoiceMessages]);

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
      error: "Error",
    };

    if (unsupported) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          className="glass-matte rounded-2xl p-4 max-w-[260px]"
        >
          <p className="text-zinc-300 text-[13px] font-medium">Voice requires Chrome, Edge, or Safari 14.1+</p>
          <button onClick={() => onHangUp()} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-zinc-300 glass glass-hover rounded-full transition-all duration-200">
            Dismiss
          </button>
        </motion.div>
      );
    }

    if (state === "error") {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          className="glass-matte rounded-2xl p-4 max-w-[280px]"
        >
          <p className="text-red-400 text-[13px] font-medium mb-1">Voice Error</p>
          <p className="text-zinc-400 text-[12px]">{errorMessage || "Something went wrong"}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                setErrorMessage(null);
                setState("idle");
                startListening();
              }}
              className="px-3 py-1.5 text-[12px] font-medium text-zinc-300 glass glass-hover rounded-full transition-all duration-200"
            >
              Retry
            </button>
            <button
              onClick={handleHangUp}
              className="px-3 py-1.5 text-[12px] font-medium text-red-400 glass glass-hover rounded-full transition-all duration-200"
            >
              End Call
            </button>
          </div>
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
          aria-label="End call"
        >
          <PhoneOff className="w-3.5 h-3.5 text-white" />
        </button>
      </motion.div>
    );
  }
);
