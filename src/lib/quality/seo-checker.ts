/**
 * SEO checker — pure function that analyzes HTML for common SEO issues.
 * 8 checks covering essential on-page SEO factors.
 */

export interface SEOCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface SEOResult {
  score: number; // 0-100
  checks: SEOCheck[];
}

export function runSEOCheck(html: string): SEOResult {
  const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
  const doc = parser?.parseFromString(html, "text/html");

  const checks: SEOCheck[] = [
    // 1. Title tag
    (() => {
      const title = doc?.querySelector("title")?.textContent?.trim() || "";
      if (!title) return { id: "title", label: "Page title", passed: false, detail: "Missing <title> tag" };
      if (title.length < 10) return { id: "title", label: "Page title", passed: false, detail: `Title too short (${title.length} chars, aim for 30-60)` };
      if (title.length > 70) return { id: "title", label: "Page title", passed: false, detail: `Title too long (${title.length} chars, aim for 30-60)` };
      return { id: "title", label: "Page title", passed: true, detail: `"${title.slice(0, 50)}${title.length > 50 ? "..." : ""}"` };
    })(),

    // 2. Meta description
    (() => {
      const meta = doc?.querySelector('meta[name="description"]');
      const desc = meta?.getAttribute("content")?.trim() || "";
      if (!desc) return { id: "meta-desc", label: "Meta description", passed: false, detail: "Missing meta description" };
      if (desc.length < 50) return { id: "meta-desc", label: "Meta description", passed: false, detail: `Too short (${desc.length} chars, aim for 120-160)` };
      if (desc.length > 170) return { id: "meta-desc", label: "Meta description", passed: false, detail: `Too long (${desc.length} chars, aim for 120-160)` };
      return { id: "meta-desc", label: "Meta description", passed: true, detail: `${desc.length} chars` };
    })(),

    // 3. H1 heading
    (() => {
      const h1s = doc?.querySelectorAll("h1") || [];
      if (h1s.length === 0) return { id: "h1", label: "H1 heading", passed: false, detail: "No <h1> found" };
      if (h1s.length > 1) return { id: "h1", label: "H1 heading", passed: false, detail: `${h1s.length} H1s found (use only one)` };
      return { id: "h1", label: "H1 heading", passed: true, detail: `"${(h1s[0].textContent || "").trim().slice(0, 40)}"` };
    })(),

    // 4. Image alt text
    (() => {
      const images = doc?.querySelectorAll("img") || [];
      if (images.length === 0) return { id: "img-alt", label: "Image alt text", passed: true, detail: "No images found" };
      const missing = Array.from(images).filter((img) => !img.getAttribute("alt")?.trim());
      if (missing.length > 0) return { id: "img-alt", label: "Image alt text", passed: false, detail: `${missing.length} of ${images.length} images missing alt text` };
      return { id: "img-alt", label: "Image alt text", passed: true, detail: `All ${images.length} images have alt text` };
    })(),

    // 5. Viewport meta
    (() => {
      const viewport = doc?.querySelector('meta[name="viewport"]');
      if (!viewport) return { id: "viewport", label: "Viewport meta", passed: false, detail: "Missing viewport meta tag" };
      return { id: "viewport", label: "Viewport meta", passed: true, detail: "Present" };
    })(),

    // 6. Heading hierarchy
    (() => {
      const headings = doc?.querySelectorAll("h1, h2, h3, h4, h5, h6") || [];
      if (headings.length === 0) return { id: "headings", label: "Heading hierarchy", passed: false, detail: "No headings found" };
      let skipped = false;
      let prevLevel = 0;
      headings.forEach((h) => {
        const level = parseInt(h.tagName[1]);
        if (prevLevel > 0 && level > prevLevel + 1) skipped = true;
        prevLevel = level;
      });
      if (skipped) return { id: "headings", label: "Heading hierarchy", passed: false, detail: "Heading levels are skipped (e.g., H1 to H3)" };
      return { id: "headings", label: "Heading hierarchy", passed: true, detail: `${headings.length} headings, proper nesting` };
    })(),

    // 7. Links with descriptive text
    (() => {
      const links = doc?.querySelectorAll("a") || [];
      if (links.length === 0) return { id: "links", label: "Link text", passed: true, detail: "No links found" };
      const bad = Array.from(links).filter((a) => {
        const text = (a.textContent || "").trim().toLowerCase();
        return text === "click here" || text === "here" || text === "read more" || text === "link" || !text;
      });
      if (bad.length > 0) return { id: "links", label: "Link text", passed: false, detail: `${bad.length} links have non-descriptive text` };
      return { id: "links", label: "Link text", passed: true, detail: `${links.length} links with descriptive text` };
    })(),

    // 8. Language attribute
    (() => {
      const htmlEl = doc?.querySelector("html");
      const lang = htmlEl?.getAttribute("lang");
      if (!lang) return { id: "lang", label: "Language attribute", passed: false, detail: 'Missing lang attribute on <html>' };
      return { id: "lang", label: "Language attribute", passed: true, detail: `lang="${lang}"` };
    })(),
  ];

  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);

  return { score, checks };
}
