"use client";

import { AuthProvider } from "@/lib/auth/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <GlobalErrorHandler />
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
