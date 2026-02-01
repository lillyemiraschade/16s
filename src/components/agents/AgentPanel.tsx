"use client";

import { Users } from "lucide-react";
import { agents } from "@/lib/ai/agents";
import { AgentCard } from "./AgentCard";

export function AgentPanel() {
  const agentsList = Object.values(agents);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Users className="w-5 h-5 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">AI Team</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {agentsList.map((agent, index) => (
          <AgentCard
            key={agent.id}
            agent={{
              ...agent,
              status: index === 0 ? "working" : "idle",
              task: index === 0 ? "Analyzing project requirements..." : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
