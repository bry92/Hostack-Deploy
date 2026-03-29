import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { buildRulesTable, deployWebhooksTable, deploymentsTable, projectsTable } from "@workspace/db/schema";
import { enqueueJob } from "@workspace/queue";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { determineExecutionMode } from "../services/deploymentExecutor.js";

const router: IRouter = Router();

router.get("/projects/:projectId/build-rules", async (req, res) => {
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

  const rules = await db
    .select()
    .from(buildRulesTable)
    .where(eq(buildRulesTable.projectId, projectId));

  res.json({ buildRules: rules });
});

router.post("/projects/:projectId/build-rules", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;
  const { branchPattern, environment = "production", autoDeploy = true, buildCommandOverride, installCommandOverride } = req.body ?? {};

  if (!branchPattern || typeof branchPattern !== "string" || !branchPattern.trim()) {
    res.status(400).json({ error: "branchPattern is required" });
    return;
  }

  const validEnvs = ["production", "preview"];
  if (!validEnvs.includes(environment)) {
    res.status(400).json({ error: "environment must be 'production' or 'preview'" });
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

  const [rule] = await db
    .insert(buildRulesTable)
    .values({
      projectId,
      branchPattern,
      environment,
      autoDeploy,
      buildCommandOverride: buildCommandOverride || null,
      installCommandOverride: installCommandOverride || null,
    })
    .returning();

  res.status(201).json(rule);
});

router.put("/projects/:projectId/build-rules/:ruleId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId, ruleId } = req.params;
  const { branchPattern, environment, autoDeploy, buildCommandOverride, installCommandOverride } = req.body ?? {};

  if (branchPattern !== undefined && (typeof branchPattern !== "string" || !branchPattern.trim())) {
    res.status(400).json({ error: "branchPattern must be a non-empty string" });
    return;
  }

  const validEnvs = ["production", "preview"];
  if (environment !== undefined && !validEnvs.includes(environment)) {
    res.status(400).json({ error: "environment must be 'production' or 'preview'" });
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

  const [existing] = await db
    .select()
    .from(buildRulesTable)
    .where(and(eq(buildRulesTable.id, ruleId), eq(buildRulesTable.projectId, projectId)));

  if (!existing) {
    res.status(404).json({ error: "Build rule not found" });
    return;
  }

  const updates: Partial<{
    branchPattern: string;
    environment: string;
    autoDeploy: boolean;
    buildCommandOverride: string | null;
    installCommandOverride: string | null;
  }> = {};
  if (branchPattern !== undefined) updates.branchPattern = branchPattern;
  if (environment !== undefined) updates.environment = environment;
  if (autoDeploy !== undefined) updates.autoDeploy = autoDeploy;
  if (buildCommandOverride !== undefined) updates.buildCommandOverride = buildCommandOverride || null;
  if (installCommandOverride !== undefined) updates.installCommandOverride = installCommandOverride || null;

  const [updated] = await db
    .update(buildRulesTable)
    .set(updates)
    .where(eq(buildRulesTable.id, ruleId))
    .returning();

  res.json(updated);
});

router.delete("/projects/:projectId/build-rules/:ruleId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId, ruleId } = req.params;

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
    .from(buildRulesTable)
    .where(and(eq(buildRulesTable.id, ruleId), eq(buildRulesTable.projectId, projectId)));

  if (!existing) {
    res.status(404).json({ error: "Build rule not found" });
    return;
  }

  await db.delete(buildRulesTable).where(eq(buildRulesTable.id, ruleId));
  res.json({ success: true });
});

router.get("/projects/:projectId/deploy-webhooks", async (req, res) => {
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

  const webhooks = await db
    .select()
    .from(deployWebhooksTable)
    .where(eq(deployWebhooksTable.projectId, projectId));

  res.json({ webhooks });
});

router.post("/projects/:projectId/deploy-webhooks", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;
  const { label = "Default" } = req.body ?? {};

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const secret = randomBytes(32).toString("hex");

  const [webhook] = await db
    .insert(deployWebhooksTable)
    .values({
      projectId,
      secret,
      label,
    })
    .returning();

  res.status(201).json(webhook);
});

router.delete("/projects/:projectId/deploy-webhooks/:webhookId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId, webhookId } = req.params;

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
    .from(deployWebhooksTable)
    .where(and(eq(deployWebhooksTable.id, webhookId), eq(deployWebhooksTable.projectId, projectId)));

  if (!existing) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }

  await db.delete(deployWebhooksTable).where(eq(deployWebhooksTable.id, webhookId));
  res.json({ success: true });
});

function matchBranchPattern(pattern: string, branch: string): boolean {
  if (pattern === branch) return true;
  if (pattern === "*") return true;
  if (pattern.endsWith("/*") && branch.startsWith(pattern.slice(0, -1))) return true;
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    try {
      return new RegExp("^" + escaped + "$").test(branch);
    } catch {
      return false;
    }
  }
  return false;
}

router.post("/webhooks/:projectId/:secret", async (req, res) => {
  const { projectId, secret } = req.params;
  const { branch: requestBranch } = req.body ?? {};

  const [webhook] = await db
    .select()
    .from(deployWebhooksTable)
    .where(and(eq(deployWebhooksTable.projectId, projectId), eq(deployWebhooksTable.secret, secret)));

  if (!webhook) {
    res.status(404).json({ error: "Invalid webhook" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db
    .update(deployWebhooksTable)
    .set({ lastTriggeredAt: new Date() })
    .where(eq(deployWebhooksTable.id, webhook.id));

  const branch = requestBranch || project.repoBranch || "main";

  const rules = await db
    .select()
    .from(buildRulesTable)
    .where(eq(buildRulesTable.projectId, projectId));

  const matchingRule = rules.find(r => matchBranchPattern(r.branchPattern, branch));

  if (matchingRule && !matchingRule.autoDeploy) {
    res.status(200).json({ message: "Auto-deploy is disabled for this branch pattern. Deployment skipped." });
    return;
  }

  const deployEnvironment = matchingRule?.environment || "production";

  const [deployment] = await db
    .insert(deploymentsTable)
    .values({
      projectId,
      status: "pending",
      environment: deployEnvironment,
      triggerType: "webhook",
      executionMode: determineExecutionMode(project),
      simulated: determineExecutionMode(project) === "simulated",
      branch,
      commitMessage: "Deploy triggered via webhook",
    })
    .returning();

  enqueueJob(db, {
    type: "build_requested",
    payload: { deploymentId: deployment.id },
  }).catch(console.error);

  res.status(201).json({ deployment });
});

export default router;
