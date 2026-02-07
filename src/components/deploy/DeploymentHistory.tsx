"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, ExternalLink, RotateCcw, X, CheckCircle, Clock, Loader2 } from "lucide-react";

interface Deployment {
  id: string;
  url: string;
  status: string;
  created_at: string;
  custom_domain: string | null;
  html_snapshot?: string;
}

interface DeploymentHistoryProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onRevert: (html: string) => void;
  currentPreview: string | null;
  latestDeployUrl: string | null;
}

export function DeploymentHistory({
  projectId,
  isOpen,
  onClose,
  onRevert,
  currentPreview,
  latestDeployUrl,
}: DeploymentHistoryProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchDeployments = useCallback(async () => {
    try {
      const res = await fetch(`/api/deploy?projectId=${encodeURIComponent(projectId)}`);
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchDeployments();
    }
  }, [isOpen, fetchDeployments]);

  const handleRevert = async (deployment: Deployment) => {
    setReverting(deployment.id);
    try {
      // Fetch the full deployment with html_snapshot
      const res = await fetch(`/api/deploy?projectId=${encodeURIComponent(projectId)}&deploymentId=${encodeURIComponent(deployment.id)}`);
      if (res.ok) {
        const data = await res.json();
        const snap = data.deployment?.html_snapshot;
        if (snap) {
          onRevert(snap);
          onClose();
        }
      }
    } catch {
      // Silent
    } finally {
      setReverting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Check if current preview differs from latest deployment
  const hasUnpublishedChanges = latestDeployUrl && currentPreview && deployments.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute top-0 right-0 bottom-0 w-[280px] bg-zinc-900/95 backdrop-blur-sm border-l border-white/[0.06] z-20 flex flex-col"
        >
          {/* Header */}
          <div className="h-[52px] flex items-center justify-between px-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <span className="text-[13px] font-medium text-zinc-200">Deployments</span>
              {deployments.length > 0 && (
                <span className="text-[11px] text-zinc-600">({deployments.length})</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : deployments.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-zinc-500">No deployments yet</p>
                <p className="text-[11px] text-zinc-600 mt-1">Deploy your site to see history here</p>
              </div>
            ) : (
              <div className="py-2">
                {deployments.map((deployment, i) => (
                  <div
                    key={deployment.id}
                    className="relative px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                    onMouseEnter={() => setHoveredId(deployment.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Timeline line */}
                    {i < deployments.length - 1 && (
                      <div className="absolute left-[26px] top-[38px] bottom-0 w-px bg-white/[0.06]" />
                    )}

                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <div className={`w-3 h-3 mt-0.5 rounded-full flex-shrink-0 ${
                        i === 0 ? "bg-green-500" : "bg-zinc-600"
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {i === 0 && (
                            <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Latest</span>
                          )}
                          <span className="text-[11px] text-zinc-500">{formatDate(deployment.created_at)}</span>
                        </div>

                        {/* URL */}
                        <p className="text-[11px] text-zinc-400 truncate mb-2">
                          {deployment.custom_domain || deployment.url?.replace("https://", "")}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <a
                            href={deployment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.06] rounded transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" /> Open
                          </a>
                          {i > 0 && (
                            <button
                              onClick={() => handleRevert(deployment)}
                              disabled={reverting === deployment.id}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] text-amber-500 hover:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 rounded transition-colors disabled:opacity-50"
                            >
                              {reverting === deployment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              Revert
                            </button>
                          )}
                        </div>

                        {/* Hover preview tooltip */}
                        <AnimatePresence>
                          {hoveredId === deployment.id && deployment.url && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="mt-2 p-2 bg-zinc-800 border border-white/[0.08] rounded-lg"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                {deployment.status === "READY" || i === 0 ? (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Clock className="w-3 h-3 text-zinc-500" />
                                )}
                                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                                  {deployment.status === "READY" || i === 0 ? "Live" : deployment.status}
                                </span>
                              </div>
                              <a
                                href={deployment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-green-400 hover:underline break-all"
                              >
                                {deployment.url}
                              </a>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
