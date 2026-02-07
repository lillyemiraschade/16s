"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/error-reporter";

/**
 * Catches unhandled errors and promise rejections at the window level.
 * Mount once in the app's Providers component.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      reportError(new Error(e.message), { type: "unhandled", filename: e.filename, lineno: e.lineno });
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      reportError(new Error(String(e.reason)), { type: "unhandled_rejection" });
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
