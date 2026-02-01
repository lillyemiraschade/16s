import { create } from "zustand";

interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ProjectState {
  currentProject: Project | null;
  files: ProjectFile[];
  activeFile: string | null;
}

interface ProjectActions {
  setProject: (project: Project | null) => void;
  setFiles: (files: ProjectFile[]) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  files: [],
  activeFile: null,

  setProject: (project) =>
    set({ currentProject: project }),

  setFiles: (files) =>
    set({ files }),

  setActiveFile: (path) =>
    set({ activeFile: path }),

  updateFileContent: (path, content) =>
    set((state) => ({
      files: state.files.map((file) =>
        file.path === path ? { ...file, content } : file
      ),
    })),
}));
