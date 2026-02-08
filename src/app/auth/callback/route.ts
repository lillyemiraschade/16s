import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  // Sanitize `next` param to prevent open redirect (e.g., next=@evil.com → https://16s.dev@evil.com)
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

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
      let userMessage = error.message;
      if (error.message.includes("code verifier")) {
        userMessage = "Session expired. Please try signing in again.";
      } else if (error.message.includes("already used")) {
        userMessage = "This sign-in link has already been used. Please try again.";
      }
      return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(userMessage)}`);
    }

    // Send welcome email for new signups (fire-and-forget)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && user.created_at) {
        const createdAt = new Date(user.created_at).getTime();
        const isNewUser = Date.now() - createdAt < 60_000; // within last 60s
        if (isNewUser) {
          const { sendWelcomeEmail } = await import("@/lib/email");
          sendWelcomeEmail(user.email, user.user_metadata?.full_name);
        }
      }
    } catch {}

    console.debug("[Auth Callback] Success, redirecting to:", next);
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    console.error("[Auth Callback] Exception:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(message)}`);
  }
}
