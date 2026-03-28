import { ProtectedLayout } from "@/components/layout/protected-layout";
import { AppPage, AppPageHeader, AppPageSection } from "@/components/layout/app-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderGit2, Activity, Rocket, ArrowRight, Plus } from "lucide-react";
import { useGetDashboardStats, useListProjects } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link, useLocation } from "wouter";
import { FrameworkIcon } from "@/components/ui/framework-icon";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: projectsData, isLoading: projectsLoading } = useListProjects();
  const [, setLocation] = useLocation();

  const recentProjects = projectsData?.projects?.slice(0, 3) || [];

  return (
    <ProtectedLayout>
      <AppPage>
        <AppPageHeader
          eyebrow="Core"
          icon={<LayoutDashboard className="h-5 w-5" />}
          title="Overview"
          description="Monitor project health, recent deployments, and the current state of your platform from one place."
          actions={
            <Button onClick={() => setLocation("/projects?new=true")}>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          }
        />

        <AppPageSection className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Projects</CardTitle>
              <FolderGit2 className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-white">{statsLoading ? "--" : stats?.totalProjects || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Deployments</CardTitle>
              <Activity className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-white">{statsLoading ? "--" : stats?.totalDeployments || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Latest Status</CardTitle>
              <Rocket className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="mt-1">
                {statsLoading ? (
                  <div className="h-6 w-20 animate-pulse rounded-lg bg-zinc-800" />
                ) : (
                  <StatusBadge status={stats?.latestDeploymentStatus} />
                )}
              </div>
            </CardContent>
          </Card>
        </AppPageSection>

        <AppPageSection className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Recent Deployments</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/deployments")}>
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800" />)}
                </div>
              ) : stats?.recentDeployments?.length === 0 ? (
                <div className="py-8 text-center text-zinc-400">No deployments yet</div>
              ) : (
                <div className="space-y-4">
                  {stats?.recentDeployments?.map(dep => (
                    <Link key={dep.id} href={`/projects/${dep.projectId}/deployments/${dep.id}`}>
                      <div className="group flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:bg-zinc-800">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={dep.status} />
                          <div>
                            <p className="text-sm font-medium text-white transition-colors group-hover:text-violet-400">{dep.projectName || 'Project'}</p>
                            <p className="text-xs text-zinc-400">{formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}</p>
                          </div>
                        </div>
                        <div className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
                          {dep.environment}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Your Projects</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")}>
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-800" />)}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="mb-4 text-zinc-400">No projects created yet.</p>
                  <Button variant="outline" onClick={() => setLocation("/projects?new=true")}>Create First Project</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentProjects.map(project => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="group flex cursor-pointer items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:bg-zinc-800">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-white">
                          <FrameworkIcon framework={project.framework} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="truncate font-semibold text-white transition-colors group-hover:text-violet-400">{project.name}</h4>
                          <p className="truncate text-xs text-zinc-400">{project.repoUrl || 'No repository linked'}</p>
                        </div>
                        <StatusBadge status={project.latestDeploymentStatus} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AppPageSection>
      </AppPage>
    </ProtectedLayout>
  );
}
