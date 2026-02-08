import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-utils";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

const limiter = createRateLimiter(10); // 10 requests per minute per IP

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

async function checkProPlan(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .single();
  return data?.plan === "pro";
}

// POST: Add a custom domain to a project
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip)) {
    return apiError("Too many requests. Please wait a moment.", 429, { "Retry-After": "60" });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    // Check Pro plan
    const isPro = await checkProPlan(supabase, user.id);
    if (!isPro) return apiError("Custom domains require a Pro plan", 403);

    const { projectId, domain } = await request.json();
    if (!projectId || !domain) return apiError("Missing projectId or domain", 400);

    // Validate domain format
    const cleanDomain = domain.trim().toLowerCase();
    if (!DOMAIN_REGEX.test(cleanDomain)) {
      return apiError("Invalid domain format", 400);
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    if (!project) return apiError("Project not found", 404);

    // Check if domain already exists
    const { data: existing } = await supabase
      .from("domains")
      .select("id")
      .eq("domain", cleanDomain)
      .single();
    if (existing) return apiError("Domain already in use", 409);

    if (!VERCEL_TOKEN) {
      return apiError("Deployment service not configured", 500);
    }

    // Get the latest deployment's Vercel project name for this project
    const { data: latestDeploy } = await supabase
      .from("deployments")
      .select("vercel_deployment_id, url")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestDeploy) {
      return apiError("Deploy your project first before adding a custom domain", 400);
    }

    // Extract Vercel project name from deployment URL
    // URL format: https://project-name-hash.vercel.app
    const urlHost = latestDeploy.url?.replace("https://", "").split(".")[0] || "";
    // The Vercel project name is the deployment name prefix
    const vercelProjectName = urlHost.replace(/-[a-z0-9]+$/, "");

    // Add domain to Vercel project
    const vercelUrl = `https://api.vercel.com/v10/projects/${encodeURIComponent(vercelProjectName)}/domains${VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : ""}`;
    const vercelRes = await fetch(vercelUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: cleanDomain }),
    });

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      console.debug("[Domains] Vercel API error:", vercelData);
      return apiError(vercelData.error?.message || "Failed to add domain to Vercel", 500);
    }

    // Save to database
    const { data: domainRecord, error: dbError } = await supabase
      .from("domains")
      .insert({
        user_id: user.id,
        project_id: projectId,
        domain: cleanDomain,
        status: "pending",
        vercel_domain_id: vercelData.name || cleanDomain,
      })
      .select()
      .single();

    if (dbError) {
      console.debug("[Domains] DB error:", dbError);
      return apiError("Failed to save domain", 500);
    }

    return apiSuccess({
      domain: domainRecord,
      verification: {
        type: "CNAME",
        name: cleanDomain,
        value: "cname.vercel-dns.com",
      },
    });
  } catch {
    return apiError("Failed to add domain", 500);
  }
}

// GET: Fetch domains for a project and check verification status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) return apiError("Missing projectId", 400);

    const { data: domains, error } = await supabase
      .from("domains")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return apiError("Failed to fetch domains", 500);

    // Check verification for pending domains via Vercel API
    if (VERCEL_TOKEN && domains) {
      for (const domain of domains) {
        if (domain.status === "pending" || domain.status === "verifying") {
          try {
            // Get latest deployment for project name
            const { data: latestDeploy } = await supabase
              .from("deployments")
              .select("url")
              .eq("project_id", projectId)
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (latestDeploy?.url) {
              const urlHost = latestDeploy.url.replace("https://", "").split(".")[0] || "";
              const vercelProjectName = urlHost.replace(/-[a-z0-9]+$/, "");

              const vercelUrl = `https://api.vercel.com/v10/projects/${encodeURIComponent(vercelProjectName)}/domains/${encodeURIComponent(domain.domain)}${VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : ""}`;
              const vercelRes = await fetch(vercelUrl, {
                headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
              });

              if (vercelRes.ok) {
                const vercelData = await vercelRes.json();
                const newStatus = vercelData.verified ? "active" : "verifying";
                if (newStatus !== domain.status) {
                  await supabase
                    .from("domains")
                    .update({ status: newStatus })
                    .eq("id", domain.id);
                  domain.status = newStatus;
                }
              }
            }
          } catch {
            // Non-critical — keep existing status
          }
        }
      }
    }

    return apiSuccess({ domains: domains || [] });
  } catch {
    return apiError("Failed to fetch domains", 500);
  }
}

// DELETE: Remove a custom domain
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    const { domainId } = await request.json();
    if (!domainId) return apiError("Missing domainId", 400);

    // Fetch domain record
    const { data: domain } = await supabase
      .from("domains")
      .select("*")
      .eq("id", domainId)
      .eq("user_id", user.id)
      .single();

    if (!domain) return apiError("Domain not found", 404);

    // Remove from Vercel if token is configured
    if (VERCEL_TOKEN) {
      try {
        const { data: latestDeploy } = await supabase
          .from("deployments")
          .select("url")
          .eq("project_id", domain.project_id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latestDeploy?.url) {
          const urlHost = latestDeploy.url.replace("https://", "").split(".")[0] || "";
          const vercelProjectName = urlHost.replace(/-[a-z0-9]+$/, "");

          const vercelUrl = `https://api.vercel.com/v10/projects/${encodeURIComponent(vercelProjectName)}/domains/${encodeURIComponent(domain.domain)}${VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : ""}`;
          await fetch(vercelUrl, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
          });
        }
      } catch {
        console.debug("[Domains] Failed to remove from Vercel, continuing with DB cleanup");
      }
    }

    // Delete from database
    const { error } = await supabase
      .from("domains")
      .delete()
      .eq("id", domainId)
      .eq("user_id", user.id);

    if (error) return apiError("Failed to remove domain", 500);

    return apiSuccess({ success: true });
  } catch {
    return apiError("Failed to remove domain", 500);
  }
}
