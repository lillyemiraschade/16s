export interface UploadedImage {
  data: string; // base64 data URL (for thumbnails/AI vision)
  url?: string; // Vercel Blob URL (for embedding in HTML)
  type: "inspo" | "content";
  label?: string; // e.g., "logo", "product photo", "team photo"
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean | string;
  images?: string[]; // legacy: plain base64 strings
  uploadedImages?: UploadedImage[]; // new: typed images
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

export interface SavedProject {
  id: string;
  name: string;
  messages: Message[];
  currentPreview: string | null;
  previewHistory: string[];
  bookmarks: VersionBookmark[];
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
