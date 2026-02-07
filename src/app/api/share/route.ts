import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-utils";

const limiter = createRateLimiter(10); // 10 shares per minute per IP

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "project"}-${suffix}`;
}

// POST: Share a project publicly
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return apiError("Too many requests. Please wait a moment.", 429, { "Retry-After": "60" });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    const { projectId } = await request.json();
    if (!projectId) return apiError("Missing projectId", 400);

    // Fetch project, verify ownership
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id, name, current_preview, is_public, public_slug")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !project) return apiError("Project not found", 404);

    // If already shared, return existing URL
    if (project.is_public && project.public_slug) {
      const origin = request.headers.get("origin") || request.nextUrl.origin;
      return apiSuccess({
        url: `${origin}/share/${project.public_slug}`,
        slug: project.public_slug,
      });
    }

    if (!project.current_preview) {
      return apiError("No preview to share. Generate a website first.", 400);
    }

    const slug = generateSlug(project.name);

    // Set public + snapshot
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        is_public: true,
        public_slug: slug,
        public_preview: project.current_preview,
      })
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (updateError) {
      // Slug collision — retry once with new slug
      if (updateError.code === "23505") {
        const retrySlug = generateSlug(project.name);
        const { error: retryError } = await supabase
          .from("projects")
          .update({
            is_public: true,
            public_slug: retrySlug,
            public_preview: project.current_preview,
          })
          .eq("id", projectId)
          .eq("user_id", user.id);

        if (retryError) return apiError("Failed to share project", 500);

        const origin = request.headers.get("origin") || request.nextUrl.origin;
        return apiSuccess({ url: `${origin}/share/${retrySlug}`, slug: retrySlug });
      }
      return apiError("Failed to share project", 500);
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const shareUrl = `${origin}/share/${slug}`;

    // Send share notification email (fire-and-forget)
    try {
      const { sendShareEmail } = await import("@/lib/email");
      if (user.email) {
        sendShareEmail(user.email, project.name, shareUrl);
      }
    } catch {}

    return apiSuccess({ url: shareUrl, slug });
  } catch {
    return apiError("Failed to share project", 500);
  }
}

// DELETE: Unshare a project
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    const { projectId } = await request.json();
    if (!projectId) return apiError("Missing projectId", 400);

    const { error } = await supabase
      .from("projects")
      .update({
        is_public: false,
        public_slug: null,
        public_preview: null,
      })
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) return apiError("Failed to unshare project", 500);

    return apiSuccess({ success: true });
  } catch {
    return apiError("Failed to unshare project", 500);
  }
}

// GET: Fetch a public project by slug, or check share status by projectId
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const projectId = request.nextUrl.searchParams.get("projectId");

  try {
    const supabase = await createClient();

    // Check share status for own project (auth required)
    if (projectId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return apiError("Unauthorized", 401);

      const { data: project } = await supabase
        .from("projects")
        .select("is_public, public_slug")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

      if (!project) return apiError("Project not found", 404);

      const origin = request.headers.get("origin") || request.nextUrl.origin;
      return apiSuccess({
        isPublic: project.is_public,
        slug: project.public_slug,
        url: project.is_public && project.public_slug
          ? `${origin}/share/${project.public_slug}`
          : null,
      });
    }

    // Public fetch by slug (no auth)
    if (!slug) return apiError("Missing slug or projectId", 400);

    const { data: project, error } = await supabase
      .from("projects")
      .select("name, public_preview")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .single();

    if (error || !project) return apiError("Project not found", 404);

    return apiSuccess({
      name: project.name,
      html: project.public_preview,
    });
  } catch {
    return apiError("Failed to fetch project", 500);
  }
}
