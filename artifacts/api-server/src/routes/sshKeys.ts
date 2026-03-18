import { Router } from "express";
import { db } from "@workspace/db";
import { sshKeysTable, projectsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateKeyPairSync } from "crypto";
import { encryptString } from "../lib/secrets.js";

const router = Router();

function generateEd25519KeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const spkiBase64 = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----\n?/, "")
    .replace(/\n?-----END PUBLIC KEY-----\n?/, "")
    .replace(/\n/g, "");

  const spkiBytes = Buffer.from(spkiBase64, "base64");
  const rawKey = spkiBytes.subarray(12);

  const algorithmStr = "ssh-ed25519";
  const algorithmBuf = Buffer.from(algorithmStr);

  const wireFormat = Buffer.alloc(4 + algorithmBuf.length + 4 + rawKey.length);
  wireFormat.writeUInt32BE(algorithmBuf.length, 0);
  algorithmBuf.copy(wireFormat, 4);
  wireFormat.writeUInt32BE(rawKey.length, 4 + algorithmBuf.length);
  rawKey.copy(wireFormat, 4 + algorithmBuf.length + 4);

  const opensshPublic = `ssh-ed25519 ${wireFormat.toString("base64")} hostack-deploy`;

  return { publicKey: opensshPublic, privateKey };
}

async function getOwnedProject(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return project;
}

const PUBLIC_KEY_COLS = {
  id: sshKeysTable.id,
  projectId: sshKeysTable.projectId,
  publicKey: sshKeysTable.publicKey,
  provider: sshKeysTable.provider,
  createdAt: sshKeysTable.createdAt,
};

router.get("/projects/:projectId/ssh-key", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { projectId } = req.params;

  const project = await getOwnedProject(userId, projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [key] = await db
    .select(PUBLIC_KEY_COLS)
    .from(sshKeysTable)
    .where(eq(sshKeysTable.projectId, projectId));

  return res.json({ sshKey: key || null });
});

router.post("/projects/:projectId/ssh-key/generate", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { projectId } = req.params;

  const project = await getOwnedProject(userId, projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  await db.delete(sshKeysTable).where(eq(sshKeysTable.projectId, projectId));

  const { publicKey, privateKey } = generateEd25519KeyPair();

  const [key] = await db
    .insert(sshKeysTable)
    .values({
      projectId,
      publicKey,
      privateKey: encryptString(privateKey)!,
      provider: "github",
    })
    .returning(PUBLIC_KEY_COLS);

  return res.status(201).json({ sshKey: key });
});

router.delete("/projects/:projectId/ssh-key", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { projectId } = req.params;

  const project = await getOwnedProject(userId, projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  await db.delete(sshKeysTable).where(eq(sshKeysTable.projectId, projectId));

  return res.json({ success: true });
});

export default router;
