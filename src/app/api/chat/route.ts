import { anthropic } from "@/lib/ai/anthropic";
import { MessageParam, ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { SYSTEM_PROMPT, REACT_ADDENDUM } from "@/lib/ai/prompts";
import { parseAIResponse } from "@/lib/ai/parse-response";
import type { ChatAPIResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for Pro plans

// Image type for typed uploads
const UploadedImageSchema = z.object({
  data: z.string(), // base64 data URL
  url: z.string().optional(), // Vercel Blob URL for direct embedding
  type: z.enum(["inspo", "content"]),
  label: z.string().optional(),
});

// Project context schema (learned preferences - invisible to user)
const ProjectContextSchema = z.object({
  brandName: z.string().optional(),
  industry: z.string().optional(),
  targetAudience: z.union([z.string(), z.array(z.string())]).optional(),
  stylePreferences: z.array(z.string()).optional(),
  colorPreferences: z.array(z.string()).optional(),
  fontPreferences: z.array(z.string()).optional(),
  featuresRequested: z.array(z.string()).optional(),
  thingsToAvoid: z.array(z.string()).optional(),
  lastUpdated: z.number().optional(),
}).optional();

// Request validation with defaults for resilience
const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().default(() => `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    role: z.enum(["user", "assistant"]),
    content: z.string().max(15000).default(""),
    uploadedImages: z.array(UploadedImageSchema).optional(),
  })).max(100),
  uploadedImages: z.array(UploadedImageSchema).max(10).optional(), // New typed format
  inspoImages: z.array(z.string()).max(10).optional(), // Legacy format for backward compat
  currentPreview: z.string().max(500000).nullable(),
  previewScreenshot: z.string().max(2000000).nullable().optional(),
  outputFormat: z.enum(["html", "react"]).default("html"), // Output format: vanilla HTML or React components
  context: ProjectContextSchema.nullable().default(null), // Learned preferences (invisible memory)
  isFirstMessage: z.boolean().optional(), // Extra-warm response for brand new users
  discussionMode: z.boolean().optional(), // Chat-only mode, no code generation
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

type ChatResponse = ChatAPIResponse;

const limiter = createRateLimiter(20);

// Map API/stream errors to user-friendly messages with HTTP status codes
function getUserFriendlyError(errMsg: string): { message: string; statusCode: number } {
  if (errMsg.includes("body") || errMsg.includes("size") || errMsg.includes("large"))
    return { message: "Request too large. Try with fewer or smaller images.", statusCode: 413 };
  if (errMsg.includes("credit balance") || errMsg.includes("insufficient"))
    return { message: "The AI service is temporarily unavailable. Please try again shortly.", statusCode: 402 };
  if (errMsg.includes("overloaded") || errMsg.includes("529"))
    return { message: "The AI is busy right now. Give me a moment and try again.", statusCode: 503 };
  if (errMsg.includes("rate") || errMsg.includes("429"))
    return { message: "Too many requests. Please wait a few seconds and try again.", statusCode: 429 };
  if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT"))
    return { message: "The request timed out. Please try again.", statusCode: 504 };
  if (errMsg.includes("invalid") || errMsg.includes("400"))
    return { message: "I had trouble understanding that. Could you rephrase your request?", statusCode: 400 };
  if (errMsg.includes("Supabase") || errMsg.includes("not configured"))
    return { message: "Service configuration error. Please try again.", statusCode: 500 };
  return { message: "Let me try that again...", statusCode: 500 };
}

// Credit management for authenticated users
// [2026-02-05] Fixed TOCTOU race condition: uses optimistic concurrency control to prevent double-spending
async function checkAndDeductCredits(userId: string, creditsToDeduct: number = 1, retryCount: number = 0): Promise<{ success: boolean; remaining?: number; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("credits_remaining")
      .eq("user_id", userId)
      .single();

    if (fetchError || !subscription) {
      // No subscription found - allow request but don't track (free tier behavior)
      console.debug("[Credits] No subscription found for user, allowing request");
      return { success: true };
    }

    if (subscription.credits_remaining < creditsToDeduct) {
      return { success: false, remaining: subscription.credits_remaining, error: "Insufficient credits" };
    }

    // Deduct credits with optimistic concurrency control:
    // Only update if credits_remaining still matches what we read (prevents double-spending)
    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update({ credits_remaining: subscription.credits_remaining - creditsToDeduct })
      .eq("user_id", userId)
      .eq("credits_remaining", subscription.credits_remaining)
      .select("credits_remaining");

    if (updateError) {
      console.debug("[Credits] Failed to deduct credits:", updateError);
      // Still allow request if deduction fails - don't block users
      return { success: true, remaining: subscription.credits_remaining };
    }

    // If no rows were updated, another request modified credits concurrently — retry once
    if (!updated || updated.length === 0) {
      if (retryCount < 1) {
        console.debug("[Credits] Concurrent modification detected, retrying...");
        return checkAndDeductCredits(userId, creditsToDeduct, retryCount + 1);
      }
      // After retry, allow the request but log the issue
      console.debug("[Credits] Concurrent modification persisted after retry, allowing request");
      return { success: true };
    }

    // Log usage (non-blocking — don't await to avoid slowing the response)
    Promise.resolve(
      supabase.from("usage").insert({
        user_id: userId,
        action: "chat_message",
        credits_used: creditsToDeduct,
        metadata: { timestamp: new Date().toISOString() },
      })
    ).then(({ error }) => {
      if (error) console.debug("[Credits] Failed to log usage:", error);
    }).catch(() => {});

    return { success: true, remaining: updated[0].credits_remaining };
  } catch (err) {
    console.debug("[Credits] Error checking credits:", err);
    // Allow request on error - don't block users due to credit check failures
    return { success: true };
  }
}

// Prompt constants extracted to src/lib/ai/prompts.ts

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return new Response(
      JSON.stringify({ message: "You\u2019re sending requests too quickly. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    let raw;
    try {
      raw = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Request too large. Try with fewer or smaller images." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Last user message length check — reject before expensive AI call
    if (raw.messages && Array.isArray(raw.messages)) {
      const lastUserMsg = [...raw.messages].reverse().find((m: Record<string, unknown>) => m.role === "user");
      if (lastUserMsg && typeof lastUserMsg.content === "string" && lastUserMsg.content.length > 10000) {
        return new Response(
          JSON.stringify({ error: "Message too long. Please shorten your request." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Pre-sanitize messages to fix common issues before validation
    if (raw.messages && Array.isArray(raw.messages)) {
      raw.messages = raw.messages
        .filter((m: Record<string, unknown>) => m && typeof m === "object" && m.role)
        .map((m: Record<string, unknown>, i: number) => ({
          ...m,
          id: m.id || `msg-${Date.now()}-${i}`,
          content: typeof m.content === "string" && m.content ? m.content : "[No content]",
        }));
    }

    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const errorDetail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid format";
      console.debug("[Chat API] Validation failed:", errorDetail);
      return new Response(
        JSON.stringify({ error: `Invalid request: ${errorDetail}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { messages, uploadedImages, inspoImages, currentPreview, previewScreenshot, outputFormat, context, isFirstMessage, discussionMode } = parsed.data;

    // Check and deduct credits for authenticated users
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const creditResult = await checkAndDeductCredits(user.id);
        if (!creditResult.success) {
          return new Response(
            JSON.stringify({
              message: `You've used all your credits for this period. Upgrade your plan for more.`,
              error: "insufficient_credits"
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    } catch (creditError) {
      // Log but don't block - credit check is non-critical
      console.debug("[Credits] Credit check failed, allowing request:", creditError);
    }

    // Normalize images: combine new typed format with legacy format
    type UploadedImage = { data: string; url?: string; type: "inspo" | "content"; label?: string };
    const allImages: UploadedImage[] = [
      ...(uploadedImages || []),
      ...(inspoImages || []).map((img) => ({ data: img, type: "inspo" as const })),
    ];

    const claudeMessages: MessageParam[] = [];

    // Track global image indices across all messages
    let globalContentImageIndex = 0;
    let globalInspoImageIndex = 0;

    for (const msg of messages) {
      if (msg.role === "user") {
        const isLastUserMessage = messages.indexOf(msg) === messages.length - 1;

        // Get images for this message - either from the message itself or from the request (for last message)
        const messageImages = isLastUserMessage ? allImages : (msg.uploadedImages || []);

        if (messageImages.length > 0) {
          const contentBlocks: (ImageBlockParam | TextBlockParam)[] = [];

          // Separate inspo and content images
          const inspoImgs = messageImages.filter((img) => img.type === "inspo");
          const contentImgs = messageImages.filter((img) => img.type === "content");

          // Add inspo images first with label and individual indices
          if (inspoImgs.length > 0) {
            contentBlocks.push({
              type: "text",
              text: `[INSPIRATION IMAGES - Clone these designs pixel-perfectly:]`,
            });
            for (const img of inspoImgs) {
              const matches = img.data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
              if (matches) {
                contentBlocks.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: matches[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                    data: matches[2],
                  },
                });
                const labelNote = img.label ? ` (${img.label})` : "";
                // Prefer direct URL over placeholder when available
                if (img.url) {
                  contentBlocks.push({
                    type: "text",
                    text: `[Inspo image #${globalInspoImageIndex}${labelNote} — to embed this image directly, use this EXACT URL: ${img.url}]`,
                  });
                } else {
                  contentBlocks.push({
                    type: "text",
                    text: `[Inspo image #${globalInspoImageIndex}${labelNote} — to embed this image directly, use: {{INSPO_IMAGE_${globalInspoImageIndex}}}]`,
                  });
                }
                globalInspoImageIndex++;
              }
            }
          }

          // Add content images - use URLs directly if available, otherwise fallback to placeholders
          if (contentImgs.length > 0) {
            // Check if images have blob URLs
            const hasUrls = contentImgs.some(img => img.url);

            if (hasUrls) {
              contentBlocks.push({
                type: "text",
                text: `[CONTENT IMAGES - Use the provided URLs directly in your HTML img src attributes:]`,
              });
            } else {
              contentBlocks.push({
                type: "text",
                text: `[CONTENT IMAGES - Use placeholders in your HTML. The system will replace them with actual images:]`,
              });
            }

            for (let i = 0; i < contentImgs.length; i++) {
              const img = contentImgs[i];
              const matches = img.data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
              if (matches) {
                const labelNote = img.label ? ` (${img.label})` : "";
                // Show the image visually so AI can see what it is
                contentBlocks.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: matches[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                    data: matches[2],
                  },
                });
                // Tell Claude to use URL directly if available, otherwise use placeholder
                if (img.url) {
                  contentBlocks.push({
                    type: "text",
                    text: `[Content image #${globalContentImageIndex}${labelNote} → Use this EXACT URL in img src: ${img.url} — NEVER use base64 data:image]`,
                  });
                } else {
                  contentBlocks.push({
                    type: "text",
                    text: `[Content image #${globalContentImageIndex}${labelNote} → Use placeholder: {{CONTENT_IMAGE_${globalContentImageIndex}}}]`,
                  });
                }
                globalContentImageIndex++;
              }
            }
          }

          // Build the system note based on what types of images we have
          let systemNote = "";
          const hasUrls = contentImgs.some(img => img.url);
          if (inspoImgs.length > 0 && contentImgs.length > 0) {
            if (hasUrls) {
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images. For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the EXACT https:// URLs provided above in img src. NEVER embed base64 data:image — it breaks images! If user asks to embed an inspo image directly, use its {{INSPO_IMAGE_N}} placeholder.]";
            } else {
              systemNote = "\n\n[SYSTEM NOTE: The user provided both INSPIRATION images (clone the design style) and CONTENT images (use placeholders like {{CONTENT_IMAGE_0}}). For inspiration images: extract exact colors, typography, spacing, layout. For content images: use the {{CONTENT_IMAGE_N}} placeholders. If user asks to embed an inspo image directly, use its {{INSPO_IMAGE_N}} placeholder.]";
            }
          } else if (inspoImgs.length > 0) {
            systemNote = "\n\n[SYSTEM NOTE: These are INSPIRATION images. CLONE THE DESIGN PIXEL-PERFECTLY. Extract exact colors, typography, spacing, layout, button styles, nav style — everything. DO NOT interpret. CLONE EXACTLY what you see. HOWEVER: If user asks to PUT/PLACE/EMBED THIS IMAGE IN THE WEBSITE (not just clone the style), use the {{INSPO_IMAGE_N}} placeholder shown next to that specific image. Each inspo image has its own numbered placeholder — use the one that matches the image the user is referring to.]";
          } else if (contentImgs.length > 0) {
            if (hasUrls) {
              systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images to embed in the website. Use the EXACT https:// URLs provided above in <img src=\"...\">. CRITICAL: NEVER use base64 data:image — only use the https:// URLs!]";
            } else {
              systemNote = "\n\n[SYSTEM NOTE: These are CONTENT images. Use {{CONTENT_IMAGE_N}} placeholders in img src attributes. The system will replace them with actual image data.]";
            }
          }

          // For the LAST user message: add a clear CURRENT_IMAGE shortcut
          // so the AI can always reference THIS message's images unambiguously,
          // regardless of how many images have accumulated in history
          if (isLastUserMessage && messageImages.length > 0) {
            let currentImageNote = "\n\n[⚡ SHORTCUT — Images attached to THIS message can also be referenced as:";
            for (let ci = 0; ci < messageImages.length; ci++) {
              const img = messageImages[ci];
              if (img.url) {
                currentImageNote += `\n  {{CURRENT_IMAGE_${ci}}} → ${img.url}`;
              } else {
                currentImageNote += `\n  {{CURRENT_IMAGE_${ci}}}`;
              }
            }
            currentImageNote += "\nWhen the user says \"this image\" or \"use this\", they mean the images in THIS message. Prefer {{CURRENT_IMAGE_N}} over older references.]";
            systemNote += currentImageNote;
          }

          const userText = msg.content || "Here are my images.";
          contentBlocks.push({
            type: "text",
            text: userText + systemNote,
          });

          claudeMessages.push({ role: "user", content: contentBlocks });
        } else {
          claudeMessages.push({ role: "user", content: msg.content || "[No content]" });
        }
      } else {
        claudeMessages.push({ role: "assistant", content: msg.content || "..." });
      }
    }

    // Determine if this is a simple iteration or complex generation
    const lastUserMessage = messages[messages.length - 1]?.content.toLowerCase() || "";
    const hasImages = allImages.length > 0;
    const isFirstGeneration = !currentPreview;

    // Simple iterations: color changes, text tweaks, small adjustments
    // Patterns that indicate a simple styling change (not structural)
    const simplePatterns = [
      /^(change|make|set|update|switch|use)\s+(the\s+)?(color|colour|background|font|text|size|padding|margin|spacing)\b/i,
      /^(make\s+it|change\s+it\s+to)\s+(bigger|smaller|larger|darker|lighter|bolder)\b/i,
      /^(change|update|edit|fix)\s+(the\s+)?(title|heading|subtitle|paragraph|caption|label)\s+(text|to\s|")/i,
    ];

    // Patterns that indicate complex changes (should use Sonnet)
    const complexPatterns = [
      /\b(add|create|build|implement|design|new)\b/i,  // New features/sections
      /\b(remove|delete)\s+(the\s+)?(section|component|page|feature)/i,  // Structural removals
      /\b(reorganize|restructure|refactor|redesign|rethink)\b/i,  // Major changes
      /\b(and|also|then|plus)\b/i,  // Multiple changes
      /\?$/,  // Questions need Sonnet
    ];

    const isSimpleIteration = currentPreview &&
      !hasImages &&
      !isFirstGeneration &&
      lastUserMessage.length < 100 &&  // Stricter length limit
      simplePatterns.some(pattern => pattern.test(lastUserMessage)) &&
      !complexPatterns.some(pattern => pattern.test(lastUserMessage));

    // Select model and tokens based on complexity
    // [2026-02-05] Upgraded simple iterations from Claude 3 Haiku to 3.5 Haiku for better JSON format adherence and HTML quality
    const model = isSimpleIteration ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-5-20250929";
    const maxTokens = isSimpleIteration ? 8000 : 18000;

    // Inject current preview context - use smaller context for simple iterations
    if (currentPreview && claudeMessages.length > 0) {
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      const contextLimit = isSimpleIteration ? 15000 : 30000; // Less context for fast iterations
      const previewContext = `[The user currently has a website preview. Here is the current HTML:\n${currentPreview.substring(0, contextLimit)}\n]`;
      if (lastMessage.role === "user") {
        if (typeof lastMessage.content === "string") {
          lastMessage.content = `${previewContext}\n\nUser request: ${lastMessage.content}`;
        } else if (Array.isArray(lastMessage.content)) {
          const lastTextIndex = lastMessage.content.findLastIndex(
            (block) => block.type === "text"
          );
          if (lastTextIndex >= 0) {
            const textBlock = lastMessage.content[lastTextIndex] as TextBlockParam;
            textBlock.text = `${previewContext}\n\nUser request: ${textBlock.text}`;
          }
        }
      }
    }

    // Inject screenshot only for complex generations (Sonnet) - skip for simple iterations
    if (!isSimpleIteration && previewScreenshot && claudeMessages.length > 0) {
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      const screenshotMatch = previewScreenshot.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (screenshotMatch) {
        const screenshotImage: ImageBlockParam = {
          type: "image",
          source: {
            type: "base64",
            media_type: screenshotMatch[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: screenshotMatch[2],
          },
        };
        const screenshotNote: TextBlockParam = {
          type: "text",
          text: "[⚠️ VISUAL VERIFICATION REQUIRED: This screenshot shows what the user currently sees. STUDY IT CAREFULLY before responding. Check: Does it look good? Are images rendering? Is text readable? Any visual glitches? If you see ANY problems, acknowledge them and fix them. Never say it looks good if it doesn't!]",
        };

        if (typeof lastMessage.content === "string") {
          lastMessage.content = [
            screenshotImage,
            screenshotNote,
            { type: "text" as const, text: lastMessage.content },
          ];
        } else if (Array.isArray(lastMessage.content)) {
          lastMessage.content = [screenshotImage, screenshotNote, ...lastMessage.content];
        }
      }
    }

    // Build context injection if we have learned preferences
    let contextInjection = "";
    if (context) {
      const parts: string[] = [];
      if (context.brandName) parts.push(`Brand: ${context.brandName}`);
      if (context.industry) parts.push(`Industry: ${context.industry}`);
      if (context.targetAudience) parts.push(`Audience: ${Array.isArray(context.targetAudience) ? context.targetAudience.join(", ") : context.targetAudience}`);
      if (context.stylePreferences?.length) parts.push(`Style: ${context.stylePreferences.join(", ")}`);
      if (context.colorPreferences?.length) parts.push(`Colors: ${context.colorPreferences.join(", ")}`);
      if (context.fontPreferences?.length) parts.push(`Fonts: ${context.fontPreferences.join(", ")}`);
      if (context.featuresRequested?.length) parts.push(`Features wanted: ${context.featuresRequested.join(", ")}`);
      if (context.thingsToAvoid?.length) parts.push(`AVOID: ${context.thingsToAvoid.join(", ")}`);

      if (parts.length > 0) {
        contextInjection = `\n\n---
PROJECT MEMORY (learned from this conversation)
---
${parts.join("\n")}

Use this context to inform your designs. Don't ask about things you already know.
---\n`;
      }
    }

    // Use prompt caching for the system prompt (90% cost reduction on cache hits)
    // The base SYSTEM_PROMPT is static and cacheable
    // Context injection and React addendum are dynamic but small
    const systemPromptWithCache = [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const }, // Cache the large static portion
      },
      // Add dynamic parts without caching (they change per request)
      ...(contextInjection ? [{ type: "text" as const, text: contextInjection }] : []),
      ...(outputFormat === "react" ? [{ type: "text" as const, text: "\n\n" + REACT_ADDENDUM }] : []),
      ...(isFirstMessage ? [{ type: "text" as const, text: "\n\nFIRST MESSAGE: This is the user's very first message. Be extra warm and encouraging. Generate something impressive quickly to build trust. Skip plan approval — just build something great." }] : []),
      ...(discussionMode ? [{ type: "text" as const, text: "\n\nDISCUSSION MODE: The user wants to chat about their project without code generation. Help them brainstorm, refine ideas, discuss design choices, and plan. Do NOT generate HTML or React code. Do NOT include an \"html\" field. Respond with just a message and optional pills." }] : []),
    ];

    // Stream tokens to client as NDJSON for real-time display
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          let fullText = "";
          let tokensStreamed = false;

          // Retry loop — only retries connection-level failures (before tokens flow)
          for (let attempt = 0; attempt <= 2; attempt++) {
            try {
              const stream = anthropic.messages.stream({
                model,
                max_tokens: maxTokens,
                system: systemPromptWithCache,
                messages: claudeMessages,
              });

              for await (const event of stream) {
                if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                  fullText += event.delta.text;
                  tokensStreamed = true;
                  sendEvent({ type: "token", text: event.delta.text });
                }
              }
              break; // Success — exit retry loop
            } catch (apiError) {
              const errMsg = apiError instanceof Error ? apiError.message : String(apiError);
              console.debug(`[Chat API] API error (attempt ${attempt + 1}):`, errMsg);

              const isRetryable = !tokensStreamed && (
                errMsg.includes("overloaded") || errMsg.includes("529") ||
                errMsg.includes("rate") || errMsg.includes("timeout") ||
                errMsg.includes("ECONNRESET") || errMsg.includes("503")
              );

              if (isRetryable && attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
                fullText = "";
                continue;
              }
              throw apiError;
            }
          }

          // Parse the complete response
          const parsedResponse: ChatResponse = parseAIResponse(fullText);

          sendEvent({ type: "done", response: parsedResponse });
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.debug("[Chat API] Stream error:", errMsg);

          const { message: userMessage } = getUserFriendlyError(errMsg);
          sendEvent({ type: "error", message: userMessage });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.debug("[Chat API] Outer error:", errMsg);

    const { message: userMessage, statusCode } = getUserFriendlyError(errMsg);
    return new Response(
      JSON.stringify({ message: userMessage }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
