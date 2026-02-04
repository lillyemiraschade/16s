"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Github, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

type AuthMode = "signin" | "signup";

export function AuthModal({ isOpen, onClose, title, subtitle }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { signInWithEmail, signUpWithEmail, signInWithOAuth } = useAuth();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = mode === "signin"
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password);

    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (mode === "signup") {
      setMessage("Check your email for a confirmation link!");
    } else {
      onClose();
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await signInWithOAuth(provider);
      if (error) {
        console.error("[OAuth] Error:", error.message);
        setError(error.message);
        setLoading(false);
        return;
      }

      // If we're still here after 3 seconds, the redirect didn't happen
      // This catches silent failures where OAuth doesn't initiate properly
      setTimeout(() => {
        setLoading(false);
        setError("Sign in failed to start. Please check that popups are allowed and try again.");
      }, 3000);
    } catch (err) {
      console.error("[OAuth] Exception:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setMessage(null);
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    resetForm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-[380px] pointer-events-auto">
            <div className="glass-matte rounded-2xl p-6 shadow-2xl shadow-black/40">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-zinc-100">
                  {title || (mode === "signin" ? "Sign in" : "Create account")}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-zinc-700/50 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
              {subtitle && (
                <p className="text-[13px] text-zinc-400 mb-6">{subtitle}</p>
              )}
              {!subtitle && <div className="mb-4" />}

              {/* OAuth buttons */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => handleOAuth("google")}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass glass-hover transition-all text-[13px] font-medium text-zinc-200 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <button
                  onClick={() => handleOAuth("github")}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass glass-hover transition-all text-[13px] font-medium text-zinc-200 disabled:opacity-50"
                >
                  <Github className="w-4 h-4" />
                  Continue with GitHub
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-zinc-700/50" />
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-zinc-700/50" />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full px-4 py-2.5 rounded-xl glass text-[13px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 rounded-xl glass text-[13px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-[12px] px-1">{error}</p>
                )}

                {message && (
                  <p className="text-green-400 text-[12px] px-1">{message}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-[13px] font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {mode === "signin" ? "Sign in with Email" : "Create account"}
                </button>
              </form>

              {/* Switch mode */}
              <p className="text-center text-[12px] text-zinc-500 mt-4">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={switchMode}
                  className="text-zinc-300 hover:text-white transition-colors"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
