/**
 * Aggregate quality scorer — runs all three checks and returns a combined result.
 */

export { runAccessibilityAudit } from "./accessibility";
export type { A11yResult, A11yIssue } from "./accessibility";

export { runSEOCheck } from "./seo-checker";
export type { SEOResult, SEOCheck } from "./seo-checker";

export { runPerformanceCheck } from "./performance";
export type { PerfResult, PerfHint } from "./performance";

export interface QualityScore {
  overall: number;
  accessibility: number;
  seo: number;
  performance: number;
}

export function computeOverallScore(a11y: number, seo: number, perf: number): QualityScore {
  // Weighted average: accessibility 40%, SEO 35%, performance 25%
  const overall = Math.round(a11y * 0.4 + seo * 0.35 + perf * 0.25);
  return { overall, accessibility: a11y, seo, performance: perf };
}
