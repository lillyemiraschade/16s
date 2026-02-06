import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/";

  // Handle OAuth provider errors (e.g., user denied access)
  if (errorParam) {
    console.error("[Auth Callback] OAuth error:", errorParam, errorDescription);
    const errorMsg = encodeURIComponent(errorDescription || errorParam);
    return NextResponse.redirect(`${origin}/?auth_error=${errorMsg}`);
  }

  if (!code) {
    console.error("[Auth Callback] No code provided");
    return NextResponse.redirect(`${origin}/?auth_error=no_code`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] Session exchange error:", error.message);
      return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
    }

    console.debug("[Auth Callback] Success, redirecting to:", next);
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    console.error("[Auth Callback] Exception:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(message)}`);
  }
}
