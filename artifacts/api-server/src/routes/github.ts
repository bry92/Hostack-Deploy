import crypto from "crypto";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, deploymentsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { determineExecutionMode, startDeploymentExecution } from "../services/deploymentExecutor.js";
import { APP_URL } from "../lib/auth.js";
import { decryptString, encryptString } from "../lib/secrets.js";

const router: IRouter = Router();

function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl.replace(/\.git$/, ""));
    if (!url.hostname.includes("github.com")) return null;
    const parts = url.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

function getGitHubWebhookUrl(): string {
  return `${APP_URL}/api/github/webhook`;
}

function getWebhookInfo(projectId: string, encryptedSecret: string | null) {
  const decryptedSecret = decryptString(encryptedSecret) ?? null;

  return {
    webhookUrl: getGitHubWebhookUrl(),
    projectId,
    hasWebhookSecret: !!decryptedSecret,
    webhookSecretLastFour: decryptedSecret ? decryptedSecret.slice(-4) : undefined,
  };
}

router.get("/projects/:projectId/github", async (req, res) => {
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

  res.json({
    connected: !!project.githubToken,
    repoUrl: project.repoUrl,
    repoBranch: project.repoBranch,
    autoDeploy: project.autoDeploy,
  });
});

router.post("/projects/:projectId/github", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;
  const { githubToken } = req.body;

  if (!githubToken) {
    res.status(400).json({ error: "githubToken is required" });
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

  const [updated] = await db
    .update(projectsTable)
    .set({ githubToken: encryptString(githubToken) })
    .where(eq(projectsTable.id, projectId))
    .returning();

  res.json({
    connected: true,
    repoUrl: updated.repoUrl,
    repoBranch: updated.repoBranch,
    autoDeploy: updated.autoDeploy,
  });
});

router.delete("/projects/:projectId/github", async (req, res) => {
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

  await db
    .update(projectsTable)
    .set({ githubToken: null })
    .where(eq(projectsTable.id, projectId));

  res.json({ connected: false });
});

router.get("/projects/:projectId/webhook", async (req, res) => {
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

  res.json(getWebhookInfo(projectId, project.webhookSecret));
});

router.post("/projects/:projectId/webhook/regenerate", async (req, res) => {
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

  const secret = generateWebhookSecret();
  const encryptedSecret = encryptString(secret)!;
  await db
    .update(projectsTable)
    .set({ webhookSecret: encryptedSecret })
    .where(eq(projectsTable.id, projectId));

  res.json({
    ...getWebhookInfo(projectId, encryptedSecret),
    webhookSecret: secret,
  });
});

router.post(
  "/github/webhook",
  (req, res, next) => {
    let rawBody = Buffer.alloc(0);
    req.on("data", (chunk: Buffer) => {
      rawBody = Buffer.concat([rawBody, chunk]);
    });
    req.on("end", () => {
      (req as any).rawBody = rawBody;
      next();
    });
  },
  async (req, res) => {
    const event = req.headers["x-github-event"] as string;
    const sig256 = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody: Buffer = (req as any).rawBody || Buffer.alloc(0);

    res.json({ received: true });

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      return;
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) return;

    const [webhookOwner, webhookRepo] = repoFullName.split("/");

    const projects = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.repoOwner, webhookOwner),
          eq(projectsTable.repoName, webhookRepo),
        ),
      );

    function verifySignature(project: typeof projects[number]): boolean {
      const secret = decryptString(project.webhookSecret);
      if (!secret) {
        console.warn(`Webhook secret not configured for project ${project.id}`);
        return false;
      }
      if (!sig256) {
        console.warn(`Webhook missing signature for project ${project.id}`);
        return false;
      }
      const expected =
        "sha256=" +
        crypto
          .createHmac("sha256", secret)
          .update(rawBody)
          .digest("hex");
      if (sig256 !== expected) {
        console.warn(`Webhook signature mismatch for project ${project.id}`);
        return false;
      }
      return true;
    }

    if (event === "push") {
      const ref = payload.ref || "";
      if (!ref.startsWith("refs/heads/")) return;
      const branch = ref.replace("refs/heads/", "");
      const commitSha = payload.head_commit?.id || payload.after || "";
      const commitMessage =
        payload.head_commit?.message?.split("\n")[0] ||
        payload.commits?.[0]?.message?.split("\n")[0] ||
        "Push via GitHub webhook";

      for (const project of projects) {
        if (!project.autoDeploy) continue;
        if (!verifySignature(project)) continue;

        const productionBranch = project.repoBranch || "main";
        const environment = branch === productionBranch ? "production" : "preview";

        const [deployment] = await db
          .insert(deploymentsTable)
          .values({
            projectId: project.id,
            status: "queued",
            environment,
            triggerType: "webhook",
            executionMode: determineExecutionMode(project),
            simulated: determineExecutionMode(project) === "simulated",
            branch,
            commitHash: commitSha,
            commitMessage,
          })
          .returning();

        startDeploymentExecution(deployment.id).catch(console.error);
      }
    } else if (event === "pull_request") {
      const action = payload.action;
      if (action !== "opened" && action !== "synchronize" && action !== "reopened") return;

      const prNumber = payload.number;
      const headBranch = payload.pull_request?.head?.ref || "";
      const headSha = payload.pull_request?.head?.sha || "";
      const prTitle = payload.pull_request?.title?.split("\n")[0] || "PR deploy via GitHub webhook";

      for (const project of projects) {
        if (!project.autoDeploy) continue;
        if (!verifySignature(project)) continue;

        const [deployment] = await db
          .insert(deploymentsTable)
          .values({
            projectId: project.id,
            status: "queued",
            environment: "preview",
            triggerType: "webhook",
            executionMode: determineExecutionMode(project),
            simulated: determineExecutionMode(project) === "simulated",
            branch: headBranch,
            commitHash: headSha,
            commitMessage: prTitle,
            prNumber,
          })
          .returning();

        startDeploymentExecution(deployment.id).catch(console.error);
      }
    }
  },
);

export default router;
