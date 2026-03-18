import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { runtimeLogsTable, deploymentMetricsTable, projectsTable, deploymentsTable } from "@workspace/db/schema";
import { eq, and, desc, gte, sql, ilike, or } from "drizzle-orm";

const router: IRouter = Router();

const LOG_LEVELS = ["info", "warn", "error", "debug", "success"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

function assertAuth(req: any, res: any): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.user.id as string;
}

async function assertProjectOwner(projectId: string, userId: string, res: any): Promise<boolean> {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return false;
  }
  return true;
}

router.get("/projects/:projectId/runtime-logs", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  const { level, search, deploymentId, limit = "200" } = req.query as Record<string, string>;

  let query = db
    .select()
    .from(runtimeLogsTable)
    .where(
      and(
        eq(runtimeLogsTable.projectId, projectId),
        level ? eq(runtimeLogsTable.level, level) : undefined,
        deploymentId ? eq(runtimeLogsTable.deploymentId, deploymentId) : undefined,
        search ? ilike(runtimeLogsTable.message, `%${search}%`) : undefined,
      )
    )
    .$dynamic();

  const rows = await query.orderBy(desc(runtimeLogsTable.createdAt)).limit(Math.min(parseInt(limit) || 200, 1000));
  res.json({ logs: rows.reverse() });
});

router.get("/projects/:projectId/runtime-logs/stream", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let lastId: string | null = null;

  const poll = async () => {
    try {
      const rows = await db
        .select()
        .from(runtimeLogsTable)
        .where(
          and(
            eq(runtimeLogsTable.projectId, projectId),
            lastId ? sql`${runtimeLogsTable.createdAt} > (SELECT created_at FROM runtime_logs WHERE id = ${lastId})` : undefined,
          )
        )
        .orderBy(runtimeLogsTable.createdAt)
        .limit(50);

      for (const row of rows) {
        res.write(`data: ${JSON.stringify({ type: "log", data: row })}\n\n`);
        lastId = row.id;
      }
    } catch {
      // ignore poll errors
    }
  };

  await poll();
  const interval = setInterval(poll, 2000);

  const keepalive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(interval);
    clearInterval(keepalive);
  });
});

router.post("/projects/:projectId/runtime-logs", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  const { level = "info", message, source = "app", deploymentId } = req.body;

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const [row] = await db
    .insert(runtimeLogsTable)
    .values({ projectId, deploymentId: deploymentId || null, level, message, source })
    .returning();

  res.status(201).json(row);
});

router.delete("/projects/:projectId/runtime-logs", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  await db.delete(runtimeLogsTable).where(eq(runtimeLogsTable.projectId, projectId));
  res.json({ success: true });
});

const LOG_TEMPLATES: Array<{ level: LogLevel; message: string; source: string }> = [
  { level: "info", message: "GET /api/auth 200 (12ms)", source: "http" },
  { level: "info", message: "POST /api/login 200 (45ms)", source: "http" },
  { level: "info", message: "GET /dashboard 200 (8ms)", source: "http" },
  { level: "info", message: "GET /api/projects 200 (23ms)", source: "http" },
  { level: "info", message: "Static asset served: /assets/index-BHd8uGKv.js (gzip: 142kb)", source: "cdn" },
  { level: "info", message: "Database connection pool: 3/10 active", source: "db" },
  { level: "warn", message: "Response time exceeded 500ms: GET /api/reports (623ms)", source: "http" },
  { level: "warn", message: "Cache miss rate high: 68% (threshold: 50%)", source: "cache" },
  { level: "info", message: "Worker thread spawned for background job: email-queue", source: "worker" },
  { level: "info", message: "GET /api/users/profile 200 (15ms)", source: "http" },
  { level: "info", message: "WebSocket connection established: client-9f2a", source: "ws" },
  { level: "error", message: "Database connection timeout after 5000ms", source: "db" },
  { level: "info", message: "Cron job executed: cleanup-expired-sessions (found 12 sessions)", source: "cron" },
  { level: "info", message: "GET /api/analytics/events 200 (31ms)", source: "http" },
  { level: "warn", message: "Memory usage at 72% (threshold: 80%)", source: "runtime" },
  { level: "info", message: "POST /api/webhooks/github 200 (5ms)", source: "http" },
  { level: "info", message: "Cache warmed for: /api/products (1024 entries)", source: "cache" },
  { level: "error", message: "Unhandled promise rejection: Cannot read property 'id' of undefined", source: "app" },
  { level: "info", message: "Rate limit check: 127.0.0.1 — 42/100 requests", source: "ratelimit" },
  { level: "info", message: "Health check passed: db=OK, cache=OK, queue=OK", source: "health" },
];

router.post("/projects/:projectId/runtime-logs/simulate", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  const { deploymentId, count = 25 } = req.body;

  const [latestDeployment] = deploymentId ? [] : await db
    .select({ id: deploymentsTable.id })
    .from(deploymentsTable)
    .where(and(eq(deploymentsTable.projectId, projectId)))
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(1);

  const dId = deploymentId || latestDeployment?.id || null;

  const logCount = Math.min(parseInt(String(count)) || 25, 100);
  const now = Date.now();
  const entries = [];

  for (let i = 0; i < logCount; i++) {
    const tmpl = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)];
    const ageMs = (logCount - i) * Math.floor(Math.random() * 3000 + 500);
    entries.push({
      projectId,
      deploymentId: dId,
      level: tmpl.level,
      message: tmpl.message,
      source: tmpl.source,
      createdAt: new Date(now - ageMs),
    });
  }

  const rows = await db.insert(runtimeLogsTable).values(entries).returning();
  res.json({ created: rows.length, logs: rows });
});

router.get("/projects/:projectId/metrics/summary", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  const { deploymentId } = req.query as Record<string, string>;

  const whereClause = and(
    eq(deploymentMetricsTable.projectId, projectId),
    deploymentId ? eq(deploymentMetricsTable.deploymentId, deploymentId) : undefined,
  );

  const allMetrics = await db
    .select()
    .from(deploymentMetricsTable)
    .where(whereClause)
    .orderBy(desc(deploymentMetricsTable.recordedAt))
    .limit(500);

  const latest: Record<string, number> = {};
  for (const m of allMetrics) {
    if (!(m.metricName in latest)) {
      latest[m.metricName] = parseFloat(m.metricValue as string);
    }
  }

  const requestsPerMin = latest["requests_per_min"] ?? null;
  const errorRate = latest["error_rate"] ?? null;
  const p95Latency = latest["p95_latency_ms"] ?? null;
  const bandwidth = latest["bandwidth_kb"] ?? null;
  const activeSessions = latest["active_sessions"] ?? null;
  const coldStarts = latest["cold_starts"] ?? null;
  const uptime = latest["uptime_pct"] ?? null;

  let healthStatus: "healthy" | "warning" | "degraded" | "critical" = "healthy";
  if (errorRate !== null) {
    if (errorRate > 10) healthStatus = "critical";
    else if (errorRate > 5) healthStatus = "degraded";
    else if (errorRate > 1) healthStatus = "warning";
  }

  const errorLogs = await db
    .select({ id: runtimeLogsTable.id })
    .from(runtimeLogsTable)
    .where(and(eq(runtimeLogsTable.projectId, projectId), eq(runtimeLogsTable.level, "error")))
    .limit(1);

  if (errorLogs.length > 0 && healthStatus === "healthy") {
    healthStatus = "warning";
  }

  res.json({
    requestsPerMin,
    errorRate,
    p95LatencyMs: p95Latency,
    bandwidthKb: bandwidth,
    activeSessions,
    coldStarts,
    uptimePct: uptime,
    healthStatus,
    hasData: allMetrics.length > 0,
  });
});

router.get("/projects/:projectId/metrics", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  const { deploymentId, metricName, limit = "100" } = req.query as Record<string, string>;

  const rows = await db
    .select()
    .from(deploymentMetricsTable)
    .where(and(
      eq(deploymentMetricsTable.projectId, projectId),
      deploymentId ? eq(deploymentMetricsTable.deploymentId, deploymentId) : undefined,
      metricName ? eq(deploymentMetricsTable.metricName, metricName) : undefined,
    ))
    .orderBy(desc(deploymentMetricsTable.recordedAt))
    .limit(Math.min(parseInt(limit) || 100, 500));

  res.json({ metrics: rows });
});

router.post("/projects/:projectId/metrics/simulate", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  const { deploymentId } = req.body;

  const [latestDeployment] = deploymentId ? [] : await db
    .select({ id: deploymentsTable.id })
    .from(deploymentsTable)
    .where(eq(deploymentsTable.projectId, projectId))
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(1);

  const dId = deploymentId || latestDeployment?.id || null;
  const now = new Date();

  const metricPoints = [
    { metricName: "requests_per_min", metricValue: (300 + Math.random() * 200).toFixed(1) },
    { metricName: "error_rate", metricValue: (Math.random() * 2).toFixed(2) },
    { metricName: "p95_latency_ms", metricValue: (150 + Math.random() * 200).toFixed(0) },
    { metricName: "bandwidth_kb", metricValue: (500 + Math.random() * 1000).toFixed(0) },
    { metricName: "active_sessions", metricValue: (20 + Math.floor(Math.random() * 50)).toString() },
    { metricName: "cold_starts", metricValue: Math.floor(Math.random() * 5).toString() },
    { metricName: "uptime_pct", metricValue: (99 + Math.random()).toFixed(2) },
  ];

  const rows = await db
    .insert(deploymentMetricsTable)
    .values(metricPoints.map(m => ({
      projectId,
      deploymentId: dId,
      metricName: m.metricName,
      metricValue: m.metricValue,
      recordedAt: now,
    })))
    .returning();

  res.json({ created: rows.length, metrics: rows });
});

router.get("/projects/:projectId/health", async (req, res) => {
  const userId = assertAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  if (!(await assertProjectOwner(projectId, userId, res))) return;

  const [latestDeploy] = await db
    .select()
    .from(deploymentsTable)
    .where(and(
      eq(deploymentsTable.projectId, projectId),
      or(eq(deploymentsTable.status, "ready"), eq(deploymentsTable.status, "deployed"))
    ))
    .orderBy(desc(deploymentsTable.completedAt))
    .limit(1);

  const recentErrors = await db
    .select({ id: runtimeLogsTable.id })
    .from(runtimeLogsTable)
    .where(and(
      eq(runtimeLogsTable.projectId, projectId),
      eq(runtimeLogsTable.level, "error"),
      gte(runtimeLogsTable.createdAt, new Date(Date.now() - 60 * 60 * 1000))
    ))
    .limit(10);

  const latestMetric = await db
    .select()
    .from(deploymentMetricsTable)
    .where(and(
      eq(deploymentMetricsTable.projectId, projectId),
      eq(deploymentMetricsTable.metricName, "error_rate")
    ))
    .orderBy(desc(deploymentMetricsTable.recordedAt))
    .limit(1);

  let healthStatus: "healthy" | "warning" | "degraded" | "critical" | "unknown" = "unknown";

  if (!latestDeploy) {
    healthStatus = "unknown";
  } else if (latestMetric.length > 0) {
    const errorRate = parseFloat(latestMetric[0].metricValue as string);
    if (errorRate > 10) healthStatus = "critical";
    else if (errorRate > 5) healthStatus = "degraded";
    else if (errorRate > 1 || recentErrors.length > 3) healthStatus = "warning";
    else healthStatus = "healthy";
  } else if (recentErrors.length > 5) {
    healthStatus = "warning";
  } else if (latestDeploy) {
    healthStatus = "healthy";
  }

  res.json({
    healthStatus,
    recentErrorCount: recentErrors.length,
    latestDeploymentId: latestDeploy?.id || null,
    latestDeploymentAt: latestDeploy?.completedAt || null,
  });
});

export default router;
