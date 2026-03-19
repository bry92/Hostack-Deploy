import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { IS_FALLBACK } from "../lib/runtimeMode.ts";

const router: IRouter = Router();
const NEXT_CONFIG_FILES = new Set([
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "next.config.cjs",
]);
const VITE_CONFIG_FILES = new Set([
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "vite.config.cjs",
]);

type GitHubRepoInfo = {
  default_branch?: string;
};

type GitHubContentEntry = {
  name?: string;
  type?: string;
  content?: string;
  encoding?: string;
};

type RepoDetection = {
  buildCommand: string | null;
  framework: string;
  installCommand: string | null;
  repoBranch: string;
  rootDirectory: string;
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

function parseGitHubTextFile(entry: GitHubContentEntry | null): string | null {
  if (!entry?.content || entry.encoding !== "base64") {
    return null;
  }

  try {
    return Buffer.from(entry.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function detectFrameworkFromPackageJson(packageJson: string | null): {
  buildCommand: string | null;
  framework: string;
} {
  if (!packageJson) {
    return {
      buildCommand: null,
      framework: "node-api",
    };
  }

  try {
    const parsed = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const deps = {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
    };
    const buildCommand = typeof parsed.scripts?.build === "string" ? "npm run build" : null;

    if (deps.next) return { framework: "next.js", buildCommand };
    if (deps.vue) return { framework: "vue", buildCommand };
    if (deps["@sveltejs/kit"]) return { framework: "sveltekit", buildCommand };
    if (deps.react) return { framework: "react", buildCommand };
    if (deps.vite) return { framework: "vite", buildCommand };

    return {
      buildCommand,
      framework: "node-api",
    };
  } catch {
    return {
      buildCommand: null,
      framework: "node-api",
    };
  }
}

function detectInstallCommand(names: Set<string>): string {
  if (names.has("pnpm-lock.yaml")) {
    return "pnpm install";
  }

  if (names.has("yarn.lock")) {
    return "yarn install";
  }

  return "npm install";
}

async function detectRepoConfig(
  owner: string,
  repoName: string,
  accessToken: string,
): Promise<RepoDetection> {
  const repoInfo = await fetchGitHubJson<GitHubRepoInfo>(`repos/${owner}/${repoName}`, accessToken);
  const repoBranch = repoInfo?.default_branch?.trim() || "main";
  const contents =
    (await fetchGitHubJson<GitHubContentEntry[]>(
      `repos/${owner}/${repoName}/contents?ref=${encodeURIComponent(repoBranch)}`,
      accessToken,
    )) ?? [];

  const names = new Set(
    contents
      .map((entry) => entry.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const installCommand = detectInstallCommand(names);

  const packageJsonEntry = contents.find((entry) => entry.name === "package.json" && entry.type === "file");
  const packageJson =
    packageJsonEntry == null
      ? null
      : parseGitHubTextFile(
          await fetchGitHubJson<GitHubContentEntry>(
            `repos/${owner}/${repoName}/contents/package.json?ref=${encodeURIComponent(repoBranch)}`,
            accessToken,
          ),
        );

  if ([...NEXT_CONFIG_FILES].some((fileName) => names.has(fileName))) {
    return {
      framework: "next.js",
      buildCommand: "npm run build",
      installCommand,
      repoBranch,
      rootDirectory: "",
    };
  }

  if ([...VITE_CONFIG_FILES].some((fileName) => names.has(fileName))) {
    const fromPackage = detectFrameworkFromPackageJson(packageJson);
    return {
      framework: fromPackage.framework === "node-api" ? "vite" : fromPackage.framework,
      buildCommand: fromPackage.buildCommand ?? "npm run build",
      installCommand,
      repoBranch,
      rootDirectory: "",
    };
  }

  if (names.has("package.json")) {
    const fromPackage = detectFrameworkFromPackageJson(packageJson);
    return {
      framework: fromPackage.framework,
      buildCommand: fromPackage.buildCommand,
      installCommand,
      repoBranch,
      rootDirectory: "",
    };
  }

  return {
    framework: "static",
    buildCommand: null,
    installCommand: null,
    repoBranch,
    rootDirectory: "",
  };
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
      id: "fallback-repo-project",
      name: repoName,
      repoOwner: owner,
      repoName,
    });
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

    const detected = await detectRepoConfig(owner, repoName, accessToken);
    const { db } = await import("@workspace/db");
    const { projectsTable } = await import("@workspace/db/schema");

    const [created] = await db
      .insert(projectsTable)
      .values({
        userId: req.user.id,
        name: repoName,
        slug: slugify(repoName),
        framework: detected.framework,
        repoUrl: `https://github.com/${repoFullName}`,
        repoOwner: owner,
        repoName,
        repoBranch: detected.repoBranch,
        rootDirectory: detected.rootDirectory,
        buildCommand: detected.buildCommand,
        installCommand: detected.installCommand,
        autoDeploy: false,
      })
      .returning();

    res.status(201).json(created);
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
