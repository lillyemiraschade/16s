import { createClient } from "@/lib/supabase/server";
import { NextResponse, NextRequest } from "next/server";

export const maxDuration = 30; // 30s — Vercel API calls can be slow

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

// [2026-02-05] Rate limiting — deployments consume Vercel API quota
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // 5 deploys per minute per IP
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // Sweep expired entries when map gets large
    if (rateLimitMap.size > 500) {
      rateLimitMap.forEach((v, k) => { if (now > v.resetAt) rateLimitMap.delete(k); });
    }
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many deployments. Please wait a moment." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    // Check auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!VERCEL_TOKEN) {
      return NextResponse.json({ error: "Vercel token not configured" }, { status: 500 });
    }

    const { html, projectId, projectName } = await request.json();

    if (!html || !projectId) {
      return NextResponse.json({ error: "Missing html or projectId" }, { status: 400 });
    }

    // Size limit: 5MB for HTML payload (Vercel's limit is 6MB per file)
    if (typeof html !== "string" || html.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "HTML too large. Maximum 5MB." }, { status: 413 });
    }

    // Create a clean project name for Vercel
    const safeName = (projectName || "16s-site")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    const deployName = `${safeName}-${Date.now().toString(36)}`;

    // Create deployment using Vercel API
    const vercelResponse = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
        ...(VERCEL_TEAM_ID && { "x-vercel-team-id": VERCEL_TEAM_ID }),
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
        projectSettings: {
          framework: null,
        },
        target: "production",
      }),
    });

    if (!vercelResponse.ok) {
      const errorText = await vercelResponse.text();
      console.debug("[Deploy] Vercel API error:", errorText);
      return NextResponse.json({ error: "Deployment failed" }, { status: 500 });
    }

    const deployment = await vercelResponse.json();

    // Save deployment to database
    const { error: dbError } = await supabase.from("deployments").insert({
      project_id: projectId,
      user_id: user.id,
      vercel_deployment_id: deployment.id,
      url: `https://${deployment.url}`,
      status: deployment.readyState || "pending",
      html_snapshot: html,
    });

    if (dbError) {
      console.debug("[Deploy] Database error:", dbError);
      // Don't fail the request, deployment still succeeded
    }

    return NextResponse.json({
      success: true,
      deploymentId: deployment.id,
      url: `https://${deployment.url}`,
      inspectorUrl: deployment.inspectorUrl,
    });
  } catch (error) {
    console.debug("[Deploy] Error:", error);
    return NextResponse.json({ error: "Deployment failed" }, { status: 500 });
  }
}

// Get deployments for a project
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const { data: deployments, error } = await supabase
      .from("deployments")
      .select("id, url, status, created_at, custom_domain")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.debug("[Deploy] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch deployments" }, { status: 500 });
    }

    return NextResponse.json({ deployments });
  } catch (error) {
    console.debug("[Deploy] Error:", error);
    return NextResponse.json({ error: "Failed to fetch deployments" }, { status: 500 });
  }
}
