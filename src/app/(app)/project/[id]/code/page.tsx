"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FileTree } from "@/components/code/FileTree";
import { CodeEditor } from "@/components/code/CodeEditor";
import { Download } from "lucide-react";

const mockProject = {
  name: "E-commerce Platform",
};

const mockFiles = [
  { path: "src/App.tsx", language: "typescript" },
  { path: "src/components/Button.tsx", language: "typescript" },
  { path: "src/components/Card.tsx", language: "typescript" },
  { path: "src/pages/index.tsx", language: "typescript" },
  { path: "src/styles/globals.css", language: "css" },
  { path: "package.json", language: "json" },
];

const mockCode = `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function Button({
  children,
  variant = 'primary',
  onClick
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={\`px-4 py-2 rounded-lg font-medium transition-colors \${
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
      }\`}
    >
      {children}
    </button>
  );
}`;

export default function CodePage() {
  const params = useParams();
  const projectId = params.id as string;
  const [selectedFile, setSelectedFile] = useState(mockFiles[0].path);

  const currentFile = mockFiles.find(f => f.path === selectedFile) || mockFiles[0];

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{mockProject.name}</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <Download className="w-4 h-4" />
          Download ZIP
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <FileTree
          files={mockFiles}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
        />
        <main className="flex-1">
          <CodeEditor
            code={mockCode}
            language={currentFile.language}
          />
        </main>
      </div>
    </div>
  );
}
