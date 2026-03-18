import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { environmentVariablesTable, projectsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/projects/:projectId/env-vars", async (req, res) => {
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

  const envVars = await db
    .select()
    .from(environmentVariablesTable)
    .where(eq(environmentVariablesTable.projectId, projectId))
    .orderBy(environmentVariablesTable.key);

  res.json({ envVars });
});

router.post("/projects/:projectId/env-vars", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;
  const { key, value, environment = "production" } = req.body;

  if (!key || !value) {
    res.status(400).json({ error: "Key and value are required" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [envVar] = await db
    .insert(environmentVariablesTable)
    .values({ projectId, key, value, environment })
    .returning();

  res.status(201).json(envVar);
});

router.delete("/projects/:projectId/env-vars/:envVarId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId, envVarId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(environmentVariablesTable)
    .where(
      and(
        eq(environmentVariablesTable.id, envVarId),
        eq(environmentVariablesTable.projectId, projectId)
      )
    );

  if (!existing) {
    res.status(404).json({ error: "Environment variable not found" });
    return;
  }

  await db
    .delete(environmentVariablesTable)
    .where(eq(environmentVariablesTable.id, envVarId));

  res.json({ success: true });
});

export default router;
