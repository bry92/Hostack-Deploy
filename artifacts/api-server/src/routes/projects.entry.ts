import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { enqueueJob } from "@workspace/queue";
import { and, eq } from "drizzle-orm";
import { IS_FALLBACK } from "../lib/runtimeMode.ts";

const router: IRouter = Router();

type GitHubRepoInfo = {
  default_branch?: string;
};

type RepoProjectResponse = {
  deployment?: {
    id: string;
    projectId: string;
  } | null;
  id: string;
  name: string;
  repoName?: string | null;
  repoOwner?: string | null;
};

function getProjectName(req: Request): string | null {
  const name = req.body?.name;
  if (typeof name !== "string") {
    return null;
  }

  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  return `${base || "project"}-${Math.random().toString(36).slice(2, 7)}`;
}

function getProjectId(req: Request): string | null {
  const projectId = req.params.projectId;
  if (typeof projectId !== "string") {
    return null;
  }

  const trimmed = projectId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getRepoFullName(req: Request): string | null {
  const repoFullName = req.body?.repoFullName;
  if (typeof repoFullName !== "string") {
    return null;
  }

  const trimmed = repoFullName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getGitHubAccessToken(userId: string): Promise<string | null> {
  const [{ db }, { integrationsTable }, { decryptMetadata }] = await Promise.all([
    import("@workspace/db"),
    import("@workspace/db/schema"),
    import("../lib/secrets.js"),
  ]);

  const [integration] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, "github")));

  if (!integration) {
    return null;
  }

  const metadata = decryptMetadata(integration.metadata as Record<string, unknown> | null);
  return typeof metadata.accessToken === "string" ? metadata.accessToken : null;
}

async function fetchGitHubJson<T>(path: string, accessToken: string): Promise<T | null> {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Hostack",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `GitHub responded with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getRepoDefaultBranch(
  owner: string,
  repoName: string,
  accessToken: string,
): Promise<string> {
  const repoInfo = await fetchGitHubJson<GitHubRepoInfo>(`repos/${owner}/${repoName}`, accessToken);
  return repoInfo?.default_branch?.trim() || "main";
}

router.get("/projects", async (req: Request, res: Response, next: NextFunction) => {
  if (IS_FALLBACK) {
    res.json([
      { id: "fallback-1", name: "Fallback Project" },
    ]);
    return;
  }

  try {
    const { default: fullProjectsRouter } = await import("./projects.js");
    fullProjectsRouter(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.post("/projects", async (req: Request, res: Response) => {
  const name = getProjectName(req);
  if (!name) {
    res.status(400).json({ error: "name_required" });
    return;
  }

  if (IS_FALLBACK) {
    res.status(201).json({
      id: "fallback-new",
      name,
    });
    return;
  }

  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const { projectsTable } = await import("@workspace/db/schema");

    const [created] = await db
      .insert(projectsTable)
      .values({
        userId: req.user.id,
        name,
        slug: slugify(name),
        framework: "manual",
        repoUrl: null,
        repoOwner: null,
        repoName: null,
        repoBranch: "main",
        rootDirectory: "",
        buildCommand: null,
        installCommand: null,
        autoDeploy: false,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    console.error("DB INSERT ERROR:", error);
    res.status(500).json({
      error: "failed_to_create_project",
      message: error?.message,
      detail: error?.cause ?? null,
    });
  }
});

router.post("/projects/from-repo", async (req: Request, res: Response) => {
  const repoFullName = getRepoFullName(req);
  if (!repoFullName) {
    res.status(400).json({ error: "repo_required" });
    return;
  }

  const [owner, repoName] = repoFullName.split("/");
  if (!owner || !repoName) {
    res.status(400).json({ error: "repo_required" });
    return;
  }

  if (IS_FALLBACK) {
    res.status(201).json({
      deployment: null,
      id: "fallback-repo-project",
      name: repoName,
      repoOwner: owner,
      repoName,
    } satisfies RepoProjectResponse);
    return;
  }

  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const accessToken = await getGitHubAccessToken(req.user.id);
    if (!accessToken) {
      res.status(400).json({ error: "github_not_connected" });
      return;
    }

    const repoBranch = await getRepoDefaultBranch(owner, repoName, accessToken);
    const [{ db }, { deploymentsTable, projectsTable }, deploymentExecutor] = await Promise.all([
      import("@workspace/db"),
      import("@workspace/db/schema"),
      import("../services/deploymentExecutor.js"),
    ]);

    const [created] = await db
      .insert(projectsTable)
      .values({
        userId: req.user.id,
        name: repoName,
        slug: slugify(repoName),
        framework: "unknown",
        repoUrl: `https://github.com/${repoFullName}`,
        repoOwner: owner,
        repoName,
        repoBranch: repoBranch,
        rootDirectory: "",
        buildCommand: null,
        installCommand: null,
        autoDeploy: false,
      })
      .returning();

    const executionMode = deploymentExecutor.determineExecutionMode(created);
    const [deployment] = await db
      .insert(deploymentsTable)
      .values({
        projectId: created.id,
        status: "queued",
        environment: "production",
        triggerType: "api",
        executionMode,
        simulated: executionMode === "simulated",
        branch: created.repoBranch || "main",
        commitMessage: `Initial deploy for ${repoFullName}`,
      })
      .returning({
        id: deploymentsTable.id,
        projectId: deploymentsTable.projectId,
      });

    enqueueJob(db, {
      type: "build_requested",
      payload: { deploymentId: deployment.id },
    }).catch(console.error);

    res.status(201).json({
      ...created,
      deployment,
    } satisfies RepoProjectResponse);
  } catch (error: any) {
    res.status(500).json({
      error: "failed_to_create_from_repo",
      message: error?.message,
    });
  }
});

router.delete("/projects/:projectId", async (req: Request, res: Response) => {
  const projectId = getProjectId(req);
  if (!projectId) {
    res.status(400).json({ error: "project_id_required" });
    return;
  }

  if (IS_FALLBACK) {
    res.json({
      success: true,
      id: projectId,
    });
    return;
  }

  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const { projectsTable } = await import("@workspace/db/schema");

    const [deleted] = await db
      .delete(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .returning({
        id: projectsTable.id,
      });

    if (!deleted) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }

    res.json({
      success: true,
      id: deleted.id,
    });
  } catch (error: any) {
    console.error("DB DELETE ERROR:", error);
    res.status(500).json({
      error: "failed_to_delete_project",
      message: error?.message,
      detail: error?.cause ?? null,
    });
  }
});

export default router;
