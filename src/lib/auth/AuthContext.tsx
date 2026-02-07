"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  credits: number | null; // null = unknown/unlimited, number = remaining
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: "google" | "github") => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);

  const isConfigured = useMemo(() => isSupabaseConfigured(), []);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // If Supabase isn't configured, skip auth and stay in guest mode
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Fetch credits when user changes
  useEffect(() => {
    if (!supabase || !user) { setCredits(null); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("subscriptions")
          .select("credits_remaining")
          .eq("user_id", user.id)
          .single();
        setCredits(data?.credits_remaining ?? null);
      } catch {
        setCredits(null);
      }
    })();
  }, [supabase, user]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Auth not configured") };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, [supabase]);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Auth not configured") };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  }, [supabase]);

  const signInWithOAuth = useCallback(async (provider: "google" | "github") => {
    if (!supabase) {
      console.debug("[Auth] Supabase not configured");
      return { error: new Error("Auth not configured") };
    }

    const redirectTo = `${window.location.origin}/auth/callback`;
    console.debug("[Auth] Starting OAuth with", provider);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.debug("[Auth] OAuth error:", error.message);
    } else {
      console.debug("[Auth] OAuth initiated");
    }

    return { error: error as Error | null };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isConfigured,
    credits,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
  }), [user, session, loading, isConfigured, credits, signInWithEmail, signUpWithEmail, signInWithOAuth, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
