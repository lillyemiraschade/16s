import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// GET — GitHub OAuth callback, exchange code for token and store it
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  if (!code || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(`${origin}/app?github_error=missing_config`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[GitHub] Token exchange failed:", tokenData);
      return NextResponse.redirect(`${origin}/app?github_error=token_failed`);
    }

    // Store token in user metadata
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      data: { github_token: tokenData.access_token },
    });

    if (error) {
      console.error("[GitHub] Failed to store token:", error);
      return NextResponse.redirect(`${origin}/app?github_error=store_failed`);
    }

    return NextResponse.redirect(`${origin}/app?github=connected`);
  } catch (err) {
    console.error("[GitHub] Callback error:", err);
    return NextResponse.redirect(`${origin}/app?github_error=unknown`);
  }
}
