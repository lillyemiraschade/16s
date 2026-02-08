import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const limiter = createRateLimiter(20); // 20 submissions per minute per IP

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key);
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// POST — public endpoint for deployed sites to submit form data
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { projectId, fields } = await request.json();

    if (!projectId || !fields || typeof fields !== "object") {
      return new Response(JSON.stringify({ error: "Missing projectId or fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const admin = getAdminSupabase();
    if (!admin) {
      return new Response(JSON.stringify({ error: "Not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Look up project to get owner_id
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("user_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Insert submission
    const { error: insertError } = await admin
      .from("form_submissions")
      .insert({
        project_id: projectId,
        owner_id: project.user_id,
        form_data: fields,
      });

    if (insertError) {
      console.error("[Forms] Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Send email notification (imported dynamically to avoid breaking if not configured)
    try {
      const { sendFormNotification } = await import("@/lib/email");
      // Get owner email
      const { data: { user: ownerUser } } = await admin.auth.admin.getUserById(project.user_id);
      if (ownerUser?.email) {
        await sendFormNotification(ownerUser.email, project.name, fields);
      }
    } catch {
      // Email is optional — don't fail the submission
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
}

// GET — auth required, fetch submissions for a project
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    const projectId = request.nextUrl.searchParams.get("projectId");

    let query = supabase
      .from("form_submissions")
      .select("id, project_id, form_data, is_read, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (projectId && projectId !== "all") {
      query = query.eq("project_id", projectId);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error("[Forms] Query error:", error);
      return apiError("Failed to fetch submissions", 500);
    }

    return apiSuccess({ submissions: submissions || [] });
  } catch {
    return apiError("Failed to fetch submissions", 500);
  }
}

// PATCH — mark submission as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    const { submissionId, isRead } = await request.json();
    if (!submissionId) return apiError("Missing submissionId", 400);

    const { error } = await supabase
      .from("form_submissions")
      .update({ is_read: isRead ?? true })
      .eq("id", submissionId)
      .eq("owner_id", user.id);

    if (error) return apiError("Failed to update", 500);

    return apiSuccess({ success: true });
  } catch {
    return apiError("Failed to update", 500);
  }
}
