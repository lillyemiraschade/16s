import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[Auth Callback] Exchange error:", error.message);
        return NextResponse.redirect(`${origin}/?error=auth&message=${encodeURIComponent(error.message)}`);
      }

      console.log("[Auth Callback] Success, user:", data.user?.email);

      // Redirect to home page after successful auth
      const response = NextResponse.redirect(`${origin}${next}`);
      return response;
    } catch (e) {
      console.error("[Auth Callback] Exception:", e);
      return NextResponse.redirect(`${origin}/?error=auth`);
    }
  }

  // No code provided
  return NextResponse.redirect(`${origin}/?error=no_code`);
}
