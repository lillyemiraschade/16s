"use client";

import { useState, useCallback } from "react";

interface Deployment {
  id: string;
  url: string;
  status: string;
  created_at: string;
  custom_domain: string | null;
}

interface DeployResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  error?: string;
}

export function useDeployment() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [lastDeployment, setLastDeployment] = useState<DeployResult | null>(null);

  const deploy = useCallback(async (html: string, projectId: string, projectName: string): Promise<DeployResult> => {
    setIsDeploying(true);
    setLastDeployment(null);

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, projectId, projectName }),
      });

      const data = await response.json();

      if (!response.ok) {
        const result = { success: false, error: data.error || "Deployment failed" };
        setLastDeployment(result);
        return result;
      }

      const result = {
        success: true,
        deploymentId: data.deploymentId,
        url: data.url,
      };
      setLastDeployment(result);
      return result;
    } catch (error) {
      const result = { success: false, error: "Network error" };
      setLastDeployment(result);
      return result;
    } finally {
      setIsDeploying(false);
    }
  }, []);

  const fetchDeployments = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/deploy?projectId=${projectId}`);
      const data = await response.json();

      if (response.ok && data.deployments) {
        setDeployments(data.deployments);
      }
    } catch (error) {
      console.error("Failed to fetch deployments:", error);
    }
  }, []);

  return {
    deploy,
    isDeploying,
    lastDeployment,
    deployments,
    fetchDeployments,
  };
}
