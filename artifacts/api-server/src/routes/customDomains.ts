import { Router } from "express";
import { db } from "@workspace/db";
import { customDomainsTable, projectsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { resolveTxt } from "node:dns/promises";

const router = Router();
const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

function getVerificationRecordName(domain: string) {
  return `_hostack-challenge.${domain}`;
}

async function hasVerificationTxtRecord(domain: string, token: string) {
  const recordName = getVerificationRecordName(domain);
  try {
    const records = await resolveTxt(recordName);
    return records.some(parts => parts.join("").trim() === token);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String((error as { code?: string }).code ?? "");
      if (code === "ENODATA" || code === "ENOTFOUND" || code === "SERVFAIL" || code === "ETIMEOUT" || code === "EAI_AGAIN") {
        return false;
      }
    }
    throw error;
  }
}

async function getOwnedProject(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return project;
}

router.get("/projects/:projectId/domains", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { projectId } = req.params;

  const project = await getOwnedProject(userId, projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const domains = await db
    .select()
    .from(customDomainsTable)
    .where(eq(customDomainsTable.projectId, projectId));

  return res.json({ domains });
});

router.post("/projects/:projectId/domains", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { projectId } = req.params;
  const { domain } = req.body;

  if (!domain || typeof domain !== "string") {
    return res.status(400).json({ error: "Domain is required" });
  }

  const domainClean = domain.trim().toLowerCase();
  if (!domainRegex.test(domainClean)) {
    return res.status(400).json({ error: "Invalid domain format" });
  }

  const project = await getOwnedProject(userId, projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [existing] = await db
    .select()
    .from(customDomainsTable)
    .where(eq(customDomainsTable.domain, domainClean))
    .limit(1);

  if (existing?.projectId === projectId) {
    return res.status(409).json({ error: "Domain already added to this project" });
  }
  if (existing) return res.status(409).json({ error: "Domain is already attached to another project" });

  const verificationToken = randomBytes(32).toString("hex");

  const [created] = await db
    .insert(customDomainsTable)
    .values({ projectId, domain: domainClean, verificationToken, status: "pending_verification" })
    .returning();

  return res.status(201).json({ domain: created });
});

router.delete("/projects/:projectId/domains/:domainId", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { projectId, domainId } = req.params;

  const project = await getOwnedProject(userId, projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [deleted] = await db
    .delete(customDomainsTable)
    .where(and(eq(customDomainsTable.id, domainId), eq(customDomainsTable.projectId, projectId)))
    .returning();

  if (!deleted) return res.status(404).json({ error: "Domain not found" });

  return res.json({ success: true });
});

router.post("/projects/:projectId/domains/:domainId/verify", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { projectId, domainId } = req.params;

  const project = await getOwnedProject(userId, projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [domain] = await db
    .select()
    .from(customDomainsTable)
    .where(and(eq(customDomainsTable.id, domainId), eq(customDomainsTable.projectId, projectId)));

  if (!domain) return res.status(404).json({ error: "Domain not found" });

  if (domain.status === "active") {
    return res.json({ domain });
  }

  const verified = await hasVerificationTxtRecord(domain.domain, domain.verificationToken);

  if (verified) {
    const [updated] = await db
      .update(customDomainsTable)
      .set({ status: "active", verifiedAt: new Date() })
      .where(eq(customDomainsTable.id, domainId))
      .returning();
    return res.json({ domain: updated });
  } else {
    const [updated] = await db
      .update(customDomainsTable)
      .set({ status: "pending_verification", verifiedAt: null })
      .where(eq(customDomainsTable.id, domainId))
      .returning();
    return res.status(409).json({
      error: "Verification TXT record not found",
      recordName: getVerificationRecordName(domain.domain),
      expectedValue: domain.verificationToken,
      domain: updated,
    });
  }
});

export default router;
