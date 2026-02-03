import type { SavedProject, SavedProjectMeta } from "./types";

const STORAGE_KEY = "16s_projects";
const MAX_PROJECTS = 20;

function getAll(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
