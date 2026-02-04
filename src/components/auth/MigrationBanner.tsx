"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CheckCircle, Loader2 } from "lucide-react";

interface MigrationBannerProps {
  status: "idle" | "migrating" | "done";
  count: number;
}

export function MigrationBanner({ status, count }: MigrationBannerProps) {
  if (status === "idle") return null;
  if (status === "done" && count === 0) return null;

  return (
    <AnimatePresence>
      {(status === "migrating" || (status === "done" && count > 0)) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="glass-matte rounded-full px-4 py-2 flex items-center gap-2 shadow-xl shadow-black/30">
            {status === "migrating" ? (
              <>
                <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                <span className="text-[12px] font-medium text-zinc-200">
                  Syncing projects to cloud...
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-[12px] font-medium text-zinc-200">
                  {count} project{count !== 1 ? "s" : ""} synced to cloud
                </span>
                <Cloud className="w-4 h-4 text-green-400" />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
