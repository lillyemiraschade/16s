"use client";

import { useState, useCallback, memo } from "react";
import { X, ImagePlus, Sparkles, Loader2 } from "lucide-react";
import { removeBackground } from "@/lib/images";
import type { UploadedImage } from "@/lib/types";

interface ImageUploadBarProps {
  images: UploadedImage[];
  onRemove: (index: number) => void;
  onTypeToggle: (index: number) => void;
  onUpdate: (index: number, newData: string) => void;
  onLightboxOpen: (src: string, trigger: HTMLElement) => void;
  onAddMore: () => void;
  onError: (msg: string) => void;
}

export const ImageUploadBar = memo(function ImageUploadBar({
  images,
  onRemove,
  onTypeToggle,
  onUpdate,
  onLightboxOpen,
  onAddMore,
  onError,
}: ImageUploadBarProps) {
  const [removingBgIndex, setRemovingBgIndex] = useState<number | null>(null);

  const handleRemoveBackground = useCallback(async (index: number) => {
    if (removingBgIndex !== null) return;
    setRemovingBgIndex(index);
    try {
      const result = await removeBackground(images[index].data);
      onUpdate(index, result);
    } catch (err) {
      console.debug("Failed to remove background:", err);
      onError("Failed to remove background. Please try again.");
    } finally {
      setRemovingBgIndex(null);
    }
  }, [removingBgIndex, images, onUpdate, onError]);

  return (
    <div className="mb-3 flex gap-2 flex-wrap">
      {images.map((img, idx) => (
        <div key={idx} className="relative group">
          <button
            onClick={(e) => onLightboxOpen(img.data, e.currentTarget)}
            className="rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.data}
              alt={`${img.type === "content" ? "Content" : "Inspiration"} image ${idx + 1}`}
              className="h-14 w-14 object-cover ring-1 ring-white/[0.06]"
            />
          </button>
          {/* Remove background button */}
          <button
            onClick={() => handleRemoveBackground(idx)}
            disabled={removingBgIndex !== null}
            className={`absolute -top-1.5 -left-1.5 w-5 h-5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 rounded-full flex items-center justify-center transition-all duration-150 ring-1 ring-white/[0.06] ${
              removingBgIndex === idx ? "opacity-100" : "opacity-50 group-hover:opacity-100"
            }`}
            aria-label="Remove image background"
            title="Remove background — great for headshots, logos, product photos"
          >
            {removingBgIndex === idx ? (
              <Loader2 className="w-3 h-3 text-white animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 text-white" />
            )}
          </button>
          {/* Type toggle */}
          <button
            onClick={() => onTypeToggle(idx)}
            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-medium rounded cursor-pointer hover:opacity-80 transition-opacity ${
              img.type === "content" ? "bg-green-500/80 text-white" : "bg-zinc-700 text-zinc-300"
            }`}
            title={img.type === "content"
              ? "Content: this image will be placed in your website. Click to switch to inspo (design reference)."
              : "Inspo: AI will clone this design style. Click to switch to content (embed in website)."}
            aria-label={`Toggle image ${idx + 1} type: currently ${img.type === "content" ? "content (embedded in site)" : "inspiration (design reference)"}`}
          >
            {img.type === "content" ? (img.label || "content") : "inspo"}
          </button>
          {/* Remove button */}
          <button
            onClick={() => onRemove(idx)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150 ring-1 ring-white/[0.06]"
            aria-label={`Remove image ${idx + 1}`}
          >
            <X className="w-3 h-3 text-zinc-300" />
          </button>
        </div>
      ))}
      <button
        onClick={onAddMore}
        className="h-14 w-14 rounded-lg glass glass-hover flex items-center justify-center transition-all duration-200"
        aria-label="Add more images"
      >
        <ImagePlus className="w-4 h-4 text-zinc-500" />
      </button>
    </div>
  );
});
