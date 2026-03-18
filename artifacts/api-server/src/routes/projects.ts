import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, deploymentsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parseRepoOwnerName(repoUrl?: string | null): { repoOwner?: string; repoName?: string } {
  if (!repoUrl) return {};
  try {
    const url = new URL(repoUrl.replace(/\.git$/, ""));
    if (!url.hostname.includes("github.com")) return {};
    const parts = url.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return {};
    return { repoOwner: parts[0], repoName: parts[1] };
  } catch {
    return {};
  }
}

function safeProject(p: Record<string, unknown>) {
  const { githubToken: _t, webhookSecret: _s, ...rest } = p;
  return rest;
}

router.get("/projects", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.createdAt));

  const projectsWithStatus = await Promise.all(
    projects.map(async (project) => {
      const [latestDeployment] = await db
        .select()
        .from(deploymentsTable)
        .where(eq(deploymentsTable.projectId, project.id))
        .orderBy(desc(deploymentsTable.createdAt))
        .limit(1);
      return {
        ...safeProject(project as unknown as Record<string, unknown>),
        latestDeploymentStatus: latestDeployment?.status ?? null,
      };
    })
  );

  res.json({ projects: projectsWithStatus });
});

router.post("/projects", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const {
    name,
    framework,
    repoUrl,
    repoBranch,
    buildCommand,
    installCommand,
    rootDirectory,
    autoDeploy,
  } = req.body;

  if (!name || !framework) {
    res.status(400).json({ error: "Name and framework are required" });
    return;
  }

  const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 7);
  const { repoOwner, repoName } = parseRepoOwnerName(repoUrl);

  const [project] = await db
    .insert(projectsTable)
    .values({
      userId,
      name,
      slug,
      framework,
      repoUrl: repoUrl || null,
      repoOwner: repoOwner || null,
      repoName: repoName || null,
      repoBranch: repoBranch || "main",
      buildCommand: buildCommand || null,
      installCommand: installCommand || null,
      rootDirectory: rootDirectory || "",
      autoDeploy: autoDeploy !== undefined ? Boolean(autoDeploy) : true,
    })
    .returning();

  res.status(201).json({
    ...safeProject(project as unknown as Record<string, unknown>),
    latestDeploymentStatus: null,
  });
});

router.get("/projects/:projectId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [latestDeployment] = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.projectId, project.id))
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(1);

  res.json({
    ...safeProject(project as unknown as Record<string, unknown>),
    latestDeploymentStatus: latestDeployment?.status ?? null,
  });
});

router.put("/projects/:projectId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;
  const {
    name,
    framework,
    repoUrl,
    repoBranch,
    buildCommand,
    installCommand,
    rootDirectory,
    autoDeploy,
  } = req.body;

  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const newRepoUrl = repoUrl !== undefined ? repoUrl : existing.repoUrl;
  const { repoOwner, repoName } = parseRepoOwnerName(newRepoUrl);

  const [updated] = await db
    .update(projectsTable)
    .set({
      name: name ?? existing.name,
      framework: framework ?? existing.framework,
      repoUrl: newRepoUrl,
      repoOwner: repoOwner || existing.repoOwner,
      repoName: repoName || existing.repoName,
      repoBranch: repoBranch !== undefined ? repoBranch : existing.repoBranch,
      buildCommand: buildCommand !== undefined ? buildCommand : existing.buildCommand,
      installCommand: installCommand !== undefined ? installCommand : existing.installCommand,
      rootDirectory: rootDirectory !== undefined ? rootDirectory : existing.rootDirectory,
      autoDeploy: autoDeploy !== undefined ? Boolean(autoDeploy) : existing.autoDeploy,
    })
    .where(eq(projectsTable.id, projectId))
    .returning();

  const [latestDeployment] = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.projectId, updated.id))
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(1);

  res.json({
    ...safeProject(updated as unknown as Record<string, unknown>),
    latestDeploymentStatus: latestDeployment?.status ?? null,
  });
});

router.delete("/projects/:projectId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;

  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  res.json({ success: true });
});

export default router;
