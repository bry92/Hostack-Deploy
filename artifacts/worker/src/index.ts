import { hostname } from "node:os";
import { pathToFileURL } from "node:url";
import { db } from "@workspace/db";
import { deploymentLogsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  claimNextJob,
  completeJob,
  DEFAULT_JOB_LEASE_MS,
  failJob,
  recoverStaleJobs,
  renewJobLease,
  type Job,
} from "@workspace/queue";
import { startDeploymentExecution } from "../../api-server/src/services/deploymentExecutor.ts";

const POLL_INTERVAL_MS = 1000;
const DEFAULT_STALE_SWEEP_INTERVAL_MS = 30 * 1000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = Math.max(1000, Math.floor(DEFAULT_JOB_LEASE_MS / 3));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: "${rawValue}"`);
  }

  return parsed;
}

const JOB_LEASE_MS = parsePositiveIntEnv("HOSTACK_JOB_LEASE_MS", DEFAULT_JOB_LEASE_MS);
const STALE_SWEEP_INTERVAL_MS = parsePositiveIntEnv(
  "HOSTACK_STALE_SWEEP_INTERVAL_MS",
  DEFAULT_STALE_SWEEP_INTERVAL_MS,
);
const HEARTBEAT_INTERVAL_MS = parsePositiveIntEnv(
  "HOSTACK_JOB_HEARTBEAT_INTERVAL_MS",
  DEFAULT_HEARTBEAT_INTERVAL_MS,
);

function getWorkerId(): string {
  const configuredWorkerId = process.env.HOSTACK_WORKER_ID?.trim();
  if (configuredWorkerId) {
    return configuredWorkerId;
  }

  return `worker:${hostname()}:${process.pid}`;
}

function getDeploymentId(job: Job): string {
  const deploymentId = job.payload?.deploymentId as string | undefined;
  if (!deploymentId?.trim()) {
    throw new Error(`Job ${job.id} missing deploymentId`);
  }

  return deploymentId;
}

async function appendWorkerLog(
  deploymentId: string,
  message: string,
  level: "info" | "warn" | "error" | "success" = "warn",
): Promise<void> {
  const [latestLog] = await db
    .select({ stepOrder: deploymentLogsTable.stepOrder })
    .from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(desc(deploymentLogsTable.stepOrder), desc(deploymentLogsTable.createdAt))
    .limit(1);

  await db.insert(deploymentLogsTable).values({
    deploymentId,
    logLevel: level,
    message,
    stepOrder: latestLog ? latestLog.stepOrder + 1 : 0,
  });
}

function startLeaseHeartbeat(jobId: string, workerId: string): () => Promise<void> {
  let active = true;

  const loop = (async () => {
    while (active) {
      await sleep(HEARTBEAT_INTERVAL_MS);
      if (!active) {
        break;
      }

      try {
        const renewed = await renewJobLease(db, jobId, workerId);
        if (!renewed) {
          console.warn(`[worker] heartbeat could not renew lease for job ${jobId}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker] heartbeat error for job ${jobId}: ${message}`);
      }
    }
  })();

  return async () => {
    active = false;
    await loop.catch(() => {});
  };
}

async function processJob(job: Job, workerId: string): Promise<void> {
  console.log(`[worker] claimed job ${job.id} (${job.type})`);
  const stopHeartbeat = startLeaseHeartbeat(job.id, workerId);

  try {
    switch (job.type) {
      case "build_requested":
      case "rollback_requested": {
        const deploymentId = getDeploymentId(job);
        await startDeploymentExecution(deploymentId);
        break;
      }
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }

    await completeJob(db, job.id);
    console.log(`[worker] completed job ${job.id} (${job.type})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(db, job.id, message);
    console.error(`[worker] failed job ${job.id} (${job.type}): ${message}`);
  } finally {
    await stopHeartbeat();
  }
}

export async function runWorkerLoop(workerId = getWorkerId()): Promise<never> {
  console.log(
    `[worker] starting worker ${workerId} (lease ${JOB_LEASE_MS}ms, heartbeat ${HEARTBEAT_INTERVAL_MS}ms, sweep ${STALE_SWEEP_INTERVAL_MS}ms)`,
  );

  let lastStaleSweep = 0;

  while (true) {
    try {
      const now = Date.now();
      if (now - lastStaleSweep >= STALE_SWEEP_INTERVAL_MS) {
        const recovered = await recoverStaleJobs(db, JOB_LEASE_MS);
        if (recovered.length > 0) {
          console.warn(`[worker] requeued ${recovered.length} stale job(s)`);
          for (const job of recovered) {
            const deploymentId = typeof job.payload?.deploymentId === "string"
              ? job.payload.deploymentId
              : null;
            if (!deploymentId) {
              continue;
            }

            try {
              await appendWorkerLog(
                deploymentId,
                "[worker] Job lease expired while processing; Hostack requeued this deployment automatically.",
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error(`[worker] failed to append stale-job log for ${deploymentId}: ${message}`);
            }
          }
        }
        lastStaleSweep = now;
      }

      const job = await claimNextJob(db, workerId);

      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      await processJob(job, workerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] loop error: ${message}`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function isDirectExecution(): boolean {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectExecution()) {
  void runWorkerLoop();
}
