import { useEffect, useRef } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommit,
  Globe,
  Loader2,
  Rocket,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { AppPage, AppPageHeader, AppPageSection } from "@/components/layout/app-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDeploymentStream, usePromoteDeploymentMutation } from "@/hooks/use-deployments-mutations";
import { formatDuration } from "@/lib/utils";

const ACTIVE_STATUSES = new Set([
  "queued",
  "preparing",
  "cloning",
  "detecting",
  "installing",
  "building",
  "packaging",
  "deploying",
  "verifying",
  "uploading",
]);
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
    return (
      <ProtectedLayout>
        <div className="h-64 animate-pulse rounded-xl bg-card" />
      </ProtectedLayout>
    );
  }

  if (!deployment) {
    return (
      <ProtectedLayout>
        <div className="p-8 text-muted-foreground">Deployment not found</div>
      </ProtectedLayout>
    );
  }

  const isSuccess = SUCCESS_STATUSES.has(deployment.status);
  const isFailed = deployment.status === "failed";
  const isRunning = ACTIVE_STATUSES.has(deployment.status);
  const explicitFailureReason =
    "failureReason" in deployment && typeof deployment.failureReason === "string"
      ? deployment.failureReason
      : null;
  const failureReason = isFailed
    ? explicitFailureReason ??
      logs
        .filter((log) => log.logLevel === "error")
        .map((log) => log.message.trim())
        .findLast((message) => message.length > 0) ??
      null
    : null;

  return (
    <ProtectedLayout>
      <AppPage>
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Project
        </Link>

        <AppPageHeader
          eyebrow="Deployments"
          icon={<Rocket className="h-5 w-5" />}
          title={
            <span className="flex items-center gap-3">
              <span>Deployment</span>
              <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">#{deployment.id.slice(0, 8)}</span>
            </span>
          }
          description="Inspect build progress, artifact status, runtime readiness, and the exact logs that led to this deployment outcome."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {isRunning ? (
                <span className="flex items-center gap-1 text-xs text-blue-400 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Live
                </span>
              ) : null}
              <EnvironmentBadge environment={deployment.environment} />
              <StatusBadge status={deployment.status} />
              {deployment.environment === "preview" && deployment.status === "ready" ? (
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
                  <Rocket className="h-3.5 w-3.5" />
                  {isPromoting ? "Promoting..." : "Promote to Production"}
                </Button>
              ) : null}
            </div>
          }
        />

        {isSuccess && deployment.deploymentUrl && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Globe className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                <div className="min-w-0">
                  <p className="mb-0.5 text-xs text-muted-foreground">Preview URL</p>
                  <p className="truncate font-mono text-sm text-emerald-400">{deployment.deploymentUrl}</p>
                </div>
              </div>
              <a href={deployment.deploymentUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Visit
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <AppPageSection className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col justify-center gap-1 p-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Date
              </span>
              <span className="text-sm font-medium">
                {format(new Date(deployment.createdAt), "MMM d, yyyy h:mm a")}
              </span>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col justify-center gap-1 p-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Terminal className="h-3 w-3" />
                Environment
              </span>
              <span className="text-sm font-medium capitalize">{deployment.environment}</span>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col justify-center gap-1 p-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Duration
              </span>
              <span className="text-sm font-medium">
                {formatDuration(deployment.durationSeconds) || (isRunning ? "Timing..." : "-")}
              </span>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col justify-center gap-1 p-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="h-3 w-3" />
                Trigger
              </span>
              <span className="text-sm font-medium capitalize">{deployment.triggerType || "manual"}</span>
            </CardContent>
          </Card>
        </AppPageSection>

        {(deployment.commitHash || deployment.commitMessage) && (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex items-center gap-4 p-4">
              <GitCommit className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                {deployment.commitHash && (
                  <p className="mb-0.5 font-mono text-xs text-muted-foreground">
                    {deployment.commitHash.slice(0, 8)}
                    {deployment.branch && (
                      <span className="ml-2 items-center gap-1 font-sans text-zinc-500">
                        <GitBranch className="mr-0.5 inline h-3 w-3" />
                        {deployment.branch}
                      </span>
                    )}
                  </p>
                )}
                {deployment.commitMessage && (
                  <p className="truncate text-sm font-medium">{deployment.commitMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" />
              Build Logs
              {isRunning && (
                <span className="ml-auto flex items-center gap-1 text-xs font-normal text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Streaming live
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto rounded-b-xl border-t border-border/50 bg-zinc-950 p-4 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <div className="py-4 text-center text-zinc-600">
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2 text-blue-400 animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for build output...
                    </span>
                  ) : (
                    "No logs available"
                  )}
                </div>
              ) : (
                logs.map((log) => {
                  let colorClass = "text-zinc-300";
                  if (log.logLevel === "error") colorClass = "text-red-400";
                  if (log.logLevel === "warn") colorClass = "text-yellow-400";
                  if (log.logLevel === "success") colorClass = "text-emerald-400";
                  if (log.logLevel === "info") colorClass = "text-zinc-400";

                  return (
                    <div
                      key={log.id}
                      className="flex gap-4 rounded px-2 py-0.5 transition-colors hover:bg-white/5"
                    >
                      <span className="mt-0.5 w-20 flex-shrink-0 select-none text-xs text-zinc-700">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </span>
                      <span className={`${colorClass} whitespace-pre-wrap break-all`}>{log.message}</span>
                    </div>
                  );
                })
              )}
              {isRunning && logs.length > 0 && (
                <div className="mt-1 flex gap-4 px-2 py-0.5">
                  <span className="w-20 flex-shrink-0 select-none text-xs text-zinc-700">...</span>
                  <span className="flex items-center gap-2 text-blue-400 animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running...
                  </span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>

        {isSuccess && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
            Deployment completed successfully
            {deployment.durationSeconds && (
              <span className="ml-auto font-normal text-muted-foreground">
                in {formatDuration(deployment.durationSeconds)}
              </span>
            )}
          </div>
        )}
        {isFailed && (
          <div className="flex flex-col gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 flex-shrink-0" />
              <span>Deployment failed</span>
              {deployment.durationSeconds && (
                <span className="ml-auto font-normal text-muted-foreground">
                  after {formatDuration(deployment.durationSeconds)}
                </span>
              )}
            </div>
            {failureReason && (
              <p className="pl-8 text-xs font-normal text-red-400/80">
                Deployment failed: {failureReason.replace(/^\s+/, "")}
              </p>
            )}
          </div>
        )}
      </AppPage>
    </ProtectedLayout>
  );
}
