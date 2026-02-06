"use client";

import { motion } from "framer-motion";

export function TypingIndicator({ label = "Working on it..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-1.5 h-1.5 bg-green-500 rounded-full"
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: index * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <motion.span
        className="text-[13px] text-zinc-500 font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.span>
    </div>
  );
}
