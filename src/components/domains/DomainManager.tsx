"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Globe, Plus, Trash2, Loader2, CheckCircle, Clock, AlertCircle, Copy, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Domain {
  id: string;
  domain: string;
  status: string;
  created_at: string;
}

interface DomainManagerProps {
  projectId: string;
  isPro: boolean;
  onUpgradeClick?: () => void;
}

export function DomainManager({ projectId, isPro, onUpgradeClick }: DomainManagerProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch(`/api/domains?projectId=${encodeURIComponent(projectId)}`);
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // Poll for pending domains every 30s
  useEffect(() => {
    const hasPending = domains.some(d => d.status === "pending" || d.status === "verifying");
    if (hasPending) {
      pollRef.current = setInterval(fetchDomains, 30000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [domains, fetchDomains]);

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, domain: newDomain.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setDomains(prev => [data.domain, ...prev]);
        setNewDomain("");
        setShowInput(false);
      } else {
        setError(data.error || "Failed to add domain");
      }
    } catch {
      setError("Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (domainId: string) => {
    try {
      const res = await fetch("/api/domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      if (res.ok) {
        setDomains(prev => prev.filter(d => d.id !== domainId));
      }
    } catch {
      // Silent fail
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case "verifying": return <Clock className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />;
      case "failed": return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  if (!isPro) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Custom Domain</span>
        </div>
        <p className="text-[12px] text-zinc-500 mb-3">Connect your own domain to your deployed site.</p>
        <button
          onClick={onUpgradeClick}
          className="w-full px-3 py-2 text-[12px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-colors"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-3 flex items-center gap-2 text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[12px]">Loading domains...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-zinc-400" />
          <span className="text-[13px] font-medium text-zinc-300">Custom Domain</span>
        </div>
        {!showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] rounded transition-colors"
            title="Add domain"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Domain input */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="example.com"
                className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                autoFocus
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newDomain.trim()}
                className="px-3 py-2 text-[12px] font-medium text-white bg-green-500/80 hover:bg-green-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
              </button>
              <button
                onClick={() => { setShowInput(false); setError(null); }}
                className="p-2 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {error && (
              <p className="text-[11px] text-red-400 mt-1.5">{error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Domain list */}
      {domains.length === 0 && !showInput ? (
        <p className="text-[12px] text-zinc-600">No custom domains yet.</p>
      ) : (
        <div className="space-y-2">
          {domains.map((domain) => (
            <div key={domain.id} className="flex items-center justify-between gap-2 p-2 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <div className="flex items-center gap-2 min-w-0">
                {statusIcon(domain.status)}
                <span className="text-[12px] text-zinc-300 truncate">{domain.domain}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(domain.domain).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                  title={copied ? "Copied!" : "Copy domain"}
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleRemove(domain.id)}
                  className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                  title="Remove domain"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DNS instructions for pending domains */}
      {domains.some(d => d.status !== "active") && domains.length > 0 && (
        <div className="mt-3 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <p className="text-[11px] font-medium text-zinc-400 mb-1">DNS Configuration</p>
          <p className="text-[11px] text-zinc-500 mb-2">Add this CNAME record at your DNS provider:</p>
          <div className="flex items-center gap-2 bg-black/20 rounded px-2.5 py-1.5">
            <code className="text-[11px] text-zinc-300 font-mono">CNAME &rarr; cname.vercel-dns.com</code>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5">DNS changes can take up to 48 hours to propagate. We check automatically every 30 seconds.</p>
        </div>
      )}
    </div>
  );
}
