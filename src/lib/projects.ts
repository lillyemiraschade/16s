import type { SavedProject, SavedProjectMeta, Message } from "./types";

const STORAGE_KEY = "16s_projects";
const MAX_PROJECTS = 20;

// Validate and sanitize a message to ensure required fields exist
function sanitizeMessage(msg: Partial<Message>, index: number): Message | null {
  // Skip completely invalid messages
  if (!msg || typeof msg !== "object") return null;

  // Ensure required fields exist with valid values
  const id = typeof msg.id === "string" && msg.id ? msg.id : `recovered-${Date.now()}-${index}`;
  const role = msg.role === "user" || msg.role === "assistant" ? msg.role : null;
  const content = typeof msg.content === "string" ? msg.content : null;

  // If role is invalid, skip the message
  if (!role) return null;

  // If content is missing/empty, provide a fallback based on role
  const safeContent = content || (role === "user" ? "[Message content unavailable]" : "I'm working on your request...");

  return {
    id,
    role,
    content: safeContent,
    pills: Array.isArray(msg.pills) ? msg.pills : undefined,
    showUpload: msg.showUpload,
    images: Array.isArray(msg.images) ? msg.images : undefined,
    uploadedImages: Array.isArray(msg.uploadedImages) ? msg.uploadedImages : undefined,
  };
}

// Sanitize all messages in a project
function sanitizeMessages(messages: unknown[]): Message[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((msg, i) => sanitizeMessage(msg as Partial<Message>, i))
    .filter((msg): msg is Message => msg !== null);
}

function getAll(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const projects = raw ? JSON.parse(raw) : [];
    // Sanitize messages in each project
    return projects.map((p: SavedProject) => ({
      ...p,
      messages: sanitizeMessages(p.messages),
    }));
  } catch {
    return [];
  }
}

function setAll(projects: SavedProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function saveProject(project: SavedProject): void {
  const projects = getAll();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  // FIFO eviction
  while (projects.length > MAX_PROJECTS) {
    projects.pop();
  }
  setAll(projects);
}

export function loadProject(id: string): SavedProject | null {
  return getAll().find((p) => p.id === id) ?? null;
}

export function listProjects(): SavedProjectMeta[] {
  return getAll().map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
}

export function deleteProject(id: string): void {
  setAll(getAll().filter((p) => p.id !== id));
}
