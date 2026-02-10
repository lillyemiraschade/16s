import { anthropic } from "@/lib/ai/anthropic";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Supabase (service role — no auth user for SMS) ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// --- TwiML helper ---

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// --- SMS System Prompt ---

const SMS_SYSTEM_PROMPT = `You are 16s, an AI web designer chatting with a client over text message. Your job is to gather the information needed to build their website.

WHAT TO GATHER (track mentally):
- Business name
- What they do / industry
- Target audience
- Key services or products
- Style/vibe preferences
- Contact info (phone, email, address, hours)
- Social media handles

RULES:
- Ask ONE question at a time
- Keep responses to 1-3 sentences max (this is SMS)
- Be warm, casual, and conversational
- NEVER use technical jargon
- NEVER make up information — ask for it
- When they skip something, move on
- Remember what they've already told you

CONVERSATION FLOW:
1. Get business name + what they do
2. Who is it for? What makes them unique?
3. What style/vibe? ("Think of a website you love — what do you like about it?")
4. Key details: services, pricing, hours, contact info
5. When you have 4-5 solid pieces of info, summarize and signal completion

RESPONSE FORMAT — Always respond with raw JSON (no markdown):
{
  "message": "your SMS reply text",
  "complete": false,
  "gathered": {
    "businessName": "if known",
    "industry": "if known",
    "audience": "if known",
    "services": "if known",
    "style": "if known",
    "contact": "if known"
  }
}

When you have enough info to build a great site, set "complete": true and make your message a brief summary + "I'm building your site now! You'll get a link in a few minutes."`;

// --- Types ---

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface SmsSession {
  id: string;
  phone_number: string;
  status: "gathering" | "generating" | "deployed";
  conversation: ConversationMessage[];
  gathered_info: Record<string, string>;
  deployed_url: string | null;
  created_at: string;
}

interface AiResponse {
  message: string;
  complete: boolean;
  gathered?: Record<string, string>;
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    // Twilio sends form-urlencoded
    const formData = await request.formData();
    const body = formData.get("Body") as string | null;
    const from = formData.get("From") as string | null;

    if (!from || !body) {
      return twiml("Sorry, I couldn't read your message. Try again?");
    }

    const phoneNumber = from.trim();
    const messageText = body.trim();
    const supabase = getSupabase();

    // Look up active session for this phone number
    const { data: existingSession, error: lookupError } = await supabase
      .from("sms_sessions")
      .select("*")
      .eq("phone_number", phoneNumber)
      .in("status", ["gathering", "generating", "deployed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("[SMS] Session lookup error:", lookupError);
      return twiml("Sorry, something went wrong on my end. Try texting again in a moment.");
    }

    // --- No active session → create one ---
    if (!existingSession) {
      const conversation: ConversationMessage[] = [
        { role: "user", content: messageText },
      ];

      // Get AI response for the first message
      const aiResponse = await getAiResponse(conversation);

      conversation.push({ role: "assistant", content: aiResponse.message });

      const { error: createError } = await supabase.from("sms_sessions").insert({
        phone_number: phoneNumber,
        status: "gathering",
        conversation,
        gathered_info: aiResponse.gathered || {},
      });

      if (createError) {
        console.error("[SMS] Session create error:", createError);
        return twiml("Sorry, I hit a snag. Try texting me again?");
      }

      return twiml(aiResponse.message);
    }

    const session = existingSession as SmsSession;

    // --- Session exists: route by status ---

    if (session.status === "generating") {
      return twiml("Still building your site! Hang tight \uD83D\uDD28");
    }

    if (session.status === "deployed") {
      // Check if they want to start over
      const restart = /\b(new|start over|different|another)\b/i.test(messageText);
      if (restart) {
        // Mark old session as done, start fresh
        await supabase
          .from("sms_sessions")
          .update({ status: "completed" })
          .eq("id", session.id);

        // Create a new gathering session
        const conversation: ConversationMessage[] = [
          { role: "user", content: messageText },
        ];
        const aiResponse = await getAiResponse(conversation);
        conversation.push({ role: "assistant", content: aiResponse.message });

        await supabase.from("sms_sessions").insert({
          phone_number: phoneNumber,
          status: "gathering",
          conversation,
          gathered_info: aiResponse.gathered || {},
        });

        return twiml(aiResponse.message);
      }

      return twiml(
        `Your site is live at ${session.deployed_url}! Text me "new" if you want to build another one.`
      );
    }

    // --- Status: gathering ---
    const conversation: ConversationMessage[] = [
      ...(session.conversation || []),
      { role: "user", content: messageText },
    ];

    const aiResponse = await getAiResponse(conversation);

    conversation.push({ role: "assistant", content: aiResponse.message });

    // Merge gathered info
    const gatheredInfo = {
      ...(session.gathered_info || {}),
      ...(aiResponse.gathered || {}),
    };

    if (aiResponse.complete) {
      // Update session to generating
      await supabase
        .from("sms_sessions")
        .update({
          status: "generating",
          conversation,
          gathered_info: gatheredInfo,
        })
        .eq("id", session.id);

      // Trigger async generation (don't block the Twilio response)
      generateAndDeploy(session.id, phoneNumber, gatheredInfo).catch((err) =>
        console.error("[SMS] Background generation failed:", err)
      );

      return twiml(aiResponse.message);
    }

    // Still gathering — save conversation
    await supabase
      .from("sms_sessions")
      .update({
        conversation,
        gathered_info: gatheredInfo,
      })
      .eq("id", session.id);

    return twiml(aiResponse.message);
  } catch (error) {
    console.error("[SMS] Unhandled error:", error);
    return twiml("Sorry, I had a hiccup. Try sending that again?");
  }
}

// --- AI conversation ---

async function getAiResponse(
  conversation: ConversationMessage[]
): Promise<AiResponse> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 400,
      system: SMS_SYSTEM_PROMPT,
      messages: conversation.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const fullText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    try {
      return JSON.parse(fullText.trim());
    } catch {
      // Try extracting JSON from response
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // fallthrough
        }
      }
      return {
        message: fullText.trim() || "Tell me about the website you want to build!",
        complete: false,
      };
    }
  } catch (error) {
    console.error("[SMS] Claude API error:", error);
    return {
      message: "Sorry, I had a hiccup. Try sending that again?",
      complete: false,
    };
  }
}

// --- Background: generate site + deploy + notify via SMS ---

async function generateAndDeploy(
  sessionId: string,
  phoneNumber: string,
  gatheredInfo: Record<string, string>
) {
  const supabase = getSupabase();

  try {
    // Build the generation prompt from gathered info
    const siteBrief = Object.entries(gatheredInfo)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const generationPrompt = `Build a complete, beautiful website based on this client brief gathered over text message:

${siteBrief}

Generate a full single-page HTML website. Include all the information provided. Use placeholder brackets [like this] for any missing details. Make it look stunning — this is their first impression.`;

    // Call Claude with the full generation system prompt
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: generationPrompt }],
    });

    const fullText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse HTML from the AI response (it returns JSON with an "html" field)
    let html: string;
    try {
      const parsed = JSON.parse(fullText.trim());
      html = parsed.html;
    } catch {
      // Try extracting JSON
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          html = parsed.html;
        } catch {
          html = "";
        }
      } else {
        html = "";
      }
    }

    if (!html) {
      throw new Error("No HTML generated from AI response");
    }

    // Deploy via Vercel API
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      throw new Error("VERCEL_TOKEN not configured");
    }

    const projectName = (gatheredInfo.businessName || "sms-site")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    const deployName = `${projectName}-${Date.now().toString(36)}`;

    const vercelResponse = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
        ...(vercelTeamId && { "x-vercel-team-id": vercelTeamId }),
      },
      body: JSON.stringify({
        name: deployName,
        files: [
          {
            file: "index.html",
            data: Buffer.from(html).toString("base64"),
            encoding: "base64",
          },
        ],
        projectSettings: { framework: null },
        target: "production",
      }),
    });

    if (!vercelResponse.ok) {
      const errorText = await vercelResponse.text();
      console.error("[SMS] Vercel deploy error:", errorText);
      throw new Error(`Vercel deploy failed: ${vercelResponse.status}`);
    }

    const deployment = await vercelResponse.json();
    const deployedUrl = `https://${deployment.url}`;

    // Update session with deployed URL
    await supabase
      .from("sms_sessions")
      .update({
        status: "deployed",
        deployed_url: deployedUrl,
      })
      .eq("id", sessionId);

    // Send the deployed URL via Twilio SMS
    await sendSms(
      phoneNumber,
      `Your site is live! \uD83C\uDF89 Check it out: ${deployedUrl}\n\nText me if you want any changes!`
    );
  } catch (error) {
    console.error("[SMS] Generation/deploy failed:", error);

    // Revert session to gathering so they can try again
    await supabase
      .from("sms_sessions")
      .update({ status: "gathering" })
      .eq("id", sessionId);

    await sendSms(
      phoneNumber,
      "Your site hit a snag during publishing. Send me any message and I'll try again!"
    );
  }
}

// --- Send SMS via Twilio API ---

async function sendSms(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("[SMS] Twilio credentials not configured");
    return;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SMS] Twilio send error:", errorText);
    }
  } catch (error) {
    console.error("[SMS] Twilio send failed:", error);
  }
}
