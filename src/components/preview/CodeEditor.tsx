"use client";

import { useCallback, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { motion } from "framer-motion";
import type * as monacoType from "monaco-editor";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language?: "html" | "typescript" | "css";
  readOnly?: boolean;
}

export function CodeEditor({ code, onChange, language = "html", readOnly = false }: CodeEditorProps) {
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Configure editor theme
    monaco.editor.defineTheme("16s-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6b7280", fontStyle: "italic" },
        { token: "keyword", foreground: "22c55e" },
        { token: "string", foreground: "fbbf24" },
        { token: "number", foreground: "60a5fa" },
        { token: "tag", foreground: "22c55e" },
        { token: "attribute.name", foreground: "a78bfa" },
        { token: "attribute.value", foreground: "fbbf24" },
        { token: "delimiter.html", foreground: "6b7280" },
        { token: "metatag.html", foreground: "22c55e" },
        { token: "metatag.content.html", foreground: "d1d5db" },
      ],
      colors: {
        "editor.background": "#0c0c0d",
        "editor.foreground": "#d1d5db",
        "editor.lineHighlightBackground": "#ffffff08",
        "editor.selectionBackground": "#22c55e30",
        "editor.inactiveSelectionBackground": "#22c55e15",
        "editorCursor.foreground": "#22c55e",
        "editorLineNumber.foreground": "#3f3f46",
        "editorLineNumber.activeForeground": "#71717a",
        "editorIndentGuide.background1": "#27272a",
        "editorIndentGuide.activeBackground1": "#3f3f46",
        "editor.selectionHighlightBackground": "#22c55e20",
        "editorBracketMatch.background": "#22c55e20",
        "editorBracketMatch.border": "#22c55e40",
        "scrollbar.shadow": "#00000000",
        "scrollbarSlider.background": "#ffffff10",
        "scrollbarSlider.hoverBackground": "#ffffff20",
        "scrollbarSlider.activeBackground": "#ffffff30",
      },
    });

    monaco.editor.setTheme("16s-dark");

    // Configure HTML language defaults
    if (language === "html") {
      monaco.languages.html.htmlDefaults.setOptions({
        format: {
          tabSize: 2,
          insertSpaces: true,
          wrapLineLength: 120,
          indentInnerHtml: true,
        },
      });
    }

    // Configure TypeScript defaults
    if (language === "typescript") {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.React,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      });
    }

    // Add keyboard shortcut for formatting
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      editor.getAction("editor.action.formatDocument")?.run();
    });

    // Focus the editor
    editor.focus();
  }, [language]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="w-full h-full rounded-xl overflow-hidden glass"
    >
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          wrappingStrategy: "advanced",
          padding: { top: 16, bottom: 16 },
          lineNumbers: "on",
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          folding: true,
          foldingHighlight: true,
          showFoldingControls: "mouseover",
          bracketPairColorization: { enabled: true },
          guides: {
            indentation: true,
            bracketPairs: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="text-zinc-500 text-[13px]">Loading editor...</div>
          </div>
        }
      />
    </motion.div>
  );
}
