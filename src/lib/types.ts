export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pills?: string[];
  showUpload?: boolean | string;
  images?: string[];
}

export type Viewport = "desktop" | "tablet" | "mobile";
