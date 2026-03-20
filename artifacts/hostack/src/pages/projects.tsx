import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

type Project = {
  id: string;
  name: string;
};

type Repo = {
  id: string;
  fullName: string;
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

export default function ProjectsPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const isCreating = params.get("new") === "true";
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoActionLoading, setRepoActionLoading] = useState(false);

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = (await res.json()) as ProjectsResponse & { error?: string };
      console.log("projects:", data);

      if (!res.ok) {
        setProjects([]);
        throw new Error(data.error || "Failed to load projects");
      }

      setProjects(getProjects(data));
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadRepos() {
    setReposLoading(true);
    try {
      const res = await fetch("/api/github/repos");
      const data: ReposResponse = await res.json();
      console.log("repos:", data);

      if (!res.ok) {
        if ((data as { error?: string }).error === "github_not_connected") {
          setGithubConnected(false);
          setRepos([]);
          return;
        }

        throw new Error("Failed to load repos");
      }

      setGithubConnected(true);
      setRepos(getRepos(data));
    } catch (err) {
      console.error("Failed to load repos", err);
      setGithubConnected(null);
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }

  async function deleteProject(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      setProjects((prev) => prev.filter((project) => project.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  async function createProjectFromRepo(repoFullName: string) {
    setRepoActionLoading(true);

    try {
      const res = await fetch("/api/projects/from-repo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoFullName }),
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
    } catch (err) {
      console.error("Failed to create project from repo", err);
    } finally {
      setRepoActionLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    if (isCreating) {
      void loadRepos();
      return;
    }

    setRepos([]);
    setGithubConnected(null);
  }, [isCreating]);

  function connectGitHub() {
    window.location.href = "/api/integrations/github/connect";
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>{isCreating ? "Select a Repo" : "Projects"}</h1>
        {isCreating ? (
          <button onClick={() => setLocation("/projects")}>Back to Projects</button>
        ) : (
          <button onClick={() => setLocation("/projects?new=true")}>+ New Project</button>
        )}
      </div>

      {isCreating ? (
        <div>
          {reposLoading ? (
            <p>Loading repos...</p>
          ) : githubConnected === false ? (
            <div>
              <p>Connect GitHub to load repositories.</p>
              <button onClick={connectGitHub} style={{ marginTop: 8 }}>
                Connect GitHub
              </button>
            </div>
          ) : repos.length === 0 ? (
            <p>No GitHub repos available.</p>
          ) : (
            repos.map((repo) => (
              <div key={repo.id} style={{ marginBottom: 10 }}>
                <span>{repo.fullName}</span>
                <button
                  onClick={() => createProjectFromRepo(repo.fullName)}
                  style={{ marginLeft: 10 }}
                >
                  Deploy
                </button>
              </div>
            ))
          )}

          {repoActionLoading && <p>Creating project and starting deployment...</p>}
        </div>
      ) : (
        <>
          {projectsLoading ? (
            <p>Loading...</p>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project.id} style={{ marginBottom: 8 }}>
                  {project.name}
                  <button
                    onClick={() => deleteProject(project.id)}
                    style={{ marginLeft: 10 }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
