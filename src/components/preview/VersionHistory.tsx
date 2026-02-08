"use client";

import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookmarkCheck, Trash2 } from "lucide-react";
import type { VersionBookmark } from "@/lib/types";

interface VersionHistoryProps {
  previewHistory: string[];
  totalVersions: number;
  bookmarks: VersionBookmark[];
  onRestoreVersion: (index: number) => void;
  onAddBookmark: (name: string) => void;
  onRemoveBookmark: (id: string) => void;
  onClose: () => void;
  showBookmarkInput: boolean;
  onShowBookmarkInput: (show: boolean) => void;
}

export const VersionHistory = memo(function VersionHistory({
  previewHistory,
  totalVersions,
  bookmarks,
  onRestoreVersion,
  onAddBookmark,
  onRemoveBookmark,
  onClose,
  showBookmarkInput,
  onShowBookmarkInput,
}: VersionHistoryProps) {
  const [bookmarkName, setBookmarkName] = useState("");

  return (
    <>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 240, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="border-l border-white/[0.04] overflow-hidden flex-shrink-0"
      >
        <div className="w-[240px] h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <span className="text-[13px] font-medium text-zinc-300">History</span>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
              aria-label="Close version history"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-1">
            {/* Current version */}
            {(() => {
              const currentBookmark = bookmarks.find(b => b.versionIndex === previewHistory.length);
              return (
                <div className="px-3 py-2 mx-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <div className="text-[13px] font-medium text-green-400 flex-1">
                      {currentBookmark ? currentBookmark.name : `Version ${totalVersions}`}
                    </div>
                    {currentBookmark && (
                      <button
                        onClick={() => onRemoveBookmark(currentBookmark.id)}
                        className="p-1 rounded text-green-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove bookmark"
                        aria-label="Remove bookmark"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {currentBookmark && <BookmarkCheck className="w-3 h-3 text-green-400/60" />}
                    <span className="text-[11px] text-zinc-500">Current</span>
                  </div>
                </div>
              );
            })()}
            {/* Previous versions */}
            {[...previewHistory].reverse().map((_, reverseIdx) => {
              const actualIdx = previewHistory.length - 1 - reverseIdx;
              const bookmark = bookmarks.find(b => b.versionIndex === actualIdx);
              return (
                <div
                  key={actualIdx}
                  className={`mx-2 rounded-lg transition-colors ${
                    bookmark
                      ? "bg-green-500/10 border border-green-500/20"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    onClick={() => onRestoreVersion(actualIdx)}
                    className="w-full text-left px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`text-[13px] flex-1 ${
                        bookmark ? "font-medium text-green-400" : "text-zinc-400"
                      }`}>
                        {bookmark ? bookmark.name : `Version ${actualIdx + 1}`}
                      </div>
                      {bookmark && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveBookmark(bookmark.id);
                          }}
                          className="p-1 rounded text-green-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove bookmark"
                          aria-label="Remove bookmark"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {bookmark && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <BookmarkCheck className="w-3 h-3 text-green-400/60" />
                        <span className="text-[11px] text-zinc-500">Bookmarked</span>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Bookmark input dialog */}
      <AnimatePresence>
        {showBookmarkInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => { onShowBookmarkInput(false); setBookmarkName(""); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass rounded-xl p-6 w-[320px] shadow-xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bookmark-dialog-title"
            >
              <h3 id="bookmark-dialog-title" className="text-[15px] font-medium text-zinc-200 mb-4">
                Bookmark this version
              </h3>
              <input
                type="text"
                id="bookmark-name"
                name="bookmark-name"
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && bookmarkName.trim()) {
                    onAddBookmark(bookmarkName.trim());
                    setBookmarkName("");
                    onShowBookmarkInput(false);
                  } else if (e.key === "Escape") {
                    setBookmarkName("");
                    onShowBookmarkInput(false);
                  }
                }}
                placeholder="e.g., Before hero redesign"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-green-500/40 transition-colors"
                autoFocus
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { onShowBookmarkInput(false); setBookmarkName(""); }}
                  className="flex-1 px-4 py-2 text-[13px] text-zinc-400 hover:text-zinc-200 glass glass-hover rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (bookmarkName.trim()) {
                      onAddBookmark(bookmarkName.trim());
                      setBookmarkName("");
                      onShowBookmarkInput(false);
                    }
                  }}
                  disabled={!bookmarkName.trim()}
                  className="flex-1 px-4 py-2 text-[13px] text-white bg-green-500/60 hover:bg-green-500/80 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
