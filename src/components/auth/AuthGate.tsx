"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";
import { AuthModal } from "./AuthModal";
import { Loader2 } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { user, loading, isConfigured } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  console.log("[AuthGate] isConfigured:", isConfigured, "loading:", loading, "user:", user?.email ?? "none");

  // If Supabase isn't configured, allow access (dev mode without auth)
  if (!isConfigured) {
    console.log("[AuthGate] Supabase not configured, allowing access");
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="h-screen welcome-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  // If authenticated, show the app
  if (user) {
    console.log("[AuthGate] User authenticated, allowing access");
    return <>{children}</>;
  }

  // Not authenticated - show sign in screen
  return (
    <div className="h-screen welcome-bg flex flex-col">
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <Image src="/logo.png" alt="16s logo" width={32} height={32} className="object-contain" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 w-full max-w-[400px]"
        >
          <Image src="/logo.png" alt="" width={56} height={56} className="object-contain" />

          <div className="text-center">
            <h1 className="text-[28px] font-semibold text-zinc-100 tracking-[-0.02em] mb-2">
              Welcome to 16s
            </h1>
            <p className="text-[14px] text-zinc-400">
              Sign in to start building beautiful websites with AI
            </p>
          </div>

          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full px-6 py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-[14px] font-semibold transition-all"
          >
            Sign in to continue
          </button>

          <p className="text-[12px] text-zinc-500 text-center">
            Your projects are saved securely in the cloud
          </p>
        </motion.div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
