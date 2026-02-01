"use client";

import { useParams } from "next/navigation";
import { AgentPanel } from "@/components/agents/AgentPanel";
import { ChatInterface } from "@/components/chat/ChatInterface";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-border bg-card flex-shrink-0">
          <AgentPanel />
        </aside>
        <main className="flex-1 flex flex-col">
          <ChatInterface projectId={projectId} />
        </main>
      </div>
    </div>
  );
}
