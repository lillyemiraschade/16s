import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || "";

const limiter = createRateLimiter(5); // 5 removals per minute per IP

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return apiError("Too many requests. Please wait a moment.", 429, { "Retry-After": "60" });
  }

  try {
    // Auth check — remove.bg costs money per call
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Sign in to remove backgrounds", 401);
    }

    // [2026-02-05] Server-side payload size check — reject oversized requests before processing
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB (remove.bg supports up to 12MB)
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return apiError("Image too large. Maximum 10MB.", 413);
    }

    const { imageData } = await req.json();

    if (!imageData || typeof imageData !== "string") {
      return apiError("No image data provided", 400);
    }

    if (imageData.length > MAX_PAYLOAD_BYTES) {
      return apiError("Image too large. Maximum 10MB.", 413);
    }

    // Extract base64 data from data URL
    const matches = imageData.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      return apiError("Invalid image format", 400);
    }

    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Create form data for remove.bg API
    const formData = new FormData();
    formData.append("image_file", new Blob([imageBuffer]), "image.png");
    formData.append("size", "auto");
    formData.append("format", "png");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.debug("remove.bg error:", errorText);
      return apiError("Background removal failed", 500);
    }

    // Get the result as buffer and convert to base64
    const resultBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString("base64");
    const resultDataUrl = `data:image/png;base64,${resultBase64}`;

    return apiSuccess({ imageData: resultDataUrl });
  } catch (error) {
    console.debug("remove-bg API error:", error);
    return apiError("Failed to process image", 500);
  }
}
