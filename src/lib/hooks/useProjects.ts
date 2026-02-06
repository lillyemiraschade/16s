"use client";

import { useMemo, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { createProjectsAPI } from "@/lib/projects";
import type { SavedProject, SavedProjectMeta } from "@/lib/types";

export function useProjects() {
  const { user, loading: authLoading } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "migrating" | "done">("idle");
  const [migratedCount, setMigratedCount] = useState(0);

  const api = useMemo(() => createProjectsAPI(user?.id), [user?.id]);

  // Auto-migrate local projects when user signs in
  useEffect(() => {
    if (!user?.id || authLoading || migrationStatus !== "idle") return;

    const migrate = async () => {
      setMigrationStatus("migrating");
      try {
        const count = await api.migrate();
        setMigratedCount(count);
      } catch (e) {
        console.debug("[useProjects] Migration failed:", e);
      }
      setMigrationStatus("done");
    };

    migrate();
  }, [user?.id, authLoading, api, migrationStatus]);

  const save = useCallback(
    async (project: SavedProject) => {
      await api.save(project);
    },
    [api]
  );

  const load = useCallback(
    async (id: string) => {
      return api.load(id);
    },
    [api]
  );

  const list = useCallback(async () => {
    return api.list();
  }, [api]);

  const remove = useCallback(
    async (id: string) => {
      await api.delete(id);
    },
    [api]
  );

  return {
    save,
    load,
    list,
    remove,
    isCloud: !!user?.id,
    isAuthLoading: authLoading,
    migrationStatus,
    migratedCount,
  };
}

// Convenience hook for project list with auto-refresh
export function useProjectList() {
  const { list, isCloud, isAuthLoading } = useProjects();
  const [projects, setProjects] = useState<SavedProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await list();
      setProjects(data);
    } catch (e) {
      console.debug("[useProjectList] Failed to load:", e);
    }
    setLoading(false);
  }, [list]);

  useEffect(() => {
    if (!isAuthLoading) {
      refresh();
    }
  }, [isAuthLoading, refresh]);

  return { projects, loading, refresh, isCloud };
}
