import { ProtectedLayout } from "@/components/layout/protected-layout";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";
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
      <AppPage>
        <AppPageHeader
          eyebrow="Core"
          icon={<Activity className="h-5 w-5" />}
          title="Deployments"
          description="Track every queued, running, failed, and ready deployment across all projects from a single operational timeline."
        />

        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
        ) : deployments.length === 0 ? (
           <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 px-4 py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">No deployments found</h3>
            <p className="max-w-md text-center text-zinc-400">
              Deployments will appear here once you create a project and trigger a build.
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-xl">
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-800 bg-zinc-950 p-4 text-sm font-medium text-zinc-400">
                  <div className="col-span-3">Project</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Environment</div>
                  <div className="col-span-3">Started</div>
                  <div className="col-span-1">Duration</div>
                  <div className="col-span-1 text-right">View</div>
                </div>
                <div className="divide-y divide-zinc-800">
                  {deployments.map(dep => (
                    <div key={dep.id} className="group grid grid-cols-12 items-center gap-4 p-4 text-sm transition-colors hover:bg-zinc-800">
                      <div className="col-span-3 flex items-center gap-2 font-medium text-white">
                        <Box className="h-4 w-4 text-zinc-400" />
                        <Link href={`/projects/${dep.projectId}`} className="transition-colors hover:text-violet-400">
                          {dep.projectName || 'Project'}
                        </Link>
                      </div>
                      <div className="col-span-2"><StatusBadge status={dep.status} /></div>
                      <div className="col-span-2"><EnvironmentBadge environment={dep.environment} /></div>
                      <div className="col-span-3 text-zinc-400">
                        {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                      </div>
                      <div className="col-span-1 text-zinc-400">{formatDuration(dep.durationSeconds)}</div>
                      <div className="col-span-1 text-right">
                        <Link href={`/projects/${dep.projectId}/deployments/${dep.id}`}>
                          <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-violet-400">
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
      </AppPage>
    </ProtectedLayout>
  );
}
