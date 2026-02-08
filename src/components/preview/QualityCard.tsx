"use client";

import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Search,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  BarChart3,
} from "lucide-react";
import {
  runAccessibilityAudit,
  runSEOCheck,
  runPerformanceCheck,
  computeOverallScore,
} from "@/lib/quality";
import type { A11yResult, SEOResult, PerfResult, QualityScore } from "@/lib/quality";

interface QualityCardProps {
  html: string | null;
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-400";
  if (score >= 70) return "text-zinc-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 90) return "bg-green-500/10";
  if (score >= 70) return "bg-zinc-500/10";
  return "bg-red-500/10";
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);
  const color = score >= 90 ? "#22c55e" : score >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold ${scoreColor(score)}`}>
        {score}
      </span>
    </div>
  );
}

export const QualityCard = memo(function QualityCard({ html }: QualityCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [scores, setScores] = useState<QualityScore | null>(null);
  const [a11y, setA11y] = useState<A11yResult | null>(null);
  const [seo, setSeo] = useState<SEOResult | null>(null);
  const [perf, setPerf] = useState<PerfResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    if (!html || isRunning) return;
    setIsRunning(true);
    setScores(null);
    setA11y(null);
    setSeo(null);
    setPerf(null);
    setExpanded(null);

    try {
      const [a11yResult, seoResult, perfResult] = await Promise.all([
        runAccessibilityAudit(html),
        Promise.resolve(runSEOCheck(html)),
        Promise.resolve(runPerformanceCheck(html)),
      ]);

      setA11y(a11yResult);
      setSeo(seoResult);
      setPerf(perfResult);
      setScores(computeOverallScore(a11yResult.score, seoResult.score, perfResult.score));
    } catch {
      // Silently fail
    } finally {
      setIsRunning(false);
    }
  }, [html, isRunning]);

  if (!html) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-zinc-400" />
          <span className="text-[13px] font-medium text-zinc-300">Site Quality</span>
        </div>
        {scores && <ScoreRing score={scores.overall} size={36} />}
      </div>

      {/* Run button or results */}
      {!scores && !isRunning && (
        <div className="px-4 py-4">
          <button
            onClick={runAudit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Run Quality Audit
          </button>
        </div>
      )}

      {isRunning && (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          <span className="text-[12px] text-zinc-500">Analyzing...</span>
        </div>
      )}

      {scores && (
        <div className="divide-y divide-white/[0.04]">
          {/* Accessibility */}
          <CategoryRow
            icon={<Shield className="w-3.5 h-3.5" />}
            label="Accessibility"
            score={scores.accessibility}
            isExpanded={expanded === "a11y"}
            onToggle={() => setExpanded(expanded === "a11y" ? null : "a11y")}
          >
            {a11y && (
              <div className="space-y-1.5">
                {a11y.issues.length === 0 ? (
                  <p className="text-[12px] text-green-400/80">No accessibility issues found ({a11y.passes} rules passed)</p>
                ) : (
                  a11y.issues.map((issue) => (
                    <div key={issue.id} className="flex items-start gap-2">
                      {issue.impact === "critical" || issue.impact === "serious" ? (
                        <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-zinc-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <span className="text-[11px] text-zinc-300">{issue.description}</span>
                        <span className="text-[10px] text-zinc-600 ml-1.5">({issue.nodes} element{issue.nodes > 1 ? "s" : ""})</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CategoryRow>

          {/* SEO */}
          <CategoryRow
            icon={<Search className="w-3.5 h-3.5" />}
            label="SEO"
            score={scores.seo}
            isExpanded={expanded === "seo"}
            onToggle={() => setExpanded(expanded === "seo" ? null : "seo")}
          >
            {seo && (
              <div className="space-y-1.5">
                {seo.checks.map((check) => (
                  <div key={check.id} className="flex items-start gap-2">
                    {check.passed ? (
                      <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <span className="text-[11px] text-zinc-300">{check.label}</span>
                      <span className="text-[10px] text-zinc-500 ml-1.5">{check.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CategoryRow>

          {/* Performance */}
          <CategoryRow
            icon={<Zap className="w-3.5 h-3.5" />}
            label="Performance"
            score={scores.performance}
            isExpanded={expanded === "perf"}
            onToggle={() => setExpanded(expanded === "perf" ? null : "perf")}
          >
            {perf && (
              <div className="space-y-1.5">
                {perf.hints.map((hint) => (
                  <div key={hint.id} className="flex items-start gap-2">
                    {hint.severity === "good" ? (
                      <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : hint.severity === "warning" ? (
                      <AlertTriangle className="w-3 h-3 text-zinc-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <span className="text-[11px] text-zinc-300">{hint.label}</span>
                      <span className="text-[10px] text-zinc-500 ml-1.5">{hint.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CategoryRow>

          {/* Re-run button */}
          <div className="px-4 py-2.5">
            <button
              onClick={runAudit}
              disabled={isRunning}
              className="w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Re-run audit
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

function CategoryRow({
  icon,
  label,
  score,
  isExpanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-zinc-400">{icon}</span>
        <span className="text-[12px] text-zinc-300 flex-1 text-left">{label}</span>
        <span className={`text-[13px] font-semibold ${scoreColor(score)} ${scoreBg(score)} px-2 py-0.5 rounded`}>
          {score}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 text-zinc-600" />
        ) : (
          <ChevronDown className="w-3 h-3 text-zinc-600" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
