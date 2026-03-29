import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { enqueueJob } from "@workspace/queue";
import { and, eq, inArray } from "drizzle-orm";
import { IS_FALLBACK } from "../lib/runtimeMode.ts";

const router: IRouter = Router();
const notionDeployRequestsInFlight = new Set<string>();

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

type ParsedRepo = {
  owner: string;
  repoName: string;
  repoUrl: string;
  repoFullName: string;
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

function getRepoUrl(req: Request): string | null {
  const repoUrl =
    req.body?.repoUrl ??
    (typeof req.query.repoUrl === "string" ? req.query.repoUrl : null);
  if (typeof repoUrl !== "string") {
    return null;
  }

  const trimmed = repoUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNotionPageId(req: Request): string | null {
  const notionPageId =
    req.body?.notionPageId ??
    req.body?.pageId ??
    (typeof req.query.notionPageId === "string" ? req.query.notionPageId : null) ??
    (typeof req.query.pageId === "string" ? req.query.pageId : null);
  if (typeof notionPageId !== "string") {
    return null;
  }

  const trimmed = notionPageId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNotionDemoKey(req: Request): string | null {
  const key =
    req.body?.key ??
    (typeof req.query.key === "string" ? req.query.key : null);
  if (typeof key !== "string") {
    return null;
  }

  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidNotionPageId(pageId: string): boolean {
  return /^[a-f0-9]{32}$/i.test(pageId.replace(/-/g, ""));
}

function parseGitHubRepoUrl(repoUrl: string): ParsedRepo | null {
  try {
    const normalized = repoUrl.trim().replace(/\.git$/, "");
    const url = new URL(normalized);
    if (url.protocol !== "https:" || !/(^|\.)github\.com$/i.test(url.hostname)) {
      return null;
    }

    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const owner = parts[0];
    const repoName = parts[1];
    return {
      owner,
      repoName,
      repoFullName: `${owner}/${repoName}`,
      repoUrl: `https://github.com/${owner}/${repoName}`,
    };
  } catch {
    return null;
  }
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

async function createProjectAndInitialDeploymentFromRepo(input: {
  notionPageId?: string | null;
  repo: ParsedRepo;
  userId: string;
  accessToken?: string | null;
}): Promise<RepoProjectResponse> {
  const { repo, userId, accessToken, notionPageId } = input;
  const repoBranch = accessToken
    ? await getRepoDefaultBranch(repo.owner, repo.repoName, accessToken)
    : "main";

  const [{ db }, { deploymentsTable, projectsTable }, deploymentExecutor] = await Promise.all([
    import("@workspace/db"),
    import("@workspace/db/schema"),
    import("../services/deploymentExecutor.js"),
  ]);

  const [created] = await db
    .insert(projectsTable)
    .values({
      userId,
      name: repo.repoName,
      slug: slugify(repo.repoName),
      framework: "unknown",
      repoUrl: repo.repoUrl,
      repoOwner: repo.owner,
      repoName: repo.repoName,
      repoBranch,
      rootDirectory: "",
      buildCommand: null,
      installCommand: null,
      autoDeploy: false,
    })
    .returning();

  const executionMode = deploymentExecutor.determineExecutionMode(created);
  let deployment:
    | {
        id: string;
        projectId: string;
      }
    | undefined;

  try {
    [deployment] = await db
      .insert(deploymentsTable)
      .values({
        projectId: created.id,
        status: "pending",
        notionPageId: notionPageId ?? null,
        environment: "production",
        triggerType: "api",
        executionMode,
        simulated: executionMode === "simulated",
        branch: created.repoBranch || "main",
        commitMessage: `Initial deploy for ${repo.repoFullName}`,
      })
      .returning({
        id: deploymentsTable.id,
        projectId: deploymentsTable.projectId,
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[notion] metadata persist skipped during deployment insert: ${message}`);
    [deployment] = await db
      .insert(deploymentsTable)
      .values({
        projectId: created.id,
        status: "pending",
        environment: "production",
        triggerType: "api",
        executionMode,
        simulated: executionMode === "simulated",
        branch: created.repoBranch || "main",
        commitMessage: `Initial deploy for ${repo.repoFullName}`,
      })
      .returning({
        id: deploymentsTable.id,
        projectId: deploymentsTable.projectId,
      });
  }

  enqueueJob(db, {
    type: "build_requested",
    payload: { deploymentId: deployment.id },
  }).catch(console.error);

  return {
    ...created,
    deployment,
  } satisfies RepoProjectResponse;
}

async function recentDeploymentExists(notionPageId: string): Promise<boolean> {
  const [{ db }, { deploymentsTable }] = await Promise.all([
    import("@workspace/db"),
    import("@workspace/db/schema"),
  ]);

  const [existing] = await db
    .select({ id: deploymentsTable.id })
    .from(deploymentsTable)
    .where(
      and(
        eq(deploymentsTable.notionPageId, notionPageId),
        inArray(deploymentsTable.status, ["pending", "building", "deploying"]),
      ),
    )
    .limit(1);

  return !!existing;
}

async function forwardToFullProjectsRouter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { default: fullProjectsRouter } = await import("./projects.js");
    fullProjectsRouter(req, res, next);
  } catch (error) {
    next(error);
  }
}

router.get("/projects", async (req: Request, res: Response, next: NextFunction) => {
  if (IS_FALLBACK) {
    res.json([
      { id: "fallback-1", name: "Fallback Project" },
    ]);
    return;
  }

  await forwardToFullProjectsRouter(req, res, next);
});

router.get("/projects/:projectId", async (req: Request, res: Response, next: NextFunction) => {
  if (IS_FALLBACK) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }

  await forwardToFullProjectsRouter(req, res, next);
});

router.put("/projects/:projectId", async (req: Request, res: Response, next: NextFunction) => {
  if (IS_FALLBACK) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }

  await forwardToFullProjectsRouter(req, res, next);
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

    const created = await createProjectAndInitialDeploymentFromRepo({
      repo: {
        owner,
        repoName,
        repoFullName,
        repoUrl: `https://github.com/${repoFullName}`,
      },
      userId: req.user.id,
      accessToken,
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({
      error: "failed_to_create_from_repo",
      message: error?.message,
    });
  }
});

async function handleNotionDeploy(req: Request, res: Response) {
  const repoUrl = getRepoUrl(req);
  if (!repoUrl) {
    res.status(400).json({ error: "repo_url_required" });
    return;
  }
  if (!repoUrl.startsWith("https://github.com/")) {
    res.status(400).json({ error: "invalid_repo_url" });
    return;
  }

  const notionPageId = getNotionPageId(req);
  if (!notionPageId) {
    res.status(400).json({ error: "notion_page_id_required" });
    return;
  }
  if (!isValidNotionPageId(notionPageId)) {
    res.status(400).json({ error: "invalid_notion_page_id" });
    return;
  }

  const expectedDemoKey = process.env.NOTION_DEMO_KEY?.trim();
  const providedDemoKey = getNotionDemoKey(req);
  if (!expectedDemoKey || providedDemoKey !== expectedDemoKey) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (notionDeployRequestsInFlight.has(notionPageId) || await recentDeploymentExists(notionPageId)) {
    res.status(429).json({ error: "deployment_in_progress" });
    return;
  }

  const repo = parseGitHubRepoUrl(repoUrl);
  if (!repo) {
    res.status(400).json({ error: "invalid_repo_url" });
    return;
  }

  if (IS_FALLBACK) {
    res.status(201).json({
      deploymentId: "fallback-notion-deployment",
      status: "started",
    });
    return;
  }

  console.log("Notion deploy triggered:", {
    repoUrl,
    notionPageId,
  });

  notionDeployRequestsInFlight.add(notionPageId);
  try {
    const userId = req.isAuthenticated() ? req.user.id : "notion-demo-user";
    const accessToken = req.isAuthenticated()
      ? await getGitHubAccessToken(req.user.id)
      : null;
    const [{ syncDeploymentToNotion, updateNotionPage }] = await Promise.all([
      import("../services/notionDeploymentSync.js"),
    ]);

    const created = await createProjectAndInitialDeploymentFromRepo({
      repo,
      userId,
      accessToken,
      notionPageId,
    });
    const deploymentId = created.deployment?.id ?? null;

    res.status(201).json({
      deploymentId,
      status: "started",
    });

    updateNotionPage({
      aiSummary: "Deployment started...",
      deploymentId,
      pageId: notionPageId,
      previewUrl: null,
      repoUrl,
      status: "building",
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[notion] failed to mark page ${notionPageId} building: ${message}`);
    });

    if (deploymentId) {
      syncDeploymentToNotion(deploymentId, { status: "building" }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[notion] failed to sync deployment ${deploymentId} to Notion: ${message}`);
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: "failed_to_start_notion_deploy",
      message: error?.message,
    });
  } finally {
    notionDeployRequestsInFlight.delete(notionPageId);
  }
}

router.get("/notion/deploy", handleNotionDeploy);
router.post("/notion/deploy", handleNotionDeploy);

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
