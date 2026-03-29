import { db as defaultDb } from "@workspace/db";
import { jobsTable } from "@workspace/db/schema";
import type { EnqueueJobInput, Job } from "./types.ts";

type QueueDb = typeof defaultDb;

export async function enqueueJob(
  db: QueueDb,
  job: EnqueueJobInput,
): Promise<Job> {
  const scheduledAt = job.nextAttemptAt ?? job.availableAt ?? null;
  const [created] = await db
    .insert(jobsTable)
    .values({
      type: job.type,
      payload: job.payload,
      status: "queued",
      attemptCount: 0,
      maxAttempts: job.maxAttempts,
      attempts: 0,
      availableAt: scheduledAt ?? new Date(),
      completedAt: null,
      currentPhase: "queued",
      lastTransitionAt: new Date(),
      nextAttemptAt: scheduledAt,
      startedAt: null,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      lastErrorCode: null,
    })
    .returning();

  return created as Job;
}
