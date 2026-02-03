import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { imageData } = await req.json();

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
      console.error("remove.bg error:", errorText);
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
    console.error("remove-bg API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process image" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
