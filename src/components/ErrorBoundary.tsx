"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.debug("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <p className="text-zinc-400 text-sm">
            {this.props.fallbackLabel ?? "Something went wrong"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
