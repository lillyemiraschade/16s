"use client";

import { AuthProvider } from "@/lib/auth/AuthContext";
import { AuthGate } from "@/components/auth/AuthGate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
