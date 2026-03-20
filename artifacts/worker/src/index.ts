import { hostname } from "node:os";
import { pathToFileURL } from "node:url";
import { db } from "@workspace/db";
import { claimNextJob, completeJob, failJob, type Job } from "@workspace/queue";
import { startDeploymentExecution } from "../../api-server/src/services/deploymentExecutor.js";

const POLL_INTERVAL_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function processJob(job: Job): Promise<void> {
  console.log(`[worker] claimed job ${job.id} (${job.type})`);

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
  }
}

export async function runWorkerLoop(workerId = getWorkerId()): Promise<never> {
  console.log(`[worker] starting worker ${workerId}`);

  while (true) {
    try {
      const job = await claimNextJob(db, workerId);

      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      await processJob(job);
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
