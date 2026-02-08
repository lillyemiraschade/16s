import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-utils";

// POST — Push project HTML to a GitHub repo
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError("Unauthorized", 401);

    const githubToken = user.user_metadata?.github_token;
    if (!githubToken) {
      return apiError("Connect GitHub first", 401);
    }

    const { projectId, repoName, isPrivate } = await request.json();
    if (!projectId || !repoName) return apiError("Missing projectId or repoName", 400);

    // Get project HTML
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, current_preview")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project?.current_preview) {
      return apiError("Project not found or no preview", 404);
    }

    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };

    // Get GitHub username
    const userRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
    if (!userRes.ok) {
      return apiError("GitHub token expired. Please reconnect.", 401);
    }
    const ghUser = await userRes.json();
    const owner = ghUser.login;

    // Create repo (ignore 422 if already exists)
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({
        name: repoName,
        private: isPrivate ?? false,
        description: `Built with 16s — try16s.app`,
        auto_init: false,
      }),
    });

    if (!createRes.ok && createRes.status !== 422) {
      const err = await createRes.json();
      return apiError(err.message || "Failed to create repo", createRes.status);
    }

    // Check if index.html already exists (need SHA for update)
    let existingSha: string | undefined;
    const getFileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
      { headers: ghHeaders },
    );
    if (getFileRes.ok) {
      const fileData = await getFileRes.json();
      existingSha = fileData.sha;
    }

    // Commit index.html
    const htmlContent = Buffer.from(project.current_preview).toString("base64");
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
      {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: "Deploy from 16s",
          content: htmlContent,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      },
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      return apiError(err.message || "Failed to commit file", putRes.status);
    }

    // Also commit README.md
    let readmeSha: string | undefined;
    const getReadmeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`,
      { headers: ghHeaders },
    );
    if (getReadmeRes.ok) {
      const readmeData = await getReadmeRes.json();
      readmeSha = readmeData.sha;
    }

    const readmeContent = Buffer.from(
      `# ${project.name}\n\nBuilt with [16s](https://try16s.app) — AI Web Designer\n`,
    ).toString("base64");

    await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`,
      {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: "Add README",
          content: readmeContent,
          ...(readmeSha ? { sha: readmeSha } : {}),
        }),
      },
    ).catch(() => {}); // README is optional, don't fail

    const repoUrl = `https://github.com/${owner}/${repoName}`;
    return apiSuccess({ success: true, repoUrl });
  } catch (error) {
    console.error("[GitHub Export] Error:", error);
    return apiError("Export failed", 500);
  }
}
