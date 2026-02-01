"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-400">
      Loading editor...
    </div>
  ),
});

interface CodeEditorProps {
  code: string;
  language: string;
}

function CodeFallback({ code, language }: CodeEditorProps) {
  return (
    <pre className={cn(
      "w-full h-full overflow-auto p-4 bg-gray-900 text-gray-100",
      "font-mono text-sm"
    )}>
      <code className={`language-${language}`}>{code}</code>
    </pre>
  );
}

export function CodeEditor({ code, language }: CodeEditorProps) {
  return (
    <Suspense fallback={<CodeFallback code={code} language={language} />}>
      <MonacoEditor
        height="100%"
        language={language}
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
        }}
      />
    </Suspense>
  );
}
