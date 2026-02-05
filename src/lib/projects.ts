import type { SavedProject, SavedProjectMeta, Message } from "./types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const STORAGE_KEY = "16s_projects";
const MAX_PROJECTS_LOCAL = 20;

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

// ============================================================================
// LOCAL STORAGE (Guest mode)
// ============================================================================

function getLocalAll(): SavedProject[] {
  if (typeof window === "undefined") return [];
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

function setLocalAll(projects: SavedProject[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function saveLocalProject(project: SavedProject): void {
  const projects = getLocalAll();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  // FIFO eviction
  while (projects.length > MAX_PROJECTS_LOCAL) {
    projects.pop();
  }
  setLocalAll(projects);
}

function loadLocalProject(id: string): SavedProject | null {
  return getLocalAll().find((p) => p.id === id) ?? null;
}

function listLocalProjects(): SavedProjectMeta[] {
  return getLocalAll().map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
}

function deleteLocalProject(id: string): void {
  setLocalAll(getLocalAll().filter((p) => p.id !== id));
}

// ============================================================================
// SUPABASE (Authenticated mode)
// ============================================================================

function getSupabase() {
  const client = createClient();
  if (!client) {
    throw new Error("Supabase not configured");
  }
  return client;
}

async function saveCloudProject(project: SavedProject, userId: string): Promise<void> {
  const supabase = getSupabase();

  console.log("[Projects] Saving to cloud:", { id: project.id, name: project.name, userId });

  const { data, error } = await supabase
    .from("projects")
    .upsert({
      id: project.id,
      user_id: userId,
      name: project.name,
      messages: project.messages,
      current_preview: project.currentPreview,
      preview_history: project.previewHistory,
      bookmarks: project.bookmarks,
      context: project.context || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select();

  if (error) {
    console.error("[Projects] Cloud save error:", error);
    console.error("[Projects] Error details:", { code: error.code, message: error.message, details: error.details });
    throw error;
  }

  console.log("[Projects] Save successful:", data);
}

async function loadCloudProject(id: string, userId: string): Promise<SavedProject | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[Projects] Cloud load error:", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    messages: sanitizeMessages(data.messages as unknown[]),
    currentPreview: data.current_preview,
    previewHistory: data.preview_history as string[],
    bookmarks: data.bookmarks as SavedProject["bookmarks"],
    context: data.context as SavedProject["context"],
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

async function listCloudProjects(userId: string): Promise<SavedProjectMeta[]> {
  const supabase = getSupabase();

  console.log("[Projects] Listing cloud projects for user:", userId);

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[Projects] Cloud list error:", error);
    console.error("[Projects] Error details:", { code: error.code, message: error.message, details: error.details });
    return [];
  }

  console.log("[Projects] Found projects:", data?.length || 0, data);

  return (data || []).map((p: { id: string; name: string; updated_at: string }) => ({
    id: p.id,
    name: p.name,
    updatedAt: new Date(p.updated_at).getTime(),
  }));
}

async function deleteCloudProject(id: string, userId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[Projects] Cloud delete error:", error);
    throw error;
  }
}

// ============================================================================
// MIGRATION: localStorage -> Supabase
// ============================================================================

// Check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Generate a new UUID
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function migrateLocalToCloud(userId: string): Promise<number> {
  const localProjects = getLocalAll();
  if (localProjects.length === 0) return 0;

  let migrated = 0;

  for (const project of localProjects) {
    try {
      // Convert old non-UUID IDs to UUIDs for Supabase compatibility
      const migratedProject = {
        ...project,
        id: isValidUUID(project.id) ? project.id : generateUUID(),
      };

      console.log("[Migration] Migrating project:", project.id, "->", migratedProject.id);
      await saveCloudProject(migratedProject, userId);
      migrated++;
    } catch (e) {
      console.error("[Migration] Failed to migrate project:", project.id, e);
    }
  }

  // Clear local storage after successful migration
  if (migrated > 0) {
    localStorage.removeItem(STORAGE_KEY);
  }

  return migrated;
}

// ============================================================================
// UNIFIED API (auto-selects local vs cloud based on auth)
// ============================================================================

interface ProjectsAPI {
  save: (project: SavedProject) => Promise<void>;
  load: (id: string) => Promise<SavedProject | null>;
  list: () => Promise<SavedProjectMeta[]>;
  delete: (id: string) => Promise<void>;
  migrate: () => Promise<number>;
}

export function createProjectsAPI(userId?: string | null): ProjectsAPI {
  // Use localStorage if not authenticated OR Supabase isn't configured
  if (!userId || !isSupabaseConfigured()) {
    // Guest mode - use localStorage
    return {
      save: async (project) => saveLocalProject(project),
      load: async (id) => loadLocalProject(id),
      list: async () => listLocalProjects(),
      delete: async (id) => deleteLocalProject(id),
      migrate: async () => 0, // No migration for guests
    };
  }

  // Authenticated mode - use Supabase
  return {
    save: async (project) => saveCloudProject(project, userId),
    load: async (id) => loadCloudProject(id, userId),
    list: async () => listCloudProjects(userId),
    delete: async (id) => deleteCloudProject(id, userId),
    migrate: async () => migrateLocalToCloud(userId),
  };
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility during migration)
// ============================================================================

export function saveProject(project: SavedProject): void {
  saveLocalProject(project);
}

export function loadProject(id: string): SavedProject | null {
  return loadLocalProject(id);
}

export function listProjects(): SavedProjectMeta[] {
  return listLocalProjects();
}

export function deleteProject(id: string): void {
  deleteLocalProject(id);
}
