import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useTriggerDeployment,
  usePromoteDeployment,
  getListProjectDeploymentsQueryKey,
  getListAllDeploymentsQueryKey,
  getGetProjectQueryKey,
  useGetDeployment,
  useGetDeploymentLogs,
  getGetDeploymentQueryKey,
  getGetDeploymentLogsQueryKey,
  type DeploymentLog,
  type Deployment,
} from "@workspace/api-client-react";

const TERMINAL_STATUSES = new Set(["ready", "deployed", "failed"]);
const ACTIVE_STATUSES = new Set(["queued", "preparing", "cloning", "detecting", "installing", "building", "uploading"]);

export function useDeploymentsMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const triggerMutation = useTriggerDeployment({
    mutation: {
      onSuccess: (data, variables) => {
        toast({ title: "Deployment triggered successfully" });
        queryClient.invalidateQueries({ queryKey: getListProjectDeploymentsQueryKey(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: getListAllDeploymentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(variables.projectId) });
      },
      onError: (err) => {
        toast({ title: "Failed to trigger deployment", description: err.message, variant: "destructive" });
      },
    },
  });

  return {
    triggerDeployment: triggerMutation.mutateAsync,
    isTriggering: triggerMutation.isPending,
  };
}

export function usePromoteDeploymentMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const promoteMutation = usePromoteDeployment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Deployment promoted to production" });
        queryClient.invalidateQueries({ queryKey: getListAllDeploymentsQueryKey() });
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            typeof q.queryKey[0] === "string" &&
            (q.queryKey[0] as string).includes("/deployments"),
        });
      },
      onError: (err) => {
        toast({ title: "Failed to promote deployment", description: err.message, variant: "destructive" });
      },
    },
  });

  const promoteDeployment = async (deploymentId: string): Promise<Deployment | null> => {
    try {
      const result = await promoteMutation.mutateAsync({ deploymentId });
      return result as Deployment;
    } catch {
      return null;
    }
  };

  return {
    promoteDeployment,
    isPromoting: promoteMutation.isPending,
  };
}

export function useDeploymentStream(deploymentId: string) {
  const queryClient = useQueryClient();
  const [streamLogs, setStreamLogs] = useState<DeploymentLog[]>([]);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const startedRef = useRef(false);

  const deploymentQuery = useGetDeployment(deploymentId, {
    query: {
      queryKey: getGetDeploymentQueryKey(deploymentId),
      enabled: !!deploymentId,
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s && ACTIVE_STATUSES.has(s) ? 3000 : false;
      },
    },
  });

  const logsQuery = useGetDeploymentLogs(deploymentId, {
    query: {
      queryKey: getGetDeploymentLogsQueryKey(deploymentId),
      enabled: !!deploymentId,
    },
  });

  const deployment = deploymentQuery.data;

  const startStream = useCallback(() => {
    if (!deploymentId || esRef.current || startedRef.current) return;
    startedRef.current = true;
    setIsStreaming(true);

    const es = new EventSource(`/api/deployments/${deploymentId}/stream`, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as {
          type: string;
          data?: DeploymentLog;
          status?: string;
        };

        if (msg.type === "log" && msg.data) {
          setStreamLogs((prev) => [...prev, msg.data!]);
        } else if (msg.type === "status" && msg.status) {
          setStreamStatus(msg.status);
          queryClient.invalidateQueries({ queryKey: getGetDeploymentQueryKey(deploymentId) });
        } else if (msg.type === "done") {
          setIsDone(true);
          setIsStreaming(false);
          es.close();
          esRef.current = null;
          queryClient.invalidateQueries({ queryKey: getGetDeploymentQueryKey(deploymentId) });
          queryClient.invalidateQueries({ queryKey: getListAllDeploymentsQueryKey() });
          queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).includes("/deployments") });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
      esRef.current = null;
    };
  }, [deploymentId, queryClient]);

  useEffect(() => {
    if (!deploymentId || !deployment) return;

    const s = deployment.status;

    if (TERMINAL_STATUSES.has(s)) {
      setIsDone(true);
      return;
    }

    if (ACTIVE_STATUSES.has(s)) {
      startStream();
    }
  }, [deploymentId, deployment?.status, startStream]);

  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  const resolvedLogs = streamLogs.length > 0 ? streamLogs : (logsQuery.data?.logs ?? []);
  const resolvedStatus = streamStatus || deployment?.status || null;
  const isActive = resolvedStatus ? ACTIVE_STATUSES.has(resolvedStatus) : false;

  return {
    deployment,
    logs: resolvedLogs,
    status: resolvedStatus,
    isLoadingDeployment: deploymentQuery.isLoading,
    isStreaming,
    isActive,
    isDone,
  };
}

export function useDeploymentPolling(deploymentId: string) {
  const deploymentQuery = useGetDeployment(deploymentId, {
    query: {
      queryKey: getGetDeploymentQueryKey(deploymentId),
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s && ACTIVE_STATUSES.has(s) ? 2000 : false;
      },
    },
  });

  const isPolling = deploymentQuery.data?.status
    ? ACTIVE_STATUSES.has(deploymentQuery.data.status)
    : false;

  const logsQuery = useGetDeploymentLogs(deploymentId, {
    query: {
      queryKey: getGetDeploymentLogsQueryKey(deploymentId),
      refetchInterval: isPolling ? 1500 : false,
    },
  });

  return {
    deployment: deploymentQuery.data,
    isLoadingDeployment: deploymentQuery.isLoading,
    logs: logsQuery.data?.logs || [],
    isLoadingLogs: logsQuery.isLoading,
    isPolling,
  };
}
