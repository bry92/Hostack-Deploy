import { ProtectedLayout } from "@/components/layout/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderGit2, Activity, Rocket, ArrowRight, Plus } from "lucide-react";
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
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your deployments and projects.</p>
          </div>
          <Button onClick={() => setLocation("/projects")} className="shadow-md shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover-elevate transition-all border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
              <FolderGit2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{statsLoading ? "--" : stats?.totalProjects || 0}</div>
            </CardContent>
          </Card>
          <Card className="hover-elevate transition-all border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Deployments</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{statsLoading ? "--" : stats?.totalDeployments || 0}</div>
            </CardContent>
          </Card>
          <Card className="hover-elevate transition-all border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Latest Status</CardTitle>
              <Rocket className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mt-1">
                {statsLoading ? (
                  <div className="h-6 w-20 bg-muted animate-pulse rounded-md" />
                ) : (
                  <StatusBadge status={stats?.latestDeploymentStatus} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Recent Deployments */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Recent Deployments</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/deployments")} className="text-muted-foreground hover:text-foreground">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted/50 animate-pulse rounded-md" />)}
                </div>
              ) : stats?.recentDeployments?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No deployments yet</div>
              ) : (
                <div className="space-y-4">
                  {stats?.recentDeployments?.map(dep => (
                    <Link key={dep.id} href={`/projects/${dep.projectId}/deployments/${dep.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={dep.status} />
                          <div>
                            <p className="font-medium text-sm group-hover:text-primary transition-colors">{dep.projectName || 'Project'}</p>
                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}</p>
                          </div>
                        </div>
                        <div className="text-xs px-2 py-1 bg-white/5 rounded text-muted-foreground">
                          {dep.environment}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Projects */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Your Projects</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="text-muted-foreground hover:text-foreground">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-md" />)}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No projects created yet.</p>
                  <Button variant="outline" onClick={() => setLocation("/projects")}>Create First Project</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentProjects.map(project => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group">
                        <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center text-foreground border border-white/10">
                          <FrameworkIcon framework={project.framework} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{project.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">{project.repoUrl || 'No repository linked'}</p>
                        </div>
                        <StatusBadge status={project.latestDeploymentStatus} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  );
}
