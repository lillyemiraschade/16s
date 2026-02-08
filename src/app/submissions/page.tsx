"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { Mail, ChevronDown, ChevronRight, Eye, Inbox } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { UserMenu } from "@/components/auth/UserMenu";
import { Footer } from "@/components/layout/Footer";

interface FormSubmission {
  id: string;
  project_id: string;
  form_data: Record<string, string>;
  is_read: boolean;
  created_at: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function SubmissionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/forms?projectId=all")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load submissions");
        return res.json();
      })
      .then((data) => setSubmissions(data.submissions || []))
      .catch((err) => setError(err.message || "Failed to load submissions"))
      .finally(() => setLoading(false));
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    await fetch("/api/forms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: id, isRead: true }),
    }).catch(() => {});
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_read: true } : s))
    );
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Header */}
      <header className="h-14 md:h-[60px] border-b border-white/[0.04] px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="16s" width={28} height={28} className="object-contain" />
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">
              Home
            </Link>
            <Link href="/submissions" className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-100 bg-white/[0.06] rounded-lg">
              Submissions
            </Link>
          </nav>
        </div>
        <UserMenu />
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl md:text-2xl font-semibold text-zinc-100 mb-2">Form Submissions</h1>
        <p className="text-[14px] text-zinc-500 mb-8">Messages from your deployed site contact forms</p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-green-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-[15px] mb-2">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
              className="text-[13px] text-green-400 hover:text-green-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="w-12 h-12 text-zinc-700 mb-4" />
            <h2 className="text-lg font-medium text-zinc-400 mb-2">No form submissions yet</h2>
            <p className="text-sm text-zinc-600 max-w-md">
              Deploy a site with a contact form to start receiving messages. Form submissions from your live sites will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((sub) => {
              const senderName = sub.form_data.name || sub.form_data.Name || sub.form_data.full_name || "Unknown";
              const senderEmail = sub.form_data.email || sub.form_data.Email || "";
              const message = sub.form_data.message || sub.form_data.Message || sub.form_data.comments || "";
              const isExpanded = expandedId === sub.id;

              return (
                <div
                  key={sub.id}
                  className={`rounded-xl border transition-colors ${
                    sub.is_read
                      ? "border-white/[0.04] bg-white/[0.01]"
                      : "border-green-500/20 bg-green-500/[0.03]"
                  }`}
                >
                  <button
                    onClick={() => {
                      toggleExpand(sub.id);
                      if (!sub.is_read) markAsRead(sub.id);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <Mail className={`w-4 h-4 flex-shrink-0 ${sub.is_read ? "text-zinc-600" : "text-green-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${sub.is_read ? "text-zinc-400" : "text-zinc-200"}`}>
                          {senderName}
                        </span>
                        {senderEmail && (
                          <span className="text-xs text-zinc-600 truncate">&lt;{senderEmail}&gt;</span>
                        )}
                      </div>
                      {message && !isExpanded && (
                        <p className="text-xs text-zinc-600 truncate mt-0.5">{message}</p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-600 flex-shrink-0">{timeAgo(sub.created_at)}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-white/[0.04]">
                      <dl className="mt-3 space-y-2">
                        {Object.entries(sub.form_data).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{key}</dt>
                            <dd className="text-sm text-zinc-300 mt-0.5 whitespace-pre-wrap">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                      {!sub.is_read && (
                        <button
                          onClick={() => markAsRead(sub.id)}
                          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Mark as read
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
