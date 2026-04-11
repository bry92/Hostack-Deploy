import { useState, useCallback, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  runDeploymentPipeline,
  formatDuration,
  type PipelineLog,
  type StageState,
  type PipelineResult,
  type PipelineContext,
} from "@/lib/pipeline";
import { PipelineTerminal } from "./pipeline-terminal";
import { PipelineProgress } from "./pipeline-progress";
import { PipelineStageIndicator } from "./pipeline-stage-indicator";
import { DeploymentResultBlock } from "./deployment-result-block";
import { Button } from "@/components/ui/button";

interface DeploymentPipelineProps {
  /**
   * Project identifier
   */
  projectName: string;

  /**
   * Repository URL
   */
  repositoryUrl: string;

  /**
   * Git branch name
   */
  branch: string;

  /**
   * Git commit SHA
   */
  commitSha: string;

  /**
   * Detected framework (optional)
   */
  framework?: string;

  /**
   * Called when deployment starts
   */
  onStarted?: () => void;

  /**
   * Called when deployment completes
   */
  onCompleted?: (result: PipelineResult) => void;
}

/**
 * Main Deployment Pipeline Component
 * 
 * Orchestrates the entire deployment visualization experience:
 * - Runs pipeline in real-time
 * - Updates logs, progress, and stage indicators
 * - Displays results when complete
 * 
 * This is the primary component users interact with to watch their deployment
 */
export function DeploymentPipeline({
  projectName,
  repositoryUrl,
  branch,
  commitSha,
  framework,
  onStarted,
  onCompleted,
}: DeploymentPipelineProps) {
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [stages, setStages] = useState<Record<string, StageState>>({
    prepare: { stage: "prepare", status: "pending", progress: 0 },
    install: { stage: "install", status: "pending", progress: 0 },
    build: { stage: "build", status: "pending", progress: 0 },
    package: { stage: "package", status: "pending", progress: 0 },
    deploy: { stage: "deploy", status: "pending", progress: 0 },
    verify: { stage: "verify", status: "pending", progress: 0 },
  });
  const [status, setStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Calculate overall progress
  const calculateProgress = useCallback((stageMap: Record<string, StageState>) => {
    const targetProgress = Math.max(
      ...Object.values(stageMap).map((s) => {
        if (s.status === "success") return 100;
        if (s.status === "running") return Math.min(90, s.progress || 0);
        if (s.status === "pending") return 0;
        if (s.status === "error") return Math.max(s.progress || 0, 10);
        return 0;
      })
    );
    return targetProgress;
  }, []);

  // Log emitter callback
  const handleLogEmit = useCallback((log: PipelineLog) => {
    setLogs((prev) => [...prev, log]);
  }, []);

  // Stage change callback
  const handleStageChange = useCallback((stage: StageState) => {
    setStages((prev) => {
      const updated = { ...prev, [stage.stage]: stage };
      setProgress(calculateProgress(updated));
      return updated;
    });
  }, [calculateProgress]);

  // Start deployment
  const startDeployment = useCallback(async () => {
    setLogs([]);
    setStatus("running");
    setProgress(0);
    setResult(null);
    onStarted?.();

    const context: PipelineContext = {
      projectName,
      repositoryUrl,
      branch,
      commitSha,
      framework,
      onLogEmit: handleLogEmit,
      onStageChange: handleStageChange,
    };

    try {
      const deploymentResult = await runDeploymentPipeline(context);

      if (deploymentResult.status === "success") {
        setStatus("success");
        setProgress(100);
      } else {
        setStatus("failed");
      }

      setResult(deploymentResult);
      onCompleted?.(deploymentResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setStatus("failed");
      setResult({
        status: "failed",
        totalDurationMs: 0,
        buildTime: 0,
        failureReason: errorMessage,
        logs,
      });
    }
  }, [projectName, repositoryUrl, branch, commitSha, framework, handleLogEmit, handleStageChange, logs, onStarted, onCompleted]);

  // Auto-start if component mounts and status is idle
  useEffect(() => {
    if (status === "idle" && !isRetrying) {
      startDeployment();
    }
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    await startDeployment();
    setIsRetrying(false);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Pipeline Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Deployment Pipeline</h2>
            <p className="text-sm text-zinc-400 mt-1">
              {projectName} • {branch} • {commitSha.slice(0, 7)}
            </p>
          </div>
          {status === "running" && (
            <div className="text-right">
              <div className="text-xs text-emerald-400 font-mono animate-pulse">
                ● Live Deployment
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <Card className="p-6 border-zinc-800 bg-zinc-900/50">
        <PipelineProgress progress={progress} status={status} />
      </Card>

      {/* Stage Indicator */}
      <Card className="p-6 border-zinc-800 bg-zinc-900/50">
        <PipelineStageIndicator stages={stages} />
      </Card>

      {/* Terminal UI */}
      <Card className="p-0 border-zinc-800 overflow-hidden">
        <PipelineTerminal logs={logs} isRunning={status === "running"} />
      </Card>

      {/* Result Block */}
      {result && (
        <Card className="p-6 border-zinc-800">
          <DeploymentResultBlock result={result} />
        </Card>
      )}

      {/* Error State */}
      {status === "failed" && !result && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-400">Deployment Error</h3>
            <p className="text-sm text-red-300 mt-1">
              An unexpected error occurred during deployment.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      {status !== "running" && (
        <div className="flex gap-3">
          <Button onClick={handleRetry} disabled={status === "running"}>
            {status === "failed" ? "Retry Deployment" : "Start Deployment"}
          </Button>
          {result?.status === "success" && result.deploymentUrl && (
            <Button
              variant="outline"
              asChild
            >
              <a href={result.deploymentUrl} target="_blank" rel="noopener noreferrer">
                Visit Live App
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
