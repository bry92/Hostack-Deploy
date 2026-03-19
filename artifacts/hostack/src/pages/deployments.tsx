import { ProtectedLayout } from "@/components/layout/protected-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { useListAllDeployments } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { formatDistanceToNow } from "date-fns";
import { formatDuration } from "@/lib/utils";
import { Box, ExternalLink, Activity } from "lucide-react";

export default function Deployments() {
  const { data, isLoading } = useListAllDeployments();
  const deployments = data?.deployments || [];

  return (
    <ProtectedLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Deployments</h1>
          <p className="text-muted-foreground mt-1">Cross-project deployment history and statuses.</p>
        </div>

        {isLoading ? (
          <div className="h-64 bg-card/50 animate-pulse rounded-xl border border-border/50" />
        ) : deployments.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border/50 rounded-2xl bg-card/10">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No deployments found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Deployments will appear here once you create a project and trigger a build.
            </p>
          </div>
        ) : (
          <Card className="border-border/50 bg-card/30">
            <CardContent className="p-0">
              <div className="rounded-md overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground bg-white/[0.02] border-b border-border/50">
                  <div className="col-span-3">Project</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Environment</div>
                  <div className="col-span-3">Started</div>
                  <div className="col-span-1">Duration</div>
                  <div className="col-span-1 text-right">View</div>
                </div>
                <div className="divide-y divide-border/50">
                  {deployments.map(dep => (
                    <div key={dep.id} className="grid grid-cols-12 gap-4 p-4 items-center text-sm hover:bg-white/[0.02] transition-colors group">
                      <div className="col-span-3 font-medium flex items-center gap-2">
                        <Box className="w-4 h-4 text-muted-foreground" />
                        <Link href={`/projects/${dep.projectId}`} className="hover:text-primary transition-colors">
                          {dep.projectName || 'Project'}
                        </Link>
                      </div>
                      <div className="col-span-2"><StatusBadge status={dep.status} /></div>
                      <div className="col-span-2"><EnvironmentBadge environment={dep.environment} /></div>
                      <div className="col-span-3 text-muted-foreground">
                        {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                      </div>
                      <div className="col-span-1 text-muted-foreground">{formatDuration(dep.durationSeconds)}</div>
                      <div className="col-span-1 text-right">
                        <Link href={`/projects/${dep.projectId}/deployments/${dep.id}`}>
                          <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedLayout>
  );
}
