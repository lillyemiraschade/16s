export interface UploadedImage {
  id?: string; // stable identifier for matching across async ops (absent in legacy data)
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

// API response from /api/chat (matches route.ts ChatResponse)
export interface ChatAPIResponse {
  message: string;
  pills?: string[];
  showUpload?: boolean | string;
  html?: string;
  react?: string;
  plan?: BMadPlan;
  qaReport?: BMadQAReport;
  context?: Omit<ProjectContext, "lastUpdated">;
}

// Props for ChatPanel component
export interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string, imagesToInclude?: UploadedImage[]) => void;
  onPillClick: (pill: string) => void;
  onImageUpload: (base64: string, type?: "inspo" | "content", label?: string) => void;
  onImageRemove: (index: number) => void;
  onImageTypeToggle: (index: number) => void;
  onImageUpdate: (index: number, newData: string) => void;
  isGenerating: boolean;
  onStop: () => void;
  uploadedImages: UploadedImage[];
  onNewProject: () => void;
  isOnCall: boolean;
  onStartCall: () => void;
  hasPreview: boolean;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  saveStatus?: "idle" | "saving" | "saved";
  discussionMode?: boolean;
  onToggleDiscussionMode?: () => void;
}

// Props for PreviewPanel component
export interface PreviewPanelProps {
  html: string | null;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  isGenerating: boolean;
  canGoBack: boolean;
  canRedo: boolean;
  onBack: () => void;
  onRedo: () => void;
  onExport: () => void;
  onExportZip: () => void;
  onCopyToClipboard: () => void;
  onOpenInNewTab: () => void;
  onIframeLoad?: (iframe: HTMLIFrameElement) => void;
  previewHistory: string[];
  onRestoreVersion: (index: number) => void;
  selectMode: boolean;
  onSelectModeChange: (enabled: boolean) => void;
  selectedElement: SelectedElement | null;
  onElementSelect: (element: SelectedElement | null) => void;
  bookmarks: VersionBookmark[];
  onAddBookmark: (name: string) => void;
  onRemoveBookmark: (id: string) => void;
  onRestoreBookmark: (bookmark: VersionBookmark) => void;
  onDeploy?: () => void;
  isDeploying?: boolean;
  lastDeployUrl?: string | null;
  deployError?: string | null;
  onCodeChange?: (code: string) => void;
  codeMode?: CodeMode;
  onCodeModeChange?: (mode: CodeMode) => void;
  onShare?: () => void;
  onUnshare?: () => void;
  isSharing?: boolean;
  shareUrl?: string | null;
  projectId?: string | null;
  isPro?: boolean;
  onUpgradeClick?: () => void;
  onRevertToDeployment?: (html: string) => void;
  onPublish?: () => void;
  onGitHubExport?: (repoName: string, isPrivate: boolean) => void;
  isGitHubConnected?: boolean;
  isExportingToGitHub?: boolean;
}
