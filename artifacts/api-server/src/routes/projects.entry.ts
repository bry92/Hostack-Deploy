import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
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

  try {
    const { db } = await import("@workspace/db");
    const { projectsTable } = await import("@workspace/db/schema");

    const [created] = await db
      .insert(projectsTable)
      .values({
        userId: "public-dev",
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

export default router;
