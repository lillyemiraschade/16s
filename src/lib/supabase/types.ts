export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          messages: Json;
          current_preview: string | null;
          preview_history: Json;
          bookmarks: Json;
          settings: Json;
          context: Json | null;
          is_public: boolean;
          public_slug: string | null;
          public_preview: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          messages?: Json;
          current_preview?: string | null;
          preview_history?: Json;
          bookmarks?: Json;
          settings?: Json;
          context?: Json | null;
          is_public?: boolean;
          public_slug?: string | null;
          public_preview?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          messages?: Json;
          current_preview?: string | null;
          preview_history?: Json;
          bookmarks?: Json;
          settings?: Json;
          context?: Json | null;
          is_public?: boolean;
          public_slug?: string | null;
          public_preview?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      deployments: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          vercel_deployment_id: string | null;
          url: string | null;
          custom_domain: string | null;
          status: string;
          html_snapshot: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          vercel_deployment_id?: string | null;
          url?: string | null;
          custom_domain?: string | null;
          status?: string;
          html_snapshot?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          vercel_deployment_id?: string | null;
          url?: string | null;
          custom_domain?: string | null;
          status?: string;
          html_snapshot?: string | null;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: string;
          status: string;
          credits_remaining: number;
          credits_reset_at: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: string;
          status?: string;
          credits_remaining?: number;
          credits_reset_at?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: string;
          status?: string;
          credits_remaining?: number;
          credits_reset_at?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      usage: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          credits_used: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          credits_used?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          credits_used?: number;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
