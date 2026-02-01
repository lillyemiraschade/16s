"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Plus, Folder, Users, Code } from "lucide-react";
import { formatDate } from "@/lib/utils";

const mockProjects = [
  {
    id: "1",
    name: "E-commerce Platform",
    description: "Full-stack marketplace with payment integration",
    createdAt: new Date("2026-01-15"),
    agentCount: 5,
  },
  {
    id: "2",
    name: "Task Management App",
    description: "Collaborative project management tool",
    createdAt: new Date("2026-01-20"),
    agentCount: 4,
  },
];

const mockStats = {
  totalProjects: 2,
  activeAgents: 9,
  linesGenerated: 12453,
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
            <p className="text-muted-foreground">
              Here's what's happening with your AI development team
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-card border border-border rounded-lg p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 text-purple-500 rounded-lg">
                  <Folder className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Projects
                  </p>
                  <p className="text-2xl font-bold">
                    {mockStats.totalProjects}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-card border border-border rounded-lg p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Agents</p>
                  <p className="text-2xl font-bold">{mockStats.activeAgents}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-card border border-border rounded-lg p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 text-green-500 rounded-lg">
                  <Code className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Lines Generated
                  </p>
                  <p className="text-2xl font-bold">
                    {mockStats.linesGenerated.toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4">Your Projects</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Link
                href="/onboard"
                className="block h-full bg-card border-2 border-dashed border-border rounded-lg p-8 hover:border-primary hover:bg-accent transition-all group"
              >
                <div className="flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                  <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">New Project</h3>
                  <p className="text-sm text-muted-foreground">
                    Start building with your AI team
                  </p>
                </div>
              </Link>
            </motion.div>

            {mockProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              >
                <Link
                  href={`/project/${project.id}`}
                  className="block h-full bg-card border border-border rounded-lg p-6 hover:shadow-lg hover:border-primary/50 transition-all group"
                >
                  <div className="flex flex-col h-full min-h-[200px]">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <Folder className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(project.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                      {project.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{project.agentCount} agents</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
