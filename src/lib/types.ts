export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean | string;
  images?: string[];
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

export interface SavedProject {
  id: string;
  name: string;
  messages: Message[];
  currentPreview: string | null;
  previewHistory: string[];
  updatedAt: number;
}

export interface SavedProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}
