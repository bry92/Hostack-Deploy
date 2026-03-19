import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { IS_FALLBACK } from "../lib/runtimeMode.ts";

const router: IRouter = Router();

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
        rootDirectory: "/",
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
