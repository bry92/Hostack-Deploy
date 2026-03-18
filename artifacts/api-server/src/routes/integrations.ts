import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { integrationsTable, projectIntegrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptMetadata, encryptMetadata } from "../lib/secrets.js";

const router: IRouter = Router();

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
