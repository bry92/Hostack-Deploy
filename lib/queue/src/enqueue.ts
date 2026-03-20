import { db as defaultDb } from "@workspace/db";
import { jobsTable } from "@workspace/db/schema";
import type { EnqueueJobInput, Job } from "./types.ts";

type QueueDb = typeof defaultDb;

export async function enqueueJob(
  db: QueueDb,
  job: EnqueueJobInput,
): Promise<Job> {
  const [created] = await db
    .insert(jobsTable)
    .values({
      type: job.type,
      payload: job.payload,
      status: "queued",
      attempts: 0,
      availableAt: job.availableAt ?? new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    })
    .returning();

  return created as Job;
}
