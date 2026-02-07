"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Monitor, Trash2, Pencil, Copy, Globe } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useProjects } from "@/lib/hooks/useProjects";
import { UserMenu } from "@/components/auth/UserMenu";
import { AuthModal } from "@/components/auth/AuthModal";
import type { SavedProjectMeta } from "@/lib/types";

type SortOption = "recent" | "name" | "oldest";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isConfigured } = useAuth();
  const { list: listProjects, load: loadProject, save: saveProject, remove: deleteProject, isAuthLoading, migrationStatus } = useProjects();

  const [projects, setProjects] = useState<SavedProjectMeta[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [projectDomains, setProjectDomains] = useState<Record<string, string>>({}); // projectId → domain

  // Load projects (wait for migration to complete if signed in)
  useEffect(() => {
    if (isAuthLoading) return;
    // Wait for migration to complete before loading cloud projects
    if (migrationStatus === "migrating") return;

    const loadProjects = async () => {
      const list = await listProjects();
      setProjects(list);
      // Fetch domains for all projects
      if (user) {
        for (const p of list.slice(0, 20)) {
          fetch(`/api/domains?projectId=${encodeURIComponent(p.id)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              const activeDomain = data?.domains?.find((d: { status: string }) => d.status === "active");
              if (activeDomain) {
                setProjectDomains(prev => ({ ...prev, [p.id]: activeDomain.domain }));
              }
            })
            .catch(() => {});
        }
      }
    };
    loadProjects();
  }, [isAuthLoading, listProjects, migrationStatus, user]);

  // Filter and sort projects
  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "recent") return b.updatedAt - a.updatedAt;
      if (sort === "oldest") return a.updatedAt - b.updatedAt;
      return a.name.localeCompare(b.name);
    });

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setDeleteConfirm(null);
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = await loadProject(id);
    if (!project) return;
    const newId = crypto.randomUUID();
    const duplicated = {
      ...project,
      id: newId,
      name: `${project.name} (Copy)`,
      updatedAt: Date.now(),
    };
    await saveProject(duplicated);
    setProjects((prev) => [{ id: newId, name: duplicated.name, updatedAt: duplicated.updatedAt }, ...prev]);
  };

  const handleOpenProject = (id: string) => {
    // Navigate to main page and load project (using URL param)
    router.push(`/?project=${id}`);
  };

  const formatRelativeTime = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    const date = new Date(ts);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (authLoading || isAuthLoading || migrationStatus === "migrating") {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Header */}
      <header className="h-14 md:h-[60px] border-b border-white/[0.04] px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="16s" width={28} height={28} className="object-contain" />
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
            >
              Home
            </Link>
            <Link
              href="/projects"
              className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-100 bg-white/[0.06] rounded-lg"
            >
              <span className="sm:hidden">Projects</span>
              <span className="hidden sm:inline">My Projects</span>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {!user && isConfigured && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Sign in
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-100">My Projects</h1>
          <Link
            href="/"
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-green-500/80 hover:bg-green-500 text-white text-[12px] md:text-[13px] font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>

        {/* Search and sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[13px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[13px] text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
          >
            <option value="recent">Last Modified</option>
            <option value="name">Name</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Projects grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 md:py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Monitor className="w-9 h-9 text-zinc-600" />
            </div>
            <p className="text-zinc-300 text-[16px] md:text-[18px] font-medium mb-2">
              {search ? "No matches found" : "Start building something"}
            </p>
            <p className="text-zinc-600 text-[13px] md:text-[14px] mb-8 max-w-sm mx-auto">
              {search ? "Try a different search term" : "Describe a website and we\u2019ll bring it to life in seconds. Your projects will show up here."}
            </p>
            {!search && (
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500/80 hover:bg-green-500 text-white text-[14px] font-medium rounded-lg transition-colors glow-green"
              >
                <Plus className="w-4 h-4" />
                Create Your First Site
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-200 cursor-pointer"
                  onClick={() => handleOpenProject(project.id)}
                >
                  {/* Preview placeholder */}
                  <div className="aspect-[16/10] bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 flex items-center justify-center">
                    <div className="text-center">
                      <Monitor className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                      <p className="text-zinc-500 text-[11px]">Preview after next edit</p>
                    </div>
                  </div>

                  {/* Project info */}
                  <div className="p-4">
                    <h3 className="text-[14px] font-medium text-zinc-200 truncate mb-1">
                      {project.name}
                    </h3>
                    <p className="text-[12px] text-zinc-500">
                      {formatRelativeTime(project.updatedAt)}
                    </p>
                    {projectDomains[project.id] && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Globe className="w-3 h-3 text-green-500" />
                        <span className="text-[11px] text-green-400 truncate">{projectDomains[project.id]}</span>
                      </div>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenProject(project.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500/90 hover:bg-green-500 text-white text-[12px] font-medium rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => handleDuplicate(project.id, e)}
                      className="p-2 bg-zinc-700/90 hover:bg-zinc-600 text-zinc-300 hover:text-white rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {deleteConfirm === project.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="px-3 py-2 bg-red-500/90 hover:bg-red-500 text-white text-[12px] font-medium rounded-lg transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-2 bg-zinc-600/90 hover:bg-zinc-600 text-white text-[12px] font-medium rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(project.id)}
                        className="p-2 bg-zinc-700/90 hover:bg-red-500/90 text-zinc-300 hover:text-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
