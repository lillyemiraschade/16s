import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-utils";

export const runtime = "nodejs";

const limiter = createRateLimiter(15); // 15 uploads per minute per IP

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return apiError("Too many uploads. Please wait a moment.", 429, { "Retry-After": "60" });
  }

  try {
    // Auth check — uploads cost storage quota
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Sign in to upload images", 401);
    }

    // Check if blob token is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.debug("BLOB_READ_WRITE_TOKEN is not set");
      return apiError("Blob storage not configured", 500);
    }

    // [2026-02-05] Server-side payload size check — reject before parsing oversized requests
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB (generous — frontend compresses to ~100KB)
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return apiError("Image too large. Maximum 5MB.", 413);
    }

    const { imageData, filename } = await req.json();

    if (!imageData || typeof imageData !== "string") {
      return apiError("No image data provided", 400);
    }

    // Second size check on actual data (content-length can be spoofed or absent)
    if (imageData.length > MAX_PAYLOAD_BYTES) {
      return apiError("Image too large. Maximum 5MB.", 413);
    }

    // Extract base64 data from data URL
    const matches = imageData.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      return apiError("Invalid image format", 400);
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Determine file extension from mime type
    const ext = mimeType.split("/")[1] || "png";
    const uniqueFilename = `images/${filename || Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    console.debug(`[Blob] Uploading ${uniqueFilename} (${imageBuffer.length} bytes)`);

    // Upload to Vercel Blob
    const { url } = await put(uniqueFilename, imageBuffer, {
      access: "public",
      contentType: mimeType,
    });

    console.debug(`[Blob] Upload success: ${url}`);

    return apiSuccess({ url });
  } catch (error) {
    console.debug("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to upload: ${errorMessage}`, 500);
  }
}
