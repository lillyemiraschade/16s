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

const statusConfig: Record<AgentStatus, { label: string; className: string }> = {
  idle: { label: "Idle", className: "bg-gray-500/20 text-gray-400" },
  thinking: { label: "Thinking", className: "bg-purple-500/20 text-purple-400" },
  working: { label: "Working", className: "bg-blue-500/20 text-blue-400" },
  done: { label: "Done", className: "bg-green-500/20 text-green-400" },
};

export function AgentCard({ agent }: AgentCardProps) {
  const statusStyle = statusConfig[agent.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-lg p-4 hover:border-accent transition-colors"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white shrink-0",
            agent.status === "thinking" && "animate-pulse"
          )}
          style={{
            borderWidth: "2px",
            borderStyle: "solid",
            borderColor: agent.color,
            backgroundColor: `${agent.color}20`
          }}
        >
          {agent.avatar}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                statusStyle.className
              )}
            >
              {statusStyle.label}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-2">{agent.title}</p>

          {agent.task && (
            <p className="text-sm text-foreground/80 line-clamp-2">
              {agent.task}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
