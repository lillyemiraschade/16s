"use client";

import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TIPS = [
  "Drop inspiration images for pixel-perfect cloning",
  "Try the voice call feature - it's like having a designer on speed dial",
  "You can select any element and ask to change it",
  "Use bookmarks to save versions you love",
  "Export to HTML or deploy directly to the web",
  "Ask for specific vibes: 'make it feel like Apple'",
  "Upload your logo and it'll be placed automatically",
  "Say 'make it more minimal' or 'add more personality'",
  "You can edit the code directly with Cmd+/",
  "Try 'hop on a call' for a 2-minute design session",
];

const REVISION_MESSAGES = [
  "One sec, redecorating...",
  "Hold tight, moving some pixels around",
  "Brewing up something fresh",
  "Almost there, just adding some magic",
  "Working on it, no peeking!",
  "The pixels are doing their thing",
  "Making it even better...",
  "Give me a moment to work my magic",
  "Tweaking things behind the scenes",
  "Just a sec, perfectionism takes time",
];

export const GeneratingState = memo(function GeneratingState({ isRevision }: { isRevision: boolean }) {
  const [tipIndex, setTipIndex] = useState(0);
  const [revisionMessage] = useState(() =>
    REVISION_MESSAGES[Math.floor(Math.random() * REVISION_MESSAGES.length)]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="relative flex items-center justify-center w-32 h-32">
        <motion.div
          className="absolute w-28 h-28 rounded-full border border-green-500/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute w-24 h-24 rounded-full bg-green-500/8"
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-16 h-16 rounded-full bg-green-500/15"
          animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src="/logo.png"
          alt="Loading"
          className="w-12 h-12 object-contain relative z-10"
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="text-center max-w-md px-4">
        <p className="text-zinc-200 text-[16px] font-medium mb-4">
          {isRevision ? revisionMessage : "Building your site..."}
        </p>
        <div className="h-10 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-zinc-500 text-[13px] absolute inset-x-0 leading-relaxed"
            >
              {TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});
