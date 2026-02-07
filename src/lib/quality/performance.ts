/**
 * Performance hints — analyzes HTML for common performance issues.
 * Pure function, no network requests.
 */

export interface PerfHint {
  id: string;
  label: string;
  severity: "good" | "warning" | "issue";
  detail: string;
}

export interface PerfResult {
  score: number; // 0-100
  hints: PerfHint[];
}

export function runPerformanceCheck(html: string): PerfResult {
  const hints: PerfHint[] = [];

  // 1. HTML size
  const sizeKB = Math.round(html.length / 1024);
  if (sizeKB > 500) {
    hints.push({ id: "html-size", label: "HTML size", severity: "issue", detail: `${sizeKB}KB — consider splitting into pages` });
  } else if (sizeKB > 200) {
    hints.push({ id: "html-size", label: "HTML size", severity: "warning", detail: `${sizeKB}KB — getting large` });
  } else {
    hints.push({ id: "html-size", label: "HTML size", severity: "good", detail: `${sizeKB}KB` });
  }

  // 2. Inline styles volume
  const styleBlocks = html.match(/<style[\s\S]*?<\/style>/gi) || [];
  const totalStyleSize = styleBlocks.reduce((sum, s) => sum + s.length, 0);
  const styleKB = Math.round(totalStyleSize / 1024);
  if (styleKB > 50) {
    hints.push({ id: "inline-css", label: "Inline CSS", severity: "issue", detail: `${styleKB}KB of inline CSS — extract to stylesheet` });
  } else if (styleKB > 20) {
    hints.push({ id: "inline-css", label: "Inline CSS", severity: "warning", detail: `${styleKB}KB of inline CSS` });
  } else {
    hints.push({ id: "inline-css", label: "Inline CSS", severity: "good", detail: `${styleKB}KB` });
  }

  // 3. Script tags
  const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  const totalScriptSize = scripts.reduce((sum, s) => sum + s.length, 0);
  const scriptKB = Math.round(totalScriptSize / 1024);
  if (scripts.length > 5 || scriptKB > 50) {
    hints.push({ id: "scripts", label: "Scripts", severity: "issue", detail: `${scripts.length} scripts (${scriptKB}KB) — consider bundling` });
  } else if (scripts.length > 2 || scriptKB > 20) {
    hints.push({ id: "scripts", label: "Scripts", severity: "warning", detail: `${scripts.length} scripts (${scriptKB}KB)` });
  } else {
    hints.push({ id: "scripts", label: "Scripts", severity: "good", detail: `${scripts.length} scripts (${scriptKB}KB)` });
  }

  // 4. Image optimization hints
  const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
  const doc = parser?.parseFromString(html, "text/html");
  if (doc) {
    const images = doc.querySelectorAll("img");
    const withoutDimensions = Array.from(images).filter(
      (img) => !img.getAttribute("width") && !img.getAttribute("height") && !img.style.width && !img.style.height
    );
    if (withoutDimensions.length > 0) {
      hints.push({ id: "img-dimensions", label: "Image dimensions", severity: "warning", detail: `${withoutDimensions.length} images missing width/height (causes layout shift)` });
    } else if (images.length > 0) {
      hints.push({ id: "img-dimensions", label: "Image dimensions", severity: "good", detail: `All ${images.length} images have dimensions` });
    }

    const lazyImages = Array.from(images).filter((img) => img.getAttribute("loading") === "lazy");
    if (images.length > 3 && lazyImages.length === 0) {
      hints.push({ id: "img-lazy", label: "Lazy loading", severity: "warning", detail: `${images.length} images — consider loading="lazy" for below-fold images` });
    }
  }

  // 5. DOM depth estimation
  let maxDepth = 0;
  let depth = 0;
  for (let i = 0; i < html.length; i++) {
    if (html[i] === "<" && html[i + 1] !== "/") depth++;
    else if (html[i] === "<" && html[i + 1] === "/") depth--;
    if (depth > maxDepth) maxDepth = depth;
  }
  if (maxDepth > 30) {
    hints.push({ id: "dom-depth", label: "DOM depth", severity: "issue", detail: `~${maxDepth} levels deep — deeply nested DOM hurts performance` });
  } else if (maxDepth > 20) {
    hints.push({ id: "dom-depth", label: "DOM depth", severity: "warning", detail: `~${maxDepth} levels deep` });
  } else {
    hints.push({ id: "dom-depth", label: "DOM depth", severity: "good", detail: `~${maxDepth} levels` });
  }

  // 6. Font loading
  const fontLinks = html.match(/fonts\.googleapis\.com|fonts\.gstatic\.com/g) || [];
  const fontFaces = html.match(/@font-face/g) || [];
  const totalFonts = fontLinks.length + fontFaces.length;
  if (totalFonts > 4) {
    hints.push({ id: "fonts", label: "Font loading", severity: "warning", detail: `${totalFonts} font references — too many fonts slow rendering` });
  } else {
    hints.push({ id: "fonts", label: "Font loading", severity: "good", detail: `${totalFonts} font references` });
  }

  // Score: good=0, warning=-8, issue=-20
  const deductionMap: Record<string, number> = { good: 0, warning: 8, issue: 20 };
  const totalDeduction = hints.reduce((sum, h) => sum + deductionMap[h.severity], 0);
  const score = Math.max(0, 100 - totalDeduction);

  return { score, hints };
}
