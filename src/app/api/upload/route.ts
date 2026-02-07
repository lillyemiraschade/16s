import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// [2026-02-05] Added rate limiting — prevents abuse of Vercel Blob storage quota
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15; // 15 uploads per minute per IP
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateLimitMap.size > 500) {
      rateLimitMap.forEach((v, k) => { if (now > v.resetAt) rateLimitMap.delete(k); });
    }
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many uploads. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    // Auth check — uploads cost storage quota
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Sign in to upload images" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if blob token is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.debug("BLOB_READ_WRITE_TOKEN is not set");
      return new Response(
        JSON.stringify({ error: "Blob storage not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // [2026-02-05] Server-side payload size check — reject before parsing oversized requests
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB (generous — frontend compresses to ~100KB)
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Image too large. Maximum 5MB." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const { imageData, filename } = await req.json();

    if (!imageData || typeof imageData !== "string") {
      return new Response(
        JSON.stringify({ error: "No image data provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Second size check on actual data (content-length can be spoofed or absent)
    if (imageData.length > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Image too large. Maximum 5MB." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract base64 data from data URL
    const matches = imageData.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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

    return new Response(
      JSON.stringify({ url }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.debug("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Failed to upload: ${errorMessage}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
