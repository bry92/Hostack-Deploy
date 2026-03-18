import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  projectsTable,
  deploymentsTable,
  runtimeLogsTable,
  deploymentMetricsTable,
  environmentVariablesTable,
} from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";

const router: IRouter = Router();

function getOpenAIClient(): OpenAI | null {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

async function buildProjectContext(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) return null;

  const recentDeployments = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.projectId, projectId))
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(5);

  const errorLogs = await db
    .select()
    .from(runtimeLogsTable)
    .where(
      and(
        eq(runtimeLogsTable.projectId, projectId),
        eq(runtimeLogsTable.level, "error"),
      ),
    )
    .orderBy(desc(runtimeLogsTable.createdAt))
    .limit(20);

  const allMetrics = await db
    .select()
    .from(deploymentMetricsTable)
    .where(eq(deploymentMetricsTable.projectId, projectId))
    .orderBy(desc(deploymentMetricsTable.recordedAt))
    .limit(100);

  const latest: Record<string, number> = {};
  for (const m of allMetrics) {
    if (!(m.metricName in latest)) {
      latest[m.metricName] = parseFloat(m.metricValue as string);
    }
  }

  const envVarKeys = await db
    .select({ key: environmentVariablesTable.key, environment: environmentVariablesTable.environment })
    .from(environmentVariablesTable)
    .where(eq(environmentVariablesTable.projectId, projectId));

  const recentErrors = await db
    .select({ id: runtimeLogsTable.id })
    .from(runtimeLogsTable)
    .where(
      and(
        eq(runtimeLogsTable.projectId, projectId),
        eq(runtimeLogsTable.level, "error"),
        gte(runtimeLogsTable.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    )
    .limit(10);

  let healthStatus = "unknown";
  const errorRate = latest["error_rate"];
  if (errorRate !== undefined) {
    if (errorRate > 10) healthStatus = "critical";
    else if (errorRate > 5) healthStatus = "degraded";
    else if (errorRate > 1 || recentErrors.length > 3) healthStatus = "warning";
    else healthStatus = "healthy";
  } else if (recentDeployments.some(d => d.status === "deployed" || d.status === "ready")) {
    healthStatus = recentErrors.length > 5 ? "warning" : "healthy";
  }

  const deploymentsContext = recentDeployments
    .map(
      (d) =>
        `- ${d.status} | ${d.environment} | trigger: ${d.triggerType} | ${d.branch || "main"} | ${d.commitHash?.slice(0, 8) || "no-hash"} | ${d.commitMessage || "no message"} | duration: ${d.durationSeconds ?? "?"}s | ${d.createdAt}`,
    )
    .join("\n");

  const errorLogsContext = errorLogs.length > 0
    ? errorLogs.map((l) => `- [${l.createdAt}] ${l.source}: ${l.message}`).join("\n")
    : "No recent error logs.";

  const metricsContext = Object.keys(latest).length > 0
    ? Object.entries(latest)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "No metrics data available.";

  const envVarsContext = envVarKeys.length > 0
    ? envVarKeys.map((e) => `- ${e.key} (${e.environment})`).join("\n")
    : "No environment variables configured.";

  return {
    project,
    systemPrompt: `You are the AI Deploy Copilot for Hostack, a developer hosting and deployment platform similar to Vercel/Netlify. You assist developers by analyzing their project's deployment data, logs, metrics, and configuration.

You have access to real data for this project. Answer questions specifically based on this data. Be concise, actionable, and technical. Use markdown formatting.

## Project Info
- Name: ${project.name}
- Framework: ${project.framework}
- Repository: ${project.repoUrl || "Not connected"}
- Branch: ${project.repoBranch || "main"}
- Build command: ${project.buildCommand || "default"}
- Install command: ${project.installCommand || "default"}
- Root directory: ${project.rootDirectory || "/"}

## Last 5 Deployments
${deploymentsContext || "No deployments yet."}

## Recent Error Logs (last 20)
${errorLogsContext}

## Current Metrics
${metricsContext}

## Health Status: ${healthStatus}

## Environment Variable Keys (values hidden for security)
${envVarsContext}

Guidelines:
- Always reference actual data from above when answering
- If a deploy failed, look at the error logs and deployment status for clues
- For latency questions, reference p95_latency_ms and requests_per_min
- For health questions, reference the health status and error_rate
- Suggest specific, actionable fixes — not generic advice
- If data is missing, say so honestly and suggest how to generate it (e.g., "Run a simulation to populate metrics")
- Never reveal environment variable values — only reference keys
- Keep responses focused and under 300 words unless the user asks for detail`,
  };
}

router.post("/projects/:projectId/copilot/chat", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user!.id as string;
  const { projectId } = req.params;
  const { message, history } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  if (message.length > 2000) {
    res.status(400).json({ error: "Message too long (max 2000 characters)" });
    return;
  }

  if (history && Array.isArray(history) && history.length > 20) {
    res.status(400).json({ error: "History too long (max 20 messages)" });
    return;
  }

  const context = await buildProjectContext(projectId, userId);
  if (!context) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const openai = getOpenAIClient();
  if (!openai) {
    res.status(503).json({ error: "Copilot is unavailable until OPENAI_API_KEY is configured" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: context.systemPrompt },
    ];

    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        if (h.role === "user" || h.role === "assistant") {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }

    messages.push({ role: "user", content: message });

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const error = err instanceof Error ? err.message : "AI request failed";
    res.write(`data: ${JSON.stringify({ error })}\n\n`);
    res.end();
  }
});

export default router;
