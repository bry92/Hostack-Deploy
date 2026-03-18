import { useEffect, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Calendar, CheckCircle2, XCircle, Loader2, Terminal, Globe, GitCommit, ExternalLink, GitBranch, Zap, Rocket } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { format } from "date-fns";
import { useDeploymentStream, usePromoteDeploymentMutation } from "@/hooks/use-deployments-mutations";
import { formatDuration } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["queued", "preparing", "cloning", "detecting", "installing", "building", "uploading"]);
const SUCCESS_STATUSES = new Set(["ready", "deployed"]);

export default function DeploymentDetail() {
  const [, params] = useRoute("/projects/:projectId/deployments/:id");
  const projectId = params?.projectId || "";
  const deploymentId = params?.id || "";

  const [, navigate] = useLocation();
  const { deployment, logs, isLoadingDeployment, isActive } = useDeploymentStream(deploymentId);
  const { promoteDeployment, isPromoting } = usePromoteDeploymentMutation();
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isActive]);

  if (isLoadingDeployment) {
    return <ProtectedLayout><div className="animate-pulse h-64 bg-card rounded-xl" /></ProtectedLayout>;
  }

  if (!deployment) {
    return <ProtectedLayout><div className="text-muted-foreground p-8">Deployment not found</div></ProtectedLayout>;
  }

  const isSuccess = SUCCESS_STATUSES.has(deployment.status);
  const isFailed = deployment.status === "failed";
  const isRunning = ACTIVE_STATUSES.has(deployment.status);

  const failureReason = isFailed
    ? logs
        .filter((l) => l.logLevel === "error")
        .map((l) => l.message.trim())
        .filter((m) => m && !m.startsWith("══") && !m.startsWith("❌"))
        .pop() || null
    : null;

  return (
    <ProtectedLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <Link href={`/projects/${projectId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Project
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Deployment <span className="text-muted-foreground font-normal text-lg">#{deployment.id.slice(0, 8)}</span>
            </h1>
            <div className="flex items-center gap-3">
              {isRunning && (
                <span className="text-xs text-blue-400 flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Live
                </span>
              )}
              <EnvironmentBadge environment={deployment.environment} />
              <StatusBadge status={deployment.status} />
              {deployment.environment === "preview" && deployment.status === "ready" && (
                <Button
                  size="sm"
                  onClick={async () => {
                    const promoted = await promoteDeployment(deploymentId);
                    if (promoted) {
                      navigate(`/projects/${promoted.projectId}/deployments/${promoted.id}`);
                    }
                  }}
                  disabled={isPromoting}
                  className="gap-1.5"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  {isPromoting ? "Promoting..." : "Promote to Production"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Preview URL banner */}
        {isSuccess && deployment.deploymentUrl && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Preview URL</p>
                  <p className="font-mono text-sm text-emerald-400 truncate">{deployment.deploymentUrl}</p>
                </div>
              </div>
              <a href={deployment.deploymentUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Visit
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex flex-col justify-center gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</span>
              <span className="font-medium text-sm">{format(new Date(deployment.createdAt), "MMM d, yyyy h:mm a")}</span>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex flex-col justify-center gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Terminal className="w-3 h-3" /> Environment</span>
              <span className="font-medium text-sm capitalize">{deployment.environment}</span>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex flex-col justify-center gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</span>
              <span className="font-medium text-sm">{formatDuration(deployment.durationSeconds) || (isRunning ? "Timing..." : "—")}</span>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex flex-col justify-center gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Trigger</span>
              <span className="font-medium text-sm capitalize">{(deployment as any).triggerType || "manual"}</span>
            </CardContent>
          </Card>
        </div>

        {/* Commit Info */}
        {(deployment.commitHash || deployment.commitMessage) && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <GitCommit className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                {deployment.commitHash && (
                  <p className="font-mono text-xs text-muted-foreground mb-0.5">
                    {deployment.commitHash.slice(0, 8)}
                    {deployment.branch && (
                      <span className="ml-2 text-zinc-500 font-sans flex-inline items-center gap-1">
                        <GitBranch className="w-3 h-3 inline mr-0.5" />{deployment.branch}
                      </span>
                    )}
                  </p>
                )}
                {deployment.commitMessage && (
                  <p className="text-sm font-medium truncate">{deployment.commitMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logs */}
        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Build Logs
              {isRunning && (
                <span className="text-xs font-normal text-blue-400 flex items-center gap-1 ml-auto">
                  <Loader2 className="w-3 h-3 animate-spin" /> Streaming live
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-zinc-950 rounded-b-xl font-mono text-xs leading-relaxed p-4 max-h-[600px] overflow-y-auto border-t border-border/50">
              {logs.length === 0 ? (
                <div className="text-zinc-600 py-4 text-center">
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2 text-blue-400 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" /> Waiting for build output...
                    </span>
                  ) : "No logs available"}
                </div>
              ) : (
                logs.map((log) => {
                  let colorClass = "text-zinc-300";
                  if (log.logLevel === "error") colorClass = "text-red-400";
                  if (log.logLevel === "warn") colorClass = "text-yellow-400";
                  if (log.logLevel === "success") colorClass = "text-emerald-400";
                  if (log.logLevel === "info") colorClass = "text-zinc-400";

                  return (
                    <div key={log.id} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded transition-colors">
                      <span className="text-zinc-700 select-none flex-shrink-0 w-20 text-xs mt-0.5">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </span>
                      <span className={`${colorClass} whitespace-pre-wrap break-all`}>{log.message}</span>
                    </div>
                  );
                })
              )}
              {isRunning && logs.length > 0 && (
                <div className="flex gap-4 px-2 py-0.5 mt-1">
                  <span className="text-zinc-700 select-none flex-shrink-0 w-20 text-xs">...</span>
                  <span className="text-blue-400 animate-pulse flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Running...
                  </span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Result banner */}
        {isSuccess && (
          <div className="flex items-center gap-3 text-emerald-500 text-sm font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-5 h-5" /> Deployment completed successfully
            {deployment.durationSeconds && <span className="text-muted-foreground font-normal ml-auto">in {formatDuration(deployment.durationSeconds)}</span>}
          </div>
        )}
        {isFailed && (
          <div className="flex flex-col gap-2 text-red-500 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>Deployment failed</span>
              {deployment.durationSeconds && <span className="text-muted-foreground font-normal ml-auto">after {formatDuration(deployment.durationSeconds)}</span>}
            </div>
            {failureReason && (
              <p className="text-red-400/80 text-xs font-normal pl-8">Deployment failed: {failureReason.replace(/^\s+/, "")}</p>
            )}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
