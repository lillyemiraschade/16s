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
  if (!user) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SUPABASE_URL || "https://try16s.app"));
  }

  const redirectUri = `https://try16s.app/api/github/connect/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user.id}`;

  return NextResponse.redirect(url);
}
