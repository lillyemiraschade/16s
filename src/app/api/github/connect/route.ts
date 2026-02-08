import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;

// GET — Redirect to GitHub OAuth to grant repo access
export async function GET() {
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: "GitHub not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://try16s.app";
  if (!user) {
    return NextResponse.redirect(new URL("/", appUrl));
  }

  const redirectUri = `${appUrl}/api/github/connect/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user.id}`;

  return NextResponse.redirect(url);
}
