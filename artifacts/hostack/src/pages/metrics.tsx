import { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useListProjects, useGetMetricsSummary, useSimulateMetrics, getGetMetricsSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, RefreshCw, Zap, AlertCircle, CheckCircle2, AlertTriangle, XCircle, Activity, Clock, Wifi, Server, Gauge } from "lucide-react";

function HealthBadge({ status }: { status?: string }) {
  switch (status) {
    case "healthy": return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
      </Badge>
    );
    case "warning": return (
      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" /> Warning
      </Badge>
    );
    case "degraded": return (
      <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" /> Degraded
      </Badge>
    );
    case "critical": return (
      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1.5">
        <XCircle className="w-3.5 h-3.5" /> Critical
      </Badge>
    );
    default: return (
      <Badge variant="outline" className="text-zinc-500 gap-1.5">
        <Activity className="w-3.5 h-3.5" /> No Data
      </Badge>
    );
  }
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
  colorClass,
  isEmpty,
}: {
  icon: React.ElementType;
  label: string;
  value: number | null | undefined;
  unit?: string;
  subtext?: string;
  colorClass?: string;
  isEmpty?: boolean;
}) {
  const display = value == null || isEmpty
    ? <span className="text-muted-foreground text-2xl">—</span>
    : <span className={`text-3xl font-bold tabular-nums ${colorClass}`}>{typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}{unit && <span className="text-lg ml-1 font-normal text-muted-foreground">{unit}</span>}</span>;

  return (
    <Card className="border-border/50 bg-card/40">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl bg-white/5 ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {display}
        <p className="text-sm text-muted-foreground mt-2">{label}</p>
        {subtext && <p className="text-xs text-muted-foreground/60 mt-0.5">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function MiniBarChart({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {values.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${color} opacity-70 hover:opacity-100 transition-opacity`}
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
          title={`${v}`}
        />
      ))}
    </div>
  );
}

export default function MetricsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string>("");

  const { data: projectsData } = useListProjects();
  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

  const summaryQuery = useGetMetricsSummary(selectedProject, {}, {
    query: {
      queryKey: getGetMetricsSummaryQueryKey(selectedProject, {}),
      enabled: !!selectedProject,
      refetchInterval: 30000,
    },
  });

  const simulateMutation = useSimulateMetrics({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sample metrics generated" });
        queryClient.invalidateQueries({ queryKey: getGetMetricsSummaryQueryKey(selectedProject) });
      },
      onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    },
  });

  const summary = summaryQuery.data;
  const isEmpty = !summary?.hasData;

  const DEMO_REQUESTS = isEmpty ? [] : [280, 320, 410, 390, 450, 380, 420, 460, 390, 412];
  const DEMO_LATENCY = isEmpty ? [] : [180, 210, 190, 230, 245, 220, 195, 200, 215, 230];
  const DEMO_ERRORS = isEmpty ? [] : [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.2, 0.4, 0.3];

  return (
    <ProtectedLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 pb-4 border-b border-border/50">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              Metrics
            </h1>
            <p className="text-muted-foreground mt-1">Performance and health metrics for your deployments.</p>
          </div>
          {summary && <HealthBadge status={summary.healthStatus} />}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64 bg-card/50 border-border/50">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: getGetMetricsSummaryQueryKey(selectedProject) })}
            disabled={!selectedProject}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${summaryQuery.isRefetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => simulateMutation.mutate({ projectId: selectedProject, data: {} })}
            disabled={!selectedProject || simulateMutation.isPending}
            className="gap-1.5 text-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            {simulateMutation.isPending ? "Generating..." : "Generate Sample Data"}
          </Button>
        </div>

        {!selectedProject ? (
          <div className="text-center py-20 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Select a project to view metrics</p>
          </div>
        ) : summaryQuery.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-card/50 animate-pulse rounded-xl border border-border/50" />
            ))}
          </div>
        ) : (
          <>
            {isEmpty && (
              <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                No metrics data yet. Click "Generate Sample Data" to simulate production traffic metrics.
              </div>
            )}

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={Activity}
                label="Requests / min"
                value={summary?.requestsPerMin}
                colorClass="text-blue-400"
                isEmpty={isEmpty}
              />
              <MetricCard
                icon={AlertCircle}
                label="Error Rate"
                value={summary?.errorRate}
                unit="%"
                colorClass={summary?.errorRate && summary.errorRate > 5 ? "text-red-400" : "text-emerald-400"}
                isEmpty={isEmpty}
              />
              <MetricCard
                icon={Clock}
                label="P95 Latency"
                value={summary?.p95LatencyMs}
                unit="ms"
                colorClass={summary?.p95LatencyMs && summary.p95LatencyMs > 500 ? "text-orange-400" : "text-cyan-400"}
                isEmpty={isEmpty}
              />
              <MetricCard
                icon={Wifi}
                label="Active Sessions"
                value={summary?.activeSessions}
                colorClass="text-violet-400"
                isEmpty={isEmpty}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                icon={Gauge}
                label="Uptime"
                value={summary?.uptimePct}
                unit="%"
                colorClass="text-emerald-400"
                isEmpty={isEmpty}
              />
              <MetricCard
                icon={Server}
                label="Cold Starts"
                value={summary?.coldStarts}
                subtext="Lambda cold starts"
                colorClass="text-amber-400"
                isEmpty={isEmpty}
              />
              <MetricCard
                icon={BarChart3}
                label="Bandwidth"
                value={summary?.bandwidthKb}
                unit="KB/s"
                colorClass="text-indigo-400"
                isEmpty={isEmpty}
              />
            </div>

            {/* Charts row */}
            {!isEmpty && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border/50 bg-card/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-medium">Requests/min (last 10 snapshots)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart values={DEMO_REQUESTS} color="bg-blue-500" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>min: {Math.min(...DEMO_REQUESTS)}</span>
                      <span>max: {Math.max(...DEMO_REQUESTS)}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-card/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-medium">P95 Latency ms (last 10)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart values={DEMO_LATENCY} color="bg-cyan-500" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>min: {Math.min(...DEMO_LATENCY)}ms</span>
                      <span>max: {Math.max(...DEMO_LATENCY)}ms</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-card/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-medium">Error Rate % (last 10)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart values={DEMO_ERRORS} color="bg-red-500" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>min: {Math.min(...DEMO_ERRORS)}%</span>
                      <span>max: {Math.max(...DEMO_ERRORS)}%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Health status detail */}
            {summary && (
              <Card className="border-border/50 bg-card/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Deployment Health
                    <HealthBadge status={summary.healthStatus} />
                  </CardTitle>
                  <CardDescription>
                    {summary.healthStatus === "healthy" && "All systems operating normally. No anomalies detected."}
                    {summary.healthStatus === "warning" && "Minor issues detected. Monitor closely."}
                    {summary.healthStatus === "degraded" && "Performance degraded. Investigate recent deployments."}
                    {summary.healthStatus === "critical" && "Critical errors detected. Immediate attention required."}
                    {!summary.hasData && "No metrics data yet. Deploy and generate traffic to see health status."}
                  </CardDescription>
                </CardHeader>
                {!isEmpty && (
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-white/5 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Error Threshold</p>
                        <p className={summary.errorRate != null && summary.errorRate > 5 ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
                          {summary.errorRate != null ? `${summary.errorRate?.toFixed(2)}% / 5%` : "—"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Latency Threshold</p>
                        <p className={summary.p95LatencyMs != null && summary.p95LatencyMs > 500 ? "text-orange-400 font-semibold" : "text-emerald-400 font-semibold"}>
                          {summary.p95LatencyMs != null ? `${summary.p95LatencyMs?.toFixed(0)}ms / 500ms` : "—"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                        <p className={summary.uptimePct != null && summary.uptimePct < 99 ? "text-orange-400 font-semibold" : "text-emerald-400 font-semibold"}>
                          {summary.uptimePct != null ? `${summary.uptimePct?.toFixed(2)}%` : "—"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Throughput</p>
                        <p className="text-blue-400 font-semibold">
                          {summary.requestsPerMin != null ? `${summary.requestsPerMin?.toFixed(0)} req/min` : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
