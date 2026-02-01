"use client";

import { FolderOpen, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  files: Array<{
    path: string;
    language: string;
  }>;
  selectedFile: string;
  onSelect: (path: string) => void;
}

export function FileTree({ files, selectedFile, onSelect }: FileTreeProps) {
  const getFileName = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1];
  };

  const getDirectory = (path: string) => {
    const parts = path.split("/");
    return parts.slice(0, -1).join("/");
  };

  const groupedFiles = files.reduce((acc, file) => {
    const dir = getDirectory(file.path) || "root";
    if (!acc[dir]) {
      acc[dir] = [];
    }
    acc[dir].push(file);
    return acc;
  }, {} as Record<string, typeof files>);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Files
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedFiles).map(([directory, dirFiles]) => (
          <div key={directory} className="py-2">
            {directory !== "root" && (
              <div className="px-4 py-1 text-xs text-muted-foreground font-medium">
                {directory}
              </div>
            )}

            <div className="space-y-0.5">
              {dirFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => onSelect(file.path)}
                  className={cn(
                    "w-full text-left px-4 py-2 flex items-center gap-2",
                    "hover:bg-accent/50 transition-colors",
                    "text-sm",
                    selectedFile === file.path && "bg-accent text-accent-foreground"
                  )}
                >
                  <FileCode className="w-4 h-4 shrink-0" />
                  <span className="truncate">{getFileName(file.path)}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {file.language}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {files.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No files yet
          </div>
        )}
      </div>
    </div>
  );
}
