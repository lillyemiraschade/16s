import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || "";

const limiter = createRateLimiter(5); // 5 removals per minute per IP

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    // Auth check — remove.bg costs money per call
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Sign in to remove backgrounds" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // [2026-02-05] Server-side payload size check — reject oversized requests before processing
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB (remove.bg supports up to 12MB)
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Image too large. Maximum 10MB." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const { imageData } = await req.json();

    if (!imageData || typeof imageData !== "string") {
      return new Response(
        JSON.stringify({ error: "No image data provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (imageData.length > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Image too large. Maximum 10MB." }),
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
      return new Response(
        JSON.stringify({ error: "Background removal failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the result as buffer and convert to base64
    const resultBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString("base64");
    const resultDataUrl = `data:image/png;base64,${resultBase64}`;

    return new Response(
      JSON.stringify({ imageData: resultDataUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.debug("remove-bg API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process image" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
