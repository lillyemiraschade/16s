"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AgentStatus = "idle" | "thinking" | "working" | "done";

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    title: string;
    avatar: string;
    color: string;
    status: AgentStatus;
    task?: string;
  };
}

const statusConfig: Record<AgentStatus, { label: string; dotColor: string }> = {
  idle: { label: "Idle", dotColor: "#64748b" },
  thinking: { label: "Thinking", dotColor: "#a855f7" },
  working: { label: "Active", dotColor: "#22c55e" },
  done: { label: "Complete", dotColor: "#06b6d4" },
};

export function AgentCard({ agent }: AgentCardProps) {
  const statusStyle = statusConfig[agent.status];
  const isActive = agent.status === "working" || agent.status === "thinking";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "glass rounded-lg p-4 transition-all",
        isActive && "glow"
      )}
      style={{
        borderColor: isActive ? agent.color : "transparent",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Hexagonal avatar badge */}
        <div className="relative shrink-0">
          <motion.div
            animate={{
              boxShadow: isActive
                ? `0 0 20px ${agent.color}40, 0 0 40px ${agent.color}20`
                : "none",
            }}
            className="w-12 h-12 flex items-center justify-center font-bold text-sm"
            style={{
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              backgroundColor: `${agent.color}30`,
              color: agent.color,
              border: `2px solid ${agent.color}`,
            }}
          >
            {agent.avatar}
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.div
                animate={{
                  scale: isActive ? [1, 1.2, 1] : 1,
                  opacity: isActive ? [1, 0.5, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: isActive ? Infinity : 0,
                }}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusStyle.dotColor }}
              />
              <span className="text-xs text-muted-foreground">{statusStyle.label}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-2 font-mono">{agent.title}</p>

          {agent.status === "thinking" && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground font-mono">
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              >
                .
              </motion.span>
            </div>
          )}

          {agent.task && agent.status !== "thinking" && (
            <p className="text-sm text-foreground/80 line-clamp-2 font-mono">
              {agent.task}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
