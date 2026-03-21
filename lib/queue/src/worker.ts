import { db as defaultDb } from "@workspace/db";
import { jobsTable } from "@workspace/db/schema";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import type { Job } from "./types.ts";

type QueueDb = typeof defaultDb;
export const DEFAULT_JOB_LEASE_MS = 5 * 60 * 1000;

const STALE_JOB_MESSAGE =
  "Worker lease expired while processing; requeued automatically.";

export async function recoverStaleJobs(
  db: QueueDb,
  leaseMs = DEFAULT_JOB_LEASE_MS,
): Promise<number> {
  const expiredBefore = new Date(Date.now() - leaseMs);

  const recovered = await db
    .update(jobsTable)
    .set({
      status: "queued",
      lockedAt: null,
      lockedBy: null,
      lastError: STALE_JOB_MESSAGE,
      availableAt: new Date(),
    })
    .where(
      and(
        eq(jobsTable.status, "processing"),
        lte(jobsTable.lockedAt, expiredBefore),
      ),
    )
    .returning({ id: jobsTable.id });

  return recovered.length;
}

export async function claimNextJob(
  db: QueueDb,
  workerId: string,
): Promise<Job | null> {
  const [candidate] = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.status, "queued"),
        isNull(jobsTable.lockedAt),
        lte(jobsTable.availableAt, new Date()),
      ),
    )
    .orderBy(asc(jobsTable.availableAt), asc(jobsTable.createdAt))
    .limit(1);

  if (!candidate) {
    return null;
  }

  const [claimed] = await db
    .update(jobsTable)
    .set({
      status: "processing",
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: sql`${jobsTable.attempts} + 1`,
      lastError: null,
    })
    .where(
      and(
        eq(jobsTable.id, candidate.id),
        eq(jobsTable.status, "queued"),
        isNull(jobsTable.lockedAt),
      ),
    )
    .returning();

  return (claimed as Job | undefined) ?? null;
}

export async function completeJob(
  db: QueueDb,
  jobId: string,
): Promise<void> {
  await db
    .update(jobsTable)
    .set({
      status: "completed",
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    })
    .where(eq(jobsTable.id, jobId));
}

export async function failJob(
  db: QueueDb,
  jobId: string,
  error: string,
): Promise<void> {
  await db
    .update(jobsTable)
    .set({
      status: "failed",
      lockedAt: null,
      lockedBy: null,
      lastError: error,
    })
    .where(eq(jobsTable.id, jobId));
}

export async function requeueJob(
  db: QueueDb,
  jobId: string,
  error: string,
  delayMs = 0,
): Promise<void> {
  await db
    .update(jobsTable)
    .set({
      status: "queued",
      lockedAt: null,
      lockedBy: null,
      lastError: error,
      availableAt: new Date(Date.now() + delayMs),
    })
    .where(eq(jobsTable.id, jobId));
}
