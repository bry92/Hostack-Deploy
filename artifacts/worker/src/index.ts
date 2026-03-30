import { hostname } from "node:os";
import { pathToFileURL } from "node:url";
import { db } from "@workspace/db";
import { deploymentLogsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  claimNextJob,
  completeJob,
  computeNextAttemptAt,
  computeJobRetryDelayMs,
  DEFAULT_JOB_LEASE_MS,
  deferJob,
  exhaustJobRetries,
  failJob,
  type JobState,
  type JobTransitionResult,
  recoverStaleJobs,
  renewJobLease,
  scheduleJobRetry,
  startJobRun,
  type Job,
  type StaleJobRecoveryResult,
} from "@workspace/queue";
import {
  DeploymentExecutionError,
  DeploymentExecutionBusyError,
  type DeploymentExecutionPhase,
} from "../../api-server/src/services/deploymentExecutionErrors.js";
import { startDeploymentExecution } from "../../api-server/src/services/deploymentExecutor.ts";
import {
  markDeploymentFailed,
  markDeploymentPending,
} from "../../api-server/src/services/deploymentStateMachine.js";
import { dispatchDeployNotification } from "../../api-server/src/services/notificationDispatcher.js";

const POLL_INTERVAL_MS = 1000;
const DEFAULT_STALE_SWEEP_INTERVAL_MS = 30 * 1000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = Math.max(1000, Math.floor(DEFAULT_JOB_LEASE_MS / 3));
const DEFAULT_BUSY_REQUEUE_DELAY_MS = 5 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(rawValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(rawValue)) {
    return false;
  }

  throw new Error(`Invalid ${name} value: "${rawValue}"`);
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
const BUSY_REQUEUE_DELAY_MS = parsePositiveIntEnv(
  "HOSTACK_JOB_BUSY_REQUEUE_DELAY_MS",
  DEFAULT_BUSY_REQUEUE_DELAY_MS,
);

function getWorkerId(): string {
  const configuredWorkerId = process.env.HOSTACK_WORKER_ID?.trim();
  if (configuredWorkerId) {
    return configuredWorkerId;
  }

  return `worker:${hostname()}:${process.pid}`;
}

function getDeploymentId(job: Job): string {
  const deploymentId = findDeploymentId(job);
  if (!deploymentId) {
    throw new DeploymentExecutionError({
      code: "invalid_job_payload",
      message: `Job ${job.id} missing deploymentId`,
      retryable: false,
    });
  }

  return deploymentId;
}

function findDeploymentId(job: Job): string | null {
  const deploymentId = job.payload?.deploymentId;
  if (typeof deploymentId !== "string") {
    return null;
  }

  const trimmed = deploymentId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function summarizeError(error: unknown, maxLength = 320): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function getAttemptLabel(job: Job): string {
  return `attempt_count=${job.attemptCount}/${job.maxAttempts}`;
}

function isRetryableJobError(error: unknown): boolean {
  return error instanceof DeploymentExecutionError && error.retryable;
}

function getErrorCode(error: unknown): string | null {
  return error instanceof DeploymentExecutionError ? error.code : null;
}

function getExecutionPhase(error: unknown): DeploymentExecutionPhase | null {
  return error instanceof DeploymentExecutionError ? error.phase ?? null : null;
}

function formatRetryLogDetails(details: {
  attemptCount: number;
  delayMs: number;
  errorCode: string | null;
  nextAttemptAt: Date;
  phase: string | null;
}): string {
  return [
    `attempt_count=${details.attemptCount}`,
    `delay_ms=${details.delayMs}`,
    `next_attempt_at=${details.nextAttemptAt.toISOString()}`,
    `error_code=${details.errorCode ?? "unknown"}`,
    `execution_phase=${details.phase ?? "unknown"}`,
  ].join(" ");
}

function formatStateTransitionDetails(details: {
  attemptCount: number;
  jobId: string;
  nextState: JobState;
  phase: string | null;
  previousState: JobState;
}): string {
  return [
    `previous_state=${details.previousState}`,
    `next_state=${details.nextState}`,
    `job_id=${details.jobId}`,
    `attempt_count=${details.attemptCount}`,
    `execution_phase=${details.phase ?? "unknown"}`,
  ].join(" ");
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

async function appendJobLifecycleLog(
  job: Job,
  message: string,
  level: "info" | "warn" | "error" | "success" = "info",
): Promise<void> {
  const deploymentId = findDeploymentId(job);
  if (!deploymentId) {
    return;
  }

  try {
    await appendWorkerLog(deploymentId, message, level);
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    console.error(`[worker] failed to append lifecycle log for ${deploymentId}: ${failure}`);
  }
}

async function logJobStateTransition(
  transition: JobTransitionResult,
  message: string,
  level: "info" | "warn" | "error" | "success" = "info",
): Promise<void> {
  await appendJobLifecycleLog(
    transition.job,
    `[worker] ${message}; ${formatStateTransitionDetails({
      attemptCount: transition.attemptCount,
      jobId: transition.job.id,
      nextState: transition.nextState,
      phase: transition.currentPhase,
      previousState: transition.previousState,
    })}.`,
    level,
  );
}

async function markDeploymentQueuedForRetry(deploymentId: string): Promise<void> {
  await markDeploymentPending(deploymentId, {
    message: "Retry scheduled by worker",
    updates: {
      startedAt: null,
    },
  });
}

async function logStaleRecoveryResult(recovery: StaleJobRecoveryResult): Promise<void> {
  if (!recovery.deploymentId) {
    return;
  }

  const transitionDetails = formatStateTransitionDetails({
    attemptCount: recovery.attemptCount,
    jobId: recovery.jobId,
    nextState: recovery.nextState,
    phase: recovery.currentPhase,
    previousState: recovery.previousState,
  });
  const message = recovery.nextState === "retrying"
    ? `[worker] Stale job recovery scheduled retry for job ${recovery.jobId}; ${formatRetryLogDetails({
      attemptCount: recovery.attemptCount,
      delayMs: recovery.delayMs ?? 0,
      errorCode: recovery.errorCode,
      nextAttemptAt: recovery.nextAttemptAt ?? new Date(),
      phase: recovery.currentPhase,
    })}; ${transitionDetails}.`
    : `[worker] Stale job recovery marked job ${recovery.jobId} failed after attempt_count=${recovery.attemptCount}/${recovery.maxAttempts}; error_code=${recovery.errorCode}; ${transitionDetails}.`;

  await appendWorkerLog(
    recovery.deploymentId,
    message,
    recovery.nextState === "retrying" ? "warn" : "error",
  );
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
          active = false;
          break;
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

async function processJob(
  claimedTransition: JobTransitionResult<"claimed">,
  workerId: string,
): Promise<void> {
  console.log(`[worker] claimed job ${claimedTransition.job.id} (${claimedTransition.job.type})`);
  await logJobStateTransition(
    claimedTransition,
    `Claimed job ${claimedTransition.job.id} (${claimedTransition.job.type}) on ${workerId}`,
  );
  const stopHeartbeat = startLeaseHeartbeat(claimedTransition.job.id, workerId);
  let currentJob = claimedTransition.job;

  try {
    const runningTransition = await startJobRun(db, claimedTransition.job.id, workerId);
    if (!runningTransition) {
      console.warn(`[worker] running transition skipped for job ${claimedTransition.job.id}; lease ownership was lost`);
      await appendJobLifecycleLog(
        claimedTransition.job,
        `[worker] Job ${claimedTransition.job.id} could not transition from claimed to running because the worker no longer owned the lease.`,
        "warn",
      );
      return;
    }

    await logJobStateTransition(
      runningTransition,
      `Started job ${runningTransition.job.id} (${runningTransition.job.type})`,
    );

    const runningJob = runningTransition.job;
    currentJob = runningJob;
    let executionResult: Awaited<ReturnType<typeof startDeploymentExecution>> | null = null;

    switch (runningJob.type) {
      case "build_requested":
      case "rollback_requested": {
        const deploymentId = getDeploymentId(runningJob);
        executionResult = await startDeploymentExecution(deploymentId);
        break;
      }
      default:
        throw new DeploymentExecutionError({
          code: "unsupported_job_type",
          message: `Unsupported job type: ${runningJob.type}`,
          retryable: false,
        });
    }

    if (!executionResult) {
      throw new DeploymentExecutionError({
        code: "deployment_failed",
        message: `Job ${runningJob.id} did not produce an execution result`,
        retryable: false,
      });
    }

    const completed = await completeJob(db, runningJob.id, workerId);
    if (!completed) {
      console.warn(`[worker] completion skipped for job ${runningJob.id}; lease ownership was lost`);
      await appendJobLifecycleLog(
        runningJob,
        `[worker] Execution finished for job ${runningJob.id}, but queue completion was skipped because the worker no longer owned the lease.`,
        "warn",
      );
      return;
    }

    await logJobStateTransition(
      completed,
      executionResult.outcome === "skipped"
        ? `Finalized skipped execution for job ${completed.job.id}`
        : `Completed job ${completed.job.id} successfully`,
      executionResult.outcome === "skipped" ? "warn" : "success",
    );

    if (executionResult.outcome === "skipped") {
      await appendJobLifecycleLog(
        completed.job,
        `[worker] Job ${completed.job.id} finalized without re-executing the deployment: ${executionResult.reason}.`,
        "warn",
      );
    }

    console.log(`[worker] completed job ${runningJob.id} (${runningJob.type})`);
  } catch (error) {
    const message = summarizeError(error);
    const errorCode = getErrorCode(error);
    const phase = getExecutionPhase(error);

    if (error instanceof DeploymentExecutionBusyError) {
      const deferred = await deferJob(db, currentJob.id, workerId, {
        delayMs: BUSY_REQUEUE_DELAY_MS,
        error: message,
        errorCode,
        phase,
      });

      if (!deferred) {
        console.warn(`[worker] busy requeue skipped for job ${currentJob.id}; lease ownership was lost`);
      } else {
        const retryDetails = formatRetryLogDetails({
          attemptCount: deferred.attemptCount,
          delayMs: BUSY_REQUEUE_DELAY_MS,
          errorCode,
          nextAttemptAt: deferred.job.nextAttemptAt ?? deferred.transitionAt,
          phase: deferred.currentPhase,
        });
        console.warn(
          `[worker] job ${currentJob.id} is already executing elsewhere; ${retryDetails}`,
        );
        await logJobStateTransition(
          deferred,
          `Deferred job ${deferred.job.id} because another worker already holds the execution lock; ${retryDetails}`,
          "warn",
        );
      }
      return;
    }

    const nextAttemptCount = currentJob.attemptCount + 1;
    const retryable = isRetryableJobError(error);
    if (retryable && nextAttemptCount >= currentJob.maxAttempts) {
      const exhausted = await exhaustJobRetries(db, currentJob.id, workerId, {
        attemptCount: nextAttemptCount,
        error: message,
        errorCode,
        phase,
      });
      if (!exhausted) {
        console.warn(`[worker] retry exhaustion transition skipped for job ${currentJob.id}; lease ownership was lost`);
        return;
      }

      await logJobStateTransition(
        exhausted,
        `Retry budget exhausted for job ${exhausted.job.id}; no additional retry will be scheduled`,
        "warn",
      );

      const failed = await failJob(db, currentJob.id, workerId, message, {
        attemptCount: nextAttemptCount,
        errorCode,
        fromState: "retrying",
        phase,
      });
      if (!failed) {
        console.warn(`[worker] exhausted retry failure update skipped for job ${currentJob.id}; lease ownership was lost`);
        return;
      }

      const deploymentId = findDeploymentId(currentJob);
      if (deploymentId) {
        await markDeploymentFailed(deploymentId, message, {
          jobId: currentJob.id,
          phase,
        }).catch((transitionError) => {
          const transitionMessage = summarizeError(transitionError);
          console.error(`[worker] failed to mark deployment ${deploymentId} failed after retry exhaustion: ${transitionMessage}`);
        });
        dispatchDeployNotification(deploymentId, "deploy_failed").catch(() => {});
      }

      await logJobStateTransition(
        failed,
        `Marked job ${failed.job.id} failed after retry exhaustion; error_code=${errorCode ?? "unknown"}; message=${message}`,
        "error",
      );
      console.error(
        `[worker] failed job ${currentJob.id} (${currentJob.type}) after exhausting retries: ${message}`,
      );
      return;
    }

    if (retryable) {
      const delayMs = computeJobRetryDelayMs(nextAttemptCount);
      const nextAttemptAt = computeNextAttemptAt(delayMs);
      const retried = await scheduleJobRetry(db, currentJob.id, workerId, {
        attemptCount: nextAttemptCount,
        delayMs,
        error: message,
        errorCode,
        nextAttemptAt,
        phase,
      });

      if (!retried) {
        console.warn(`[worker] retry requeue skipped for job ${currentJob.id}; lease ownership was lost`);
        return;
      }

      const deploymentId = findDeploymentId(currentJob);
      if (deploymentId) {
        await markDeploymentQueuedForRetry(deploymentId).catch((retryError) => {
          const retryMessage = summarizeError(retryError);
          console.error(`[worker] failed to reset deployment ${deploymentId} for retry: ${retryMessage}`);
        });
      }

      const retryDetails = formatRetryLogDetails({
        attemptCount: retried.attemptCount,
        delayMs,
        errorCode,
        nextAttemptAt: retried.job.nextAttemptAt ?? nextAttemptAt,
        phase: retried.currentPhase,
      });
      console.warn(
        `[worker] scheduled retry for job ${currentJob.id} (${currentJob.type}); ${retryDetails}; message=${message}`,
      );
      await logJobStateTransition(
        retried,
        `Scheduled retry for job ${retried.job.id}; ${retryDetails}; message=${message}`,
        "warn",
      );
      return;
    }

    const failed = await failJob(db, currentJob.id, workerId, message, {
      errorCode,
      phase,
    });
    if (!failed) {
      console.warn(`[worker] failure update skipped for job ${currentJob.id}; lease ownership was lost`);
      return;
    }

    const deploymentId = findDeploymentId(currentJob);
    if (deploymentId) {
      await markDeploymentFailed(deploymentId, message, {
        jobId: currentJob.id,
        phase,
      }).catch((transitionError) => {
        const transitionMessage = summarizeError(transitionError);
        console.error(`[worker] failed to mark deployment ${deploymentId} failed: ${transitionMessage}`);
      });
      dispatchDeployNotification(deploymentId, "deploy_failed").catch(() => {});
    }

    await logJobStateTransition(
      failed,
      `Marked job ${failed.job.id} failed; error_code=${errorCode ?? "unknown"}; message=${message}`,
      "error",
    );
    console.error(`[worker] failed job ${currentJob.id} (${currentJob.type}): ${message}`);
  } finally {
    await stopHeartbeat();
  }
}

export async function runWorkerLoop(workerId = getWorkerId()): Promise<never> {
  console.log(
    `[worker] starting worker ${workerId} (lease ${JOB_LEASE_MS}ms, heartbeat ${HEARTBEAT_INTERVAL_MS}ms, sweep ${STALE_SWEEP_INTERVAL_MS}ms, retryBase 2000ms, retryMax 60000ms, retryJitter +/-20%)`,
  );

  let lastStaleSweep = 0;

  while (true) {
    try {
      const now = Date.now();
      if (now - lastStaleSweep >= STALE_SWEEP_INTERVAL_MS) {
        const recovered = await recoverStaleJobs(db, JOB_LEASE_MS);
        if (recovered.length > 0) {
          console.warn(`[worker] recovered ${recovered.length} stale job(s)`);
          for (const recovery of recovered) {
            try {
              await logStaleRecoveryResult(recovery);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error(`[worker] failed to append stale-job log for ${recovery.jobId}: ${message}`);
            }
          }
        }
        lastStaleSweep = now;
      }

      const claimedTransition = await claimNextJob(db, workerId);

      if (!claimedTransition) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      await processJob(claimedTransition, workerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] loop error: ${message}`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

async function runIdleLoop(): Promise<never> {
  console.log("[worker] HOSTACK_RUN_EMBEDDED_WORKER=true; standalone worker is idle");

  while (true) {
    await sleep(60_000);
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
  if (readBooleanEnv("HOSTACK_RUN_EMBEDDED_WORKER", false)) {
    void runIdleLoop();
  } else {
    void runWorkerLoop();
  }
}
