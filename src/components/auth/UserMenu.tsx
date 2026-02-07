"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Cloud, HardDrive, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { AuthModal } from "./AuthModal";

export function UserMenu() {
  const { user, loading, signOut, isConfigured, credits } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showDropdown]);

  if (loading) {
    return (
      <div className="w-7 h-7 rounded-full bg-white/[0.04] animate-pulse" />
    );
  }

  // Auth not configured - show simple local indicator
  if (!isConfigured) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium text-zinc-500">
        <HardDrive className="w-3 h-3" />
        <span>Local</span>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all duration-150"
        >
          <User className="w-3.5 h-3.5" />
          <span>Sign in</span>
        </button>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="User menu"
        aria-expanded={showDropdown}
        aria-haspopup="true"
        className="flex items-center gap-2 px-1.5 md:px-2 py-1 rounded-lg hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-green-500/50 transition-all duration-150"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-7 h-7 md:w-6 md:h-6 rounded-full ring-1 ring-white/10"
          />
        ) : (
          <div className="w-7 h-7 md:w-6 md:h-6 rounded-full bg-zinc-700 flex items-center justify-center ring-1 ring-white/10">
            <User className="w-3.5 h-3.5 md:w-3 md:h-3 text-zinc-400" />
          </div>
        )}
        <span className="text-[12px] md:text-[11px] font-medium text-zinc-300 max-w-[100px] truncate hidden sm:block">
          {displayName}
        </span>
        {credits !== null && (
          <span className="text-[10px] font-medium text-zinc-500 hidden sm:block">{credits}</span>
        )}
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-150 hidden sm:block ${showDropdown ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            role="menu"
            className="absolute right-0 top-full mt-2 w-48 glass-matte rounded-xl p-1 shadow-xl shadow-black/30 z-50"
          >
            <div className="px-3 py-2 border-b border-zinc-700/50">
              <p className="text-[11px] text-zinc-500">Signed in as</p>
              <p className="text-[12px] text-zinc-200 truncate">{user.email}</p>
            </div>

            <div className="py-1">
              <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-zinc-400">
                <Cloud className="w-3.5 h-3.5 text-green-400" />
                <span>Cloud sync enabled</span>
              </div>
              {credits !== null && (
                <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-zinc-400">
                  <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold text-green-400">⚡</span>
                  <span>{credits} credits left</span>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-700/50 pt-1">
              <button
                onClick={() => {
                  signOut();
                  setShowDropdown(false);
                }}
                role="menuitem"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-zinc-300 hover:bg-zinc-700/50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
