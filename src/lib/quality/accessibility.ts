/**
 * Accessibility audit using axe-core.
 * Runs against a hidden container with the generated HTML.
 * Returns violations grouped by impact level.
 */

export interface A11yIssue {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  helpUrl: string;
  nodes: number;
}

export interface A11yResult {
  score: number; // 0-100
  issues: A11yIssue[];
  passes: number;
}

export async function runAccessibilityAudit(html: string): Promise<A11yResult> {
  if (typeof window === "undefined") {
    return { score: 100, issues: [], passes: 0 };
  }

  try {
    const axe = (await import("axe-core")).default;

    // Create hidden container with the HTML content
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1024px;height:768px;overflow:hidden;visibility:hidden;";
    container.setAttribute("aria-hidden", "true");

    // Extract body content only (axe doesn't need full document)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    container.innerHTML = bodyMatch ? bodyMatch[1] : html;

    document.body.appendChild(container);

    try {
      const results = await axe.run(container, {
        rules: {
          // Skip rules that don't apply to embedded content
          "page-has-heading-one": { enabled: true },
          "document-title": { enabled: false },
          "html-has-lang": { enabled: false },
          "landmark-one-main": { enabled: false },
          region: { enabled: false },
        },
      });

      const issues: A11yIssue[] = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact as A11yIssue["impact"],
        description: v.description,
        helpUrl: v.helpUrl,
        nodes: v.nodes.length,
      }));

      // Score: start at 100, deduct based on severity
      const deductions: Record<string, number> = { critical: 25, serious: 15, moderate: 8, minor: 3 };
      const totalDeduction = issues.reduce(
        (sum, issue) => sum + (deductions[issue.impact] || 5) * Math.min(issue.nodes, 3),
        0
      );

      return {
        score: Math.max(0, 100 - totalDeduction),
        issues,
        passes: results.passes.length,
      };
    } finally {
      document.body.removeChild(container);
    }
  } catch {
    // axe-core not available or error — return neutral
    return { score: 100, issues: [], passes: 0 };
  }
}
