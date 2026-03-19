import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { integrationsTable, projectIntegrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptMetadata, encryptMetadata } from "../lib/secrets.js";
import { APP_URL, COOKIE_SECURE } from "../lib/auth.js";

const router: IRouter = Router();
const GITHUB_OAUTH_COOKIE = "github_oauth_state";
const GITHUB_OAUTH_TTL = 10 * 60 * 1000;
const GITHUB_CALLBACK_PATH = "/api/integrations/github/callback";

function getGitHubClientId(): string | null {
  return process.env.GITHUB_CLIENT_ID?.trim() || null;
}

function getGitHubClientSecret(): string | null {
  return process.env.GITHUB_CLIENT_SECRET?.trim() || null;
}

function setGithubOauthCookie(res: Response, value: string) {
  res.cookie(GITHUB_OAUTH_COOKIE, value, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: GITHUB_OAUTH_TTL,
  });
}

function clearGithubOauthCookie(res: Response) {
  res.clearCookie(GITHUB_OAUTH_COOKIE, { path: "/" });
}

function redirectToIntegrations(res: Response, error?: string) {
  const target = new URL("/integrations", `${APP_URL}/`);
  if (error) {
    target.searchParams.set("github_error", error);
  }
  res.redirect(target.href);
}

async function fetchGitHubUserLogin(accessToken: string): Promise<string | null> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Hostack",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as Record<string, unknown>;
  return typeof payload.login === "string" ? payload.login : null;
}

async function upsertGitHubIntegration(userId: string, accessToken: string, accountLogin: string | null) {
  const accountLabel = accountLogin ?? "GitHub";
  const metadata = encryptMetadata({
    accessToken,
    ...(accountLogin ? { accountLogin } : {}),
  });

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, "github")));

  if (existing) {
    const [updated] = await db
      .update(integrationsTable)
      .set({
        accountLabel,
        metadata,
        status: "connected",
        updatedAt: new Date(),
      })
      .where(eq(integrationsTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(integrationsTable)
    .values({
      userId,
      provider: "github",
      accountLabel,
      metadata,
      status: "connected",
    })
    .returning();

  return created;
}

function safeMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> {
  if (!metadata) return {};
  const sensitive = ["token", "secret", "key", "password", "apiKey", "accessKeyId", "secretAccessKey", "webhookUrl"];
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const isSecret = sensitive.some(s => k.toLowerCase().includes(s.toLowerCase()));
    result[k] = isSecret ? (v ? "••••••••" : null) : v;
  }
  return result;
}

function formatIntegration(row: typeof integrationsTable.$inferSelect) {
  const metadata = decryptMetadata(row.metadata as Record<string, unknown> | null);
  return {
    id: row.id,
    provider: row.provider,
    accountLabel: row.accountLabel,
    status: row.status,
    metadata: safeMetadata(metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/integrations/github/connect", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.redirect("/api/login?returnTo=/integrations");
    return;
  }

  const clientId = getGitHubClientId();
  if (!clientId || !getGitHubClientSecret()) {
    redirectToIntegrations(res, "github_oauth_not_configured");
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  setGithubOauthCookie(res, state);

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${APP_URL}${GITHUB_CALLBACK_PATH}`);
  authorizeUrl.searchParams.set("scope", "repo read:user");
  authorizeUrl.searchParams.set("state", state);

  res.redirect(authorizeUrl.href);
});

router.get("/integrations/github/callback", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    redirectToIntegrations(res, "auth_required");
    return;
  }

  const clientId = getGitHubClientId();
  const clientSecret = getGitHubClientSecret();
  if (!clientId || !clientSecret) {
    redirectToIntegrations(res, "github_oauth_not_configured");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const expectedState = req.cookies?.[GITHUB_OAUTH_COOKIE];
  clearGithubOauthCookie(res);

  if (!code || !state || !expectedState || state !== expectedState) {
    redirectToIntegrations(res, "github_oauth_state_mismatch");
    return;
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Hostack",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${APP_URL}${GITHUB_CALLBACK_PATH}`,
    }),
  });

  const tokenPayload = await tokenResponse.json() as Record<string, unknown>;
  const accessToken =
    typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : null;

  if (!tokenResponse.ok || !accessToken) {
    redirectToIntegrations(res, "github_token_exchange_failed");
    return;
  }

  const accountLogin = await fetchGitHubUserLogin(accessToken);
  await upsertGitHubIntegration(req.user.id, accessToken, accountLogin);

  redirectToIntegrations(res);
});

router.get("/integrations", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const rows = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.userId, userId));

  res.json({ integrations: rows.map(formatIntegration) });
});

router.get("/integrations/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { id } = req.params;

  const [row] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.userId, userId)));

  if (!row) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  res.json(formatIntegration(row));
});

router.post("/integrations", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { provider, accountLabel, metadata } = req.body;

  if (!provider) {
    res.status(400).json({ error: "provider is required" });
    return;
  }

  if (String(provider).toLowerCase() === "github") {
    res.status(400).json({ error: "github_oauth_required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, provider)));

  if (existing) {
    const [updated] = await db
      .update(integrationsTable)
      .set({
        accountLabel: accountLabel || existing.accountLabel,
        metadata: encryptMetadata({
          ...(decryptMetadata(existing.metadata as Record<string, unknown> | null) || {}),
          ...(metadata || {}),
        }),
        status: "connected",
        updatedAt: new Date(),
      })
      .where(eq(integrationsTable.id, existing.id))
      .returning();
    res.json(formatIntegration(updated));
    return;
  }

  const [created] = await db
    .insert(integrationsTable)
    .values({
      userId,
      provider,
      accountLabel,
      metadata: encryptMetadata((metadata as Record<string, unknown> | null) || {}),
      status: "connected",
    })
    .returning();

  res.status(201).json(formatIntegration(created));
});

router.patch("/integrations/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { id } = req.params;
  const { accountLabel, metadata, status } = req.body;

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }

  if (existing.provider === "github") {
    res.status(400).json({ error: "github_oauth_required" });
    return;
  }

  const [updated] = await db
    .update(integrationsTable)
    .set({
      ...(accountLabel !== undefined ? { accountLabel } : {}),
      ...(metadata !== undefined
        ? {
            metadata: encryptMetadata({
              ...(decryptMetadata(existing.metadata as Record<string, unknown> | null) || {}),
              ...(metadata as Record<string, unknown>),
            }),
          }
        : {}),
      ...(status !== undefined ? { status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(integrationsTable.id, id))
    .returning();

  res.json(formatIntegration(updated));
});

router.delete("/integrations/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { id } = req.params;

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }

  await db.delete(projectIntegrationsTable).where(eq(projectIntegrationsTable.integrationId, id));
  await db.delete(integrationsTable).where(eq(integrationsTable.id, id));

  res.json({ success: true });
});

router.get("/projects/:projectId/integrations", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;

  const links = await db
    .select()
    .from(projectIntegrationsTable)
    .where(eq(projectIntegrationsTable.projectId, projectId));

  const integrationIds = links.map(l => l.integrationId);

  if (integrationIds.length === 0) {
    res.json({ integrations: [] });
    return;
  }

  const integrations = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.userId, userId));

  const linked = integrations.filter(i => integrationIds.includes(i.id));
  res.json({ integrations: linked.map(formatIntegration) });
});

export default router;
