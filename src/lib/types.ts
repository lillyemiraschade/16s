export interface UploadedImage {
  data: string; // base64 data URL (for thumbnails/AI vision)
  url?: string; // Vercel Blob URL (for embedding in HTML)
  type: "inspo" | "content";
  label?: string; // e.g., "logo", "product photo", "team photo"
}

// BMAD Plan (shown for user approval before building)
export interface BMadPlan {
  summary: string;
  sections: string[];
  style: string;
}

// BMAD QA Report (shown after generation)
export interface BMadQAReport {
  status: "all_good" | "minor_notes" | "needs_fixes";
  checks: Array<{ name: string; passed: boolean; note?: string }>;
  summary: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean | string;
  images?: string[]; // legacy: plain base64 strings
  uploadedImages?: UploadedImage[]; // new: typed images
  plan?: BMadPlan; // BMAD planning phase
  qaReport?: BMadQAReport; // BMAD quality report
}

export type Viewport = "desktop" | "tablet" | "mobile";

export interface SelectedElement {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  computedStyles: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontFamily: string;
    padding: string;
    margin: string;
    borderRadius: string;
  };
  path: string; // CSS selector path to element
}

export interface VersionBookmark {
  id: string;
  name: string;
  versionIndex: number; // Index in previewHistory, or -1 for current
  createdAt: number;
}

// Project context - learned preferences (invisible to user)
export interface ProjectContext {
  brandName?: string;
  industry?: string;
  targetAudience?: string | string[];
  stylePreferences?: string[]; // "modern", "minimal", "bold", etc.
  colorPreferences?: string[]; // hex codes or color names
  fontPreferences?: string[];
  featuresRequested?: string[];
  thingsToAvoid?: string[];
  lastUpdated?: number;
}

export interface SavedProject {
  id: string;
  name: string;
  messages: Message[];
  currentPreview: string | null;
  previewHistory: string[];
  bookmarks: VersionBookmark[];
  context?: ProjectContext; // Learned preferences
  updatedAt: number;
}

export interface SavedProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}

// Code generation mode
export type CodeMode = "html" | "react";

export interface ProjectSettings {
  codeMode: CodeMode;
}
