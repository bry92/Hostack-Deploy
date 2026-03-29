import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { deploymentsTable, deploymentLogsTable, projectsTable } from "@workspace/db/schema";
import { enqueueJob } from "@workspace/queue";
import { eq, and, desc, asc } from "drizzle-orm";
import { determineExecutionMode } from "../services/deploymentExecutor.js";
import {
  getRuntimePort,
  promoteArtifactToDeployment,
  proxyRuntimeRequest,
  resolveActiveDeployment,
  serveStaticArtifact,
} from "../services/deploymentRuntime.js";

const router: IRouter = Router();

const TERMINAL_STATUSES = new Set(["ready", "failed"]);
const getWildcardPath = (
  req: { params: Record<string, string | string[]> },
  key: string,
) => {
  const wildcard = req.params[key];
  if (Array.isArray(wildcard)) {
    return wildcard.join("/");
  }
  return wildcard ?? "";
};

router.all("/deployments/:deploymentId/artifact/*artifactPath", async (req, res) => {
  await serveStaticArtifact(req.params.deploymentId, getWildcardPath(req, "artifactPath"), res);
});

router.all("/deployments/:deploymentId/artifact", async (req, res) => {
  await serveStaticArtifact(req.params.deploymentId, "", res);
});

router.all("/deployments/:deploymentId/runtime/*runtimePath", async (req, res) => {
  const runtimePort = await getRuntimePort(req.params.deploymentId);
  if (!runtimePort) {
    res.status(404).send("Runtime not found");
    return;
  }
  req.url = `/${getWildcardPath(req, "runtimePath")}`;
  proxyRuntimeRequest(runtimePort, req, res);
});

router.all("/deployments/:deploymentId/runtime", async (req, res) => {
  const runtimePort = await getRuntimePort(req.params.deploymentId);
  if (!runtimePort) {
    res.status(404).send("Runtime not found");
    return;
  }
  req.url = "/";
  proxyRuntimeRequest(runtimePort, req, res);
});

router.all("/projects/:projectId/environments/:environment/*environmentPath", async (req, res) => {
  const deployment = await resolveActiveDeployment(req.params.projectId, req.params.environment);
  if (!deployment) {
    res.status(404).send("Active deployment not found");
    return;
  }

  if (deployment.runtimeKind === "node-api") {
    const runtimePort = await getRuntimePort(deployment.id);
    if (!runtimePort) {
      res.status(404).send("Runtime not found");
      return;
    }
    req.url = `/${getWildcardPath(req, "environmentPath")}`;
    proxyRuntimeRequest(runtimePort, req, res);
    return;
  }

  await serveStaticArtifact(deployment.id, getWildcardPath(req, "environmentPath"), res);
});

router.all("/projects/:projectId/environments/:environment", async (req, res) => {
  const deployment = await resolveActiveDeployment(req.params.projectId, req.params.environment);
  if (!deployment) {
    res.status(404).send("Active deployment not found");
    return;
  }

  if (deployment.runtimeKind === "node-api") {
    const runtimePort = await getRuntimePort(deployment.id);
    if (!runtimePort) {
      res.status(404).send("Runtime not found");
      return;
    }
    req.url = "/";
    proxyRuntimeRequest(runtimePort, req, res);
    return;
  }

  await serveStaticArtifact(deployment.id, "", res);
});

router.get("/deployments", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;

  const userProjects = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));

  const projectIds = userProjects.map((p) => p.id);

  if (projectIds.length === 0) {
    res.json({ deployments: [] });
    return;
  }

  const deploymentsWithProjects = await db
    .select({
      id: deploymentsTable.id,
      projectId: deploymentsTable.projectId,
      projectName: projectsTable.name,
      status: deploymentsTable.status,
      environment: deploymentsTable.environment,
      triggerType: deploymentsTable.triggerType,
      branch: deploymentsTable.branch,
      commitMessage: deploymentsTable.commitMessage,
      commitHash: deploymentsTable.commitHash,
      deploymentUrl: deploymentsTable.deploymentUrl,
      outputDirectory: deploymentsTable.outputDirectory,
      executionMode: deploymentsTable.executionMode,
      runtimeKind: deploymentsTable.runtimeKind,
      artifactPath: deploymentsTable.artifactPath,
      failureReason: deploymentsTable.failureReason,
      simulated: deploymentsTable.simulated,
      activeEnvironment: deploymentsTable.activeEnvironment,
      isCurrent: deploymentsTable.isCurrent,
      createdAt: deploymentsTable.createdAt,
      startedAt: deploymentsTable.startedAt,
      completedAt: deploymentsTable.completedAt,
      durationSeconds: deploymentsTable.durationSeconds,
      prNumber: deploymentsTable.prNumber,
    })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(100);

  res.json({ deployments: deploymentsWithProjects });
});

router.get("/projects/:projectId/deployments", async (req, res) => {
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

  const deployments = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.projectId, projectId))
    .orderBy(desc(deploymentsTable.createdAt));

  res.json({
    deployments: deployments.map((d) => ({
      ...d,
      projectName: project.name,
    })),
  });
});

router.post("/projects/:projectId/deployments", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;
  const { environment = "production" } = req.body ?? {};

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [deployment] = await db
    .insert(deploymentsTable)
    .values({
      projectId,
      status: "pending",
      environment,
      triggerType: "manual",
      executionMode: determineExecutionMode(project),
      simulated: determineExecutionMode(project) === "simulated",
      branch: project.repoBranch || "main",
      commitMessage: "Deploy via Hostack dashboard",
    })
    .returning();

  enqueueJob(db, {
    type: "build_requested",
    payload: { deploymentId: deployment.id },
  }).catch(console.error);

  res.status(201).json({ ...deployment, projectName: project.name });
});

router.get("/deployments/:deploymentId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { deploymentId } = req.params;

  const [result] = await db
    .select({
      id: deploymentsTable.id,
      projectId: deploymentsTable.projectId,
      projectName: projectsTable.name,
      status: deploymentsTable.status,
      environment: deploymentsTable.environment,
      triggerType: deploymentsTable.triggerType,
      branch: deploymentsTable.branch,
      commitMessage: deploymentsTable.commitMessage,
      commitHash: deploymentsTable.commitHash,
      deploymentUrl: deploymentsTable.deploymentUrl,
      outputDirectory: deploymentsTable.outputDirectory,
      executionMode: deploymentsTable.executionMode,
      runtimeKind: deploymentsTable.runtimeKind,
      artifactPath: deploymentsTable.artifactPath,
      failureReason: deploymentsTable.failureReason,
      simulated: deploymentsTable.simulated,
      activeEnvironment: deploymentsTable.activeEnvironment,
      isCurrent: deploymentsTable.isCurrent,
      createdAt: deploymentsTable.createdAt,
      startedAt: deploymentsTable.startedAt,
      completedAt: deploymentsTable.completedAt,
      durationSeconds: deploymentsTable.durationSeconds,
      prNumber: deploymentsTable.prNumber,
    })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
    .where(
      and(eq(deploymentsTable.id, deploymentId), eq(projectsTable.userId, userId))
    );

  if (!result) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  res.json(result);
});

router.post("/deployments/:deploymentId/promote", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { deploymentId } = req.params;

  const [source] = await db
    .select({
      id: deploymentsTable.id,
      projectId: deploymentsTable.projectId,
      commitHash: deploymentsTable.commitHash,
      commitMessage: deploymentsTable.commitMessage,
      branch: deploymentsTable.branch,
      environment: deploymentsTable.environment,
      status: deploymentsTable.status,
      executionMode: deploymentsTable.executionMode,
      artifactPath: deploymentsTable.artifactPath,
      runtimeKind: deploymentsTable.runtimeKind,
    })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
    .where(
      and(eq(deploymentsTable.id, deploymentId), eq(projectsTable.userId, userId))
    );

  if (!source) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  if (source.environment !== "preview") {
    res.status(400).json({ error: "Only preview deployments can be promoted" });
    return;
  }

  if (source.status !== "ready") {
    res.status(400).json({ error: "Only ready deployments can be promoted" });
    return;
  }

  const [promoted] = await db
    .insert(deploymentsTable)
    .values({
      projectId: source.projectId,
      status: "pending",
      environment: "production",
      triggerType: "manual",
      executionMode: source.executionMode === "simulated" ? "simulated" : "real",
      simulated: source.executionMode === "simulated",
      sourceDeploymentId: source.id,
      branch: source.branch,
      commitHash: source.commitHash,
      commitMessage: source.commitMessage,
    })
    .returning();

  const [project] = await db
    .select({ name: projectsTable.name })
    .from(projectsTable)
    .where(eq(projectsTable.id, source.projectId));

  if (source.executionMode === "real" && source.artifactPath && source.runtimeKind) {
    promoteArtifactToDeployment({
      deploymentId: promoted.id,
      sourceDeploymentId: source.id,
      projectId: source.projectId,
      environment: "production",
      branch: source.branch,
    }).catch(console.error);
  } else {
    enqueueJob(db, {
      type: "build_requested",
      payload: { deploymentId: promoted.id },
    }).catch(console.error);
  }

  res.status(201).json({ ...promoted, projectName: project?.name || null });
});

router.post("/projects/:projectId/deployments/:deploymentId/rollback", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId, deploymentId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [target] = await db
    .select()
    .from(deploymentsTable)
    .where(
      and(
        eq(deploymentsTable.id, deploymentId),
        eq(deploymentsTable.projectId, projectId),
      )
    );

  if (!target) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  if (target.status !== "deployed" && target.status !== "ready") {
    res.status(400).json({ error: "Can only roll back to a successful deployment" });
    return;
  }

  if (target.environment !== "production") {
    res.status(400).json({ error: "Can only roll back production deployments" });
    return;
  }

  const [rollback] = await db
    .insert(deploymentsTable)
    .values({
      projectId,
      status: "pending",
      environment: "production",
      triggerType: "rollback",
      executionMode: target.executionMode === "simulated" ? "simulated" : "real",
      simulated: target.executionMode === "simulated",
      sourceDeploymentId: target.id,
      branch: target.branch || "main",
      commitHash: target.commitHash,
      commitMessage: target.commitMessage ? `Rollback: ${target.commitMessage}`.slice(0, 500) : "Rollback to previous deployment",
    })
    .returning();

  if (target.executionMode === "real" && target.artifactPath && target.runtimeKind) {
    promoteArtifactToDeployment({
      deploymentId: rollback.id,
      sourceDeploymentId: target.id,
      projectId,
      environment: "production",
      branch: target.branch,
    }).catch(console.error);
  } else {
    enqueueJob(db, {
      type: "rollback_requested",
      payload: {
        deploymentId: rollback.id,
        sourceDeploymentId: target.id,
      },
    }).catch(console.error);
  }

  res.status(201).json({ ...rollback, projectName: project.name });
});

router.get("/deployments/:deploymentId/logs", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { deploymentId } = req.params;

  const [deployment] = await db
    .select({ id: deploymentsTable.id, projectId: deploymentsTable.projectId })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
    .where(
      and(eq(deploymentsTable.id, deploymentId), eq(projectsTable.userId, userId))
    );

  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  const logs = await db
    .select()
    .from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(asc(deploymentLogsTable.stepOrder), asc(deploymentLogsTable.createdAt));

  res.json({ logs });
});

router.get("/deployments/:deploymentId/stream", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { deploymentId } = req.params;

  const [deployment] = await db
    .select({ id: deploymentsTable.id, status: deploymentsTable.status })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
    .where(
      and(eq(deploymentsTable.id, deploymentId), eq(projectsTable.userId, userId))
    );

  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === "function") (res as any).flush();
    } catch {
      // Client disconnected
    }
  };

  send({ type: "connected" });

  let sentCount = 0;
  let closed = false;

  req.on("close", () => { closed = true; });

  const poll = async () => {
    if (closed) return;

    try {
      const logs = await db
        .select()
        .from(deploymentLogsTable)
        .where(eq(deploymentLogsTable.deploymentId, deploymentId))
        .orderBy(asc(deploymentLogsTable.stepOrder), asc(deploymentLogsTable.createdAt));

      const newLogs = logs.slice(sentCount);
      for (const log of newLogs) {
        send({ type: "log", data: log });
      }
      sentCount = logs.length;

      const [current] = await db
        .select({ status: deploymentsTable.status })
        .from(deploymentsTable)
        .where(eq(deploymentsTable.id, deploymentId));

      if (current) {
        send({ type: "status", status: current.status });

        if (TERMINAL_STATUSES.has(current.status)) {
          send({ type: "done", status: current.status });
          res.end();
          return;
        }
      }

      if (!closed) {
        setTimeout(poll, 1000);
      }
    } catch {
      res.end();
    }
  };

  const heartbeat = setInterval(() => {
    if (closed) {
      clearInterval(heartbeat);
      return;
    }
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
  });

  await poll();
});

export default router;
