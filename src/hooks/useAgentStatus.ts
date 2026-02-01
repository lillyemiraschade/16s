import { useMemo } from "react";

type AgentStatus = "idle" | "thinking" | "working" | "done";

interface AgentStatusData {
  id: string;
  status: AgentStatus;
  currentTask?: string;
}

interface UseAgentStatusOptions {
  projectId: string;
}

interface UseAgentStatusReturn {
  agents: AgentStatusData[];
}

export function useAgentStatus({ projectId }: UseAgentStatusOptions): UseAgentStatusReturn {
  const agents = useMemo<AgentStatusData[]>(() => {
    return [
      {
        id: "product-owner",
        status: "working",
        currentTask: "Analyzing project requirements and defining user stories",
      },
      {
        id: "ux-designer",
        status: "idle",
      },
      {
        id: "backend-dev",
        status: "idle",
      },
      {
        id: "frontend-dev",
        status: "idle",
      },
      {
        id: "qa-engineer",
        status: "idle",
      },
    ];
  }, [projectId]);

  return { agents };
}
