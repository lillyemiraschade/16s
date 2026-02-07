"use client";

import { useState, useCallback } from "react";
import { compressForContent, uploadToBlob } from "@/lib/images";
import type { UploadedImage } from "@/lib/types";

/** Upload images that don't have blob URLs yet. Returns updated array. */
export async function ensureBlobUrls(images: UploadedImage[]): Promise<UploadedImage[]> {
  const needUpload = images.filter(img => !img.url);
  if (needUpload.length === 0) return images;

  const uploaded = await Promise.all(
    needUpload.map(async (img) => {
      try {
        const url = await uploadToBlob(img.data, img.label);
        return { ...img, url };
      } catch {
        return img; // Keep original as fallback
      }
    })
  );

  return images.map(img => {
    if (!img.url) {
      return uploaded.find(u => u.data === img.data) || img;
    }
    return img;
  });
}

export function useImages() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const handleImageUpload = useCallback(async (base64: string, type: "inspo" | "content" = "content", label?: string) => {
    // Add image immediately with base64 for preview
    const newImage: UploadedImage = { data: base64, type, label };
    setUploadedImages((prev) => [...prev, newImage]);

    // Upload ALL images to Vercel Blob in background
    try {
      const url = await uploadToBlob(base64, label);
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.data === base64 && img.type === type ? { ...img, url } : img
        )
      );
    } catch {
      // Image still works with base64 fallback
    }
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImageTypeToggle = useCallback(async (index: number) => {
    const img = uploadedImages[index];
    if (!img) return;

    // Capture stable identifier — index can shift if images are added/removed during async ops
    const imgData = img.data;
    const newType = img.type === "inspo" ? "content" : "inspo";

    if (newType === "content") {
      try {
        const compressed = await compressForContent(img.data);
        setUploadedImages((prev) =>
          prev.map((p) =>
            p.data === imgData ? { ...p, type: newType, data: compressed } : p
          )
        );
        const url = await uploadToBlob(compressed, img.label);
        setUploadedImages((prev) =>
          prev.map((p) =>
            p.data === compressed ? { ...p, url } : p
          )
        );
      } catch {
        setUploadedImages((prev) =>
          prev.map((p) =>
            p.data === imgData ? { ...p, type: newType } : p
          )
        );
      }
    } else {
      setUploadedImages((prev) =>
        prev.map((p) =>
          p.data === imgData ? { ...p, type: newType, url: undefined } : p
        )
      );
    }
  }, [uploadedImages]);

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
