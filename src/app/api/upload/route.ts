import { put } from "@vercel/blob";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Check if blob token is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("BLOB_READ_WRITE_TOKEN is not set");
      return new Response(
        JSON.stringify({ error: "Blob storage not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { imageData, filename } = await req.json();

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: "No image data provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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

    console.log(`[Blob] Uploading ${uniqueFilename} (${imageBuffer.length} bytes)...`);

    // Upload to Vercel Blob
    const { url } = await put(uniqueFilename, imageBuffer, {
      access: "public",
      contentType: mimeType,
    });

    console.log(`[Blob] Upload success: ${url}`);

    return new Response(
      JSON.stringify({ url }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Failed to upload: ${errorMessage}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
