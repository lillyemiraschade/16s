"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
  onError?: (error: Error, componentStack: string) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.debug("ErrorBoundary caught:", error, info.componentStack);
    this.props.onError?.(error, info.componentStack || "");
  }

  handleRetry = () => {
    // Increment resetKey to force a full remount of children
    this.setState((prev) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <div>
            <p className="text-zinc-300 text-[14px] font-medium mb-1">
              {this.props.fallbackLabel ?? "Something went wrong"}
            </p>
            <p className="text-zinc-600 text-[12px]">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 text-[13px] font-medium rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 text-[13px] font-medium rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    // Use key to force remount on retry
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}
