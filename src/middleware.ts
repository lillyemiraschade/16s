import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Allowed origins for CORS on API routes
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://try16s.app";
const ALLOWED_ORIGINS = [
  APP_URL,
  "https://www.try16s.app",
];
if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push("http://localhost:3000");
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // No Origin header = same-origin or non-browser (Stripe webhooks, curl)
  return ALLOWED_ORIGINS.includes(origin);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // CORS check on API routes — reject cross-origin requests from unknown origins
  // /api/forms is exempt — deployed sites on any domain POST form submissions back
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/forms")) {
    if (!isAllowedOrigin(origin)) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For preflight OPTIONS requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin || ALLOWED_ORIGINS[0],
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
  }

  // Skip Supabase session handling if not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const response = NextResponse.next();
    // Add CORS headers for API routes (/api/forms handles its own)
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/forms") && origin && isAllowedOrigin(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    return response;
  }

  let response: NextResponse;
  try {
    response = await updateSession(request);
  } catch {
    // Supabase unreachable — pass through without session
    response = NextResponse.next();
  }
  // Add CORS headers for API routes (/api/forms handles its own)
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/forms") && origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
