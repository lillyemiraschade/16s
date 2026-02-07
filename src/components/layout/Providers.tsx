"use client";

import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { initPostHog, identifyUser } from "@/lib/posthog";

function PostHogInit() {
  const { user } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (user) {
      identifyUser(user.id, { email: user.email });
    }
  }, [user]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <GlobalErrorHandler />
        <PostHogInit />
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
