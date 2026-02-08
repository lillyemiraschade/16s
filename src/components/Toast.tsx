"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

const COLORS = {
  success: { bg: "bg-green-500/10", border: "border-green-500/20", icon: "text-green-400", text: "text-green-200" },
  error: { bg: "bg-red-500/10", border: "border-red-500/20", icon: "text-red-400", text: "text-red-200" },
  info: { bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: "text-zinc-400", text: "text-zinc-200" },
  warning: { bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: "text-zinc-400", text: "text-zinc-200" },
} as const;

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 5;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string, duration = DEFAULT_DURATION) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, type, message, duration }]);

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — fixed top-right */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.type];
            const colors = COLORS[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg shadow-black/20 ${colors.bg} ${colors.border}`}
              >
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors.icon}`} />
                <p className={`text-[13px] leading-relaxed flex-1 ${colors.text}`}>{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {/* Auto-dismiss progress bar */}
                {t.duration && t.duration > 0 && (
                  <motion.div
                    className={`absolute bottom-0 left-0 h-0.5 rounded-b-xl ${colors.icon.replace("text-", "bg-")} opacity-30`}
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: t.duration / 1000, ease: "linear" }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
