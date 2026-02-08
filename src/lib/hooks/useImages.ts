"use client";

import { useState, useCallback } from "react";
import { compressForContent, uploadToBlob } from "@/lib/images";
import type { UploadedImage } from "@/lib/types";

let imageCounter = 0;
function generateImageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${++imageCounter}`;
}

/** Upload images that don't have blob URLs yet. Returns updated array. */
export async function ensureBlobUrls(images: UploadedImage[]): Promise<UploadedImage[]> {
  const needUpload = images.filter(img => !img.url);
  if (needUpload.length === 0) return images;

  const uploaded = await Promise.all(
    needUpload.map(async (img) => {
      try {
        const url = await uploadToBlob(img.data, img.label);
        return { ...img, url };
      } catch (err) {
        console.error("[useImages] ensureBlobUrls failed for image:", img.id, err);
        return img; // Keep original as fallback
      }
    })
  );

  return images.map(img => {
    if (!img.url) {
      return uploaded.find(u => u.id === img.id) || img;
    }
    return img;
  });
}

export function useImages() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const handleImageUpload = useCallback(async (base64: string, type: "inspo" | "content" = "content", label?: string) => {
    const id = generateImageId();
    // Add image immediately with base64 for preview
    const newImage: UploadedImage = { id, data: base64, type, label };
    setUploadedImages((prev) => [...prev, newImage]);

    // Upload to Vercel Blob in background
    try {
      const url = await uploadToBlob(base64, label);
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, url } : img
        )
      );
    } catch (err) {
      console.error("[useImages] handleImageUpload blob upload failed:", err);
      // Image still works with base64 fallback
    }
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImageTypeToggle = useCallback(async (index: number) => {
    // Capture the image's stable id before any async work
    let targetId: string | undefined;
    setUploadedImages((prev) => {
      const img = prev[index];
      if (img) targetId = img.id;
      return prev;
    });

    // Read current state synchronously via a state snapshot
    const currentImages = await new Promise<UploadedImage[]>((resolve) => {
      setUploadedImages((prev) => { resolve(prev); return prev; });
    });

    const img = currentImages[index];
    if (!img) return;
    targetId = img.id;
    const newType = img.type === "inspo" ? "content" : "inspo";

    if (newType === "content") {
      try {
        // Step 1: Compress
        const compressed = await compressForContent(img.data);
        // Step 2: Upload compressed version to blob
        const url = await uploadToBlob(compressed, img.label);
        // Step 3: Update state ONCE with both new data + url
        setUploadedImages((prev) =>
          prev.map((p) =>
            p.id === targetId ? { ...p, type: newType, data: compressed, url } : p
          )
        );
      } catch (err) {
        console.error("[useImages] handleImageTypeToggle content conversion failed:", err);
        // Fallback: just toggle type without compression
        setUploadedImages((prev) =>
          prev.map((p) =>
            p.id === targetId ? { ...p, type: newType } : p
          )
        );
      }
    } else {
      // Switching to inspo: clear blob URL (inspo images don't need embedding)
      setUploadedImages((prev) =>
        prev.map((p) =>
          p.id === targetId ? { ...p, type: newType, url: undefined } : p
        )
      );
    }
  }, []);

  const handleImageUpdate = useCallback((index: number, newData: string) => {
    setUploadedImages((prev) =>
      prev.map((img, i) =>
        i === index ? { ...img, data: newData } : img
      )
    );
  }, []);

  return {
    uploadedImages,
    setUploadedImages,
    handleImageUpload,
    handleImageRemove,
    handleImageTypeToggle,
    handleImageUpdate,
  };
}
