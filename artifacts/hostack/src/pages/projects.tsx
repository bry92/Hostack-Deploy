import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Box,
  Github,
  LayoutDashboard,
  Plus,
  Rocket,
  Search,
  Trash2,
} from "lucide-react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { AppPage, AppPageHeader, AppPageSection } from "@/components/layout/app-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FrameworkIcon } from "@/components/ui/framework-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";

type Project = {
  framework?: string | null;
  id: string;
  latestDeploymentStatus?: string | null;
  name: string;
  repoUrl?: string | null;
  updatedAt?: string | null;
};

type Repo = {
  fullName: string;
  id: string;
};

type RepoCreateResponse = {
  deployment?: {
    id: string;
    projectId: string;
  } | null;
  id: string;
};

type ProjectsResponse = Project[] | { projects?: Project[] };
type ReposResponse = { repos?: Repo[] };

function getProjects(data: ProjectsResponse): Project[] {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data.projects) ? data.projects : [];
}

function getRepos(data: ReposResponse): Repo[] {
  return Array.isArray(data.repos) ? data.repos : [];
}

function formatUpdatedAt(value?: string | null): string {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Never";
  }

  return formatDistanceToNow(parsed, { addSuffix: true });
}

export default function ProjectsPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const isCreating = params.get("new") === "true";

  const [projectSearch, setProjectSearch] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoActionLoading, setRepoActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) {
      return projects;
    }

    return projects.filter((project) => {
      const name = project.name.toLowerCase();
      const repo = project.repoUrl?.toLowerCase() ?? "";
      const framework = project.framework?.toLowerCase() ?? "";
      return name.includes(query) || repo.includes(query) || framework.includes(query);
    });
  }, [projectSearch, projects]);

  const filteredRepos = useMemo(() => {
    const query = repoSearch.trim().toLowerCase();
    if (!query) {
      return repos;
    }

    return repos.filter((repo) => repo.fullName.toLowerCase().includes(query));
  }, [repoSearch, repos]);

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = (await res.json()) as ProjectsResponse & { error?: string };

      if (!res.ok) {
        setProjects([]);
        throw new Error(data.error || "Failed to load projects");
      }

      setProjects(getProjects(data));
    } catch (error) {
      console.error("Failed to load projects", error);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadRepos() {
    setReposLoading(true);
    try {
      const res = await fetch("/api/github/repos");
      const data = (await res.json()) as ReposResponse & { error?: string };

      if (!res.ok) {
        if (data.error === "github_not_connected") {
          setGithubConnected(false);
          setRepos([]);
          return;
        }

        throw new Error(data.error || "Failed to load repos");
      }

      setGithubConnected(true);
      setRepos(getRepos(data));
    } catch (error) {
      console.error("Failed to load repos", error);
      toast({
        title: "Failed to load GitHub repositories",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setGithubConnected(null);
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }

  async function deleteProject(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      setProjects((previous) => previous.filter((project) => project.id !== id));
    } catch (error) {
      console.error("Delete failed", error);
    } finally {
      setDeletingId(null);
    }
  }

  async function createProjectFromRepo(repoFullName: string) {
    setRepoActionLoading(true);

    try {
      const res = await fetch("/api/projects/from-repo", {
        body: JSON.stringify({ repoFullName }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const data = (await res.json()) as RepoCreateResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed");
      }

      if (data.deployment?.id && data.deployment.projectId) {
        setLocation(`/projects/${data.deployment.projectId}/deployments/${data.deployment.id}`);
        return;
      }

      await loadProjects();
      setLocation("/projects");
    } catch (error) {
      console.error("Failed to create project from repo", error);
      toast({
        title: "Failed to create project from repository",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRepoActionLoading(false);
    }
  }

  function connectGitHub() {
    window.location.href = "/api/integrations/github/connect";
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!isCreating) {
      setRepos([]);
      setGithubConnected(null);
      setRepoSearch("");
      return;
    }

    void loadRepos();
  }, [isCreating]);

  return (
    <ProtectedLayout>
      <AppPage>
        <AppPageHeader
          eyebrow={isCreating ? "Repository Import" : "Core"}
          icon={isCreating ? <Github className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}
          title={isCreating ? "Import From GitHub" : "Projects"}
          description={
            isCreating
              ? "Pick a repository and Hostack will create the project, queue the first deployment, and route you straight into the build stream."
              : "Manage application roots, repository connections, and deployment state across every project."
          }
          actions={
            isCreating ? (
              <Button variant="outline" onClick={() => setLocation("/projects")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Button>
            ) : (
              <Button onClick={() => setLocation("/projects?new=true")}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )
          }
        />

        {isCreating ? (
          <AppPageSection>
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                onChange={(event) => setRepoSearch(event.target.value)}
                placeholder="Search connected repositories..."
                value={repoSearch}
              />
            </div>

            {reposLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((value) => (
                  <div key={value} className="h-36 animate-pulse rounded-xl bg-muted/30" />
                ))}
              </div>
            ) : githubConnected === false ? (
              <Card className="border-dashed border-border/60 bg-card/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    Connect GitHub
                  </CardTitle>
                  <CardDescription>
                    Your GitHub repositories are not available yet. Connect your account to import a repo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={connectGitHub}>
                    <Github className="mr-2 h-4 w-4" />
                    Connect GitHub
                  </Button>
                </CardContent>
              </Card>
            ) : filteredRepos.length === 0 ? (
              <Card className="border-dashed border-border/60 bg-card/20">
                <CardHeader>
                  <CardTitle>No repositories found</CardTitle>
                  <CardDescription>
                    {repoSearch
                      ? "No connected repository matches your search."
                      : "No GitHub repositories are available for this account."}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredRepos.map((repo) => (
                  <Card
                    key={repo.id}
                    className="border-border/50 bg-card/40 backdrop-blur-sm transition-all duration-300"
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Github className="h-5 w-5 text-muted-foreground" />
                        <span className="truncate">{repo.fullName}</span>
                      </CardTitle>
                      <CardDescription>
                        Create a project from this repository and start the first deployment.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Repository import</span>
                      <Button
                        disabled={repoActionLoading}
                        onClick={() => createProjectFromRepo(repo.fullName)}
                      >
                        <Rocket className="mr-2 h-4 w-4" />
                        Deploy
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {repoActionLoading ? (
              <p className="text-sm text-muted-foreground">
                Creating project and starting deployment...
              </p>
            ) : null}
          </AppPageSection>
        ) : (
          <AppPageSection>
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="Search projects..."
                value={projectSearch}
              />
            </div>

            {projectsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((value) => (
                  <div key={value} className="h-40 animate-pulse rounded-xl bg-muted/30" />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <Card className="border-dashed border-border/60 bg-card/20">
                <CardHeader>
                  <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Box className="h-8 w-8" />
                  </div>
                  <CardTitle>No projects found</CardTitle>
                  <CardDescription>
                    {projectSearch
                      ? "No project matches your search."
                      : "Create your first project from a connected GitHub repository."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!projectSearch ? (
                    <Button onClick={() => setLocation("/projects?new=true")}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Project
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                  <div key={project.id} className="flex h-full flex-col gap-3">
                    <Link href={`/projects/${project.id}`}>
                      <Card className="group h-full cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-lg">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors group-hover:border-primary/50">
                              <FrameworkIcon framework={project.framework ?? "unknown"} className="h-5 w-5" />
                            </div>
                            <StatusBadge status={project.latestDeploymentStatus} />
                          </div>
                          <CardTitle className="mt-4 text-xl transition-colors group-hover:text-primary">
                            {project.name}
                          </CardTitle>
                          <div className="mt-1 flex items-center text-xs text-muted-foreground">
                            <Github className="mr-1 h-3 w-3" />
                            <span className="truncate">{project.repoUrl || "No repository"}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0">
                          <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-4 text-xs">
                            <span className="text-muted-foreground">
                              {project.framework || "Unknown"}
                            </span>
                            <span className="text-muted-foreground">
                              {formatUpdatedAt(project.updatedAt)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>

                    <div className="flex justify-end">
                      <Button
                        disabled={deletingId === project.id}
                        onClick={() => deleteProject(project.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AppPageSection>
        )}
      </AppPage>
    </ProtectedLayout>
  );
}
