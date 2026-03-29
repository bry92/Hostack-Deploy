import { db as defaultDb } from "@workspace/db";
import { jobsTable } from "@workspace/db/schema";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type { Job, JobState } from "./types.ts";

type QueueDb = typeof defaultDb;

export const DEFAULT_JOB_LEASE_MS = 5 * 60 * 1000;
export const DEFAULT_JOB_RETRY_BASE_DELAY_MS = 2 * 1000;
export const DEFAULT_JOB_MAX_RETRY_DELAY_MS = 60 * 1000;
export const DEFAULT_JOB_RETRY_JITTER_RATIO = 0.2;

const STALE_JOB_MESSAGE =
  "Worker lease expired while claimed/running; retry scheduled automatically.";
const STALE_JOB_ERROR_CODE = "lease_expired";

const VALID_JOB_TRANSITIONS: Record<JobState, ReadonlySet<JobState>> = {
  claimed: new Set<JobState>(["running", "failed"]),
  failed: new Set<JobState>(),
  queued: new Set<JobState>(["claimed"]),
  retrying: new Set<JobState>(["claimed", "failed"]),
  running: new Set<JobState>(["retrying", "succeeded", "failed"]),
  succeeded: new Set<JobState>(),
};

export type JobTransitionResult<TState extends JobState = JobState> = {
  attemptCount: number;
  currentPhase: string | null;
  job: Job;
  nextState: TState;
  previousState: JobState;
  transitionAt: Date;
};

export type DeferJobOptions = {
  delayMs: number;
  error: string;
  errorCode?: string | null;
  nextAttemptAt?: Date;
  phase?: string | null;
};

export type ScheduleJobRetryOptions = {
  attemptCount: number;
  delayMs: number;
  error: string;
  errorCode?: string | null;
  nextAttemptAt: Date;
  phase?: string | null;
};

export type FailJobOptions = {
  attemptCount?: number;
  errorCode?: string | null;
  fromState?: "running" | "retrying";
  phase?: string | null;
};

type TransitionJobToRetryingOptions = {
  attemptCount?: number;
  error: string;
  errorCode?: string | null;
  nextAttemptAt?: Date | null;
  phase?: string | null;
  releaseLease?: boolean;
};

export type StaleJobRecoveryResult = {
  attemptCount: number;
  currentPhase: string | null;
  delayMs: number | null;
  deploymentId: string | null;
  errorCode: string;
  jobId: string;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  nextState: "failed" | "retrying";
  previousState: "claimed" | "running";
  transitionAt: Date;
};

function getDeploymentId(payload: Record<string, unknown>): string | null {
  const deploymentId = payload.deploymentId;
  if (typeof deploymentId !== "string") {
    return null;
  }

  const trimmed = deploymentId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertValidTransition(previousState: JobState, nextState: JobState): void {
  const allowedTransitions = VALID_JOB_TRANSITIONS[previousState];
  if (!allowedTransitions.has(nextState)) {
    throw new Error(`Invalid job state transition: ${previousState} -> ${nextState}`);
  }
}

function buildTransitionResult<TState extends JobState>(
  job: Job,
  previousState: JobState,
  nextState: TState,
  transitionAt: Date,
): JobTransitionResult<TState> {
  return {
    attemptCount: job.attemptCount,
    currentPhase: job.currentPhase ?? null,
    job,
    nextState,
    previousState,
    transitionAt,
  };
}

export function computeJobRetryDelayMs(
  attemptCount: number,
  randomValue = Math.random(),
): number {
  const safeAttemptCount = Math.max(1, Math.floor(attemptCount));
  const clampedRandomValue = Math.min(Math.max(randomValue, 0), 1);
  const exponentialDelay = DEFAULT_JOB_RETRY_BASE_DELAY_MS * 2 ** (safeAttemptCount - 1);
  const cappedDelay = Math.min(DEFAULT_JOB_MAX_RETRY_DELAY_MS, exponentialDelay);
  const jitterFactor =
    1 + ((clampedRandomValue * 2) - 1) * DEFAULT_JOB_RETRY_JITTER_RATIO;

  return Math.max(0, Math.round(cappedDelay * jitterFactor));
}

export function computeNextAttemptAt(delayMs: number, now = new Date()): Date {
  return new Date(now.getTime() + delayMs);
}

export async function recoverStaleJobs(
  db: QueueDb,
  leaseMs = DEFAULT_JOB_LEASE_MS,
): Promise<StaleJobRecoveryResult[]> {
  const expiredBefore = new Date(Date.now() - leaseMs);
  const staleJobs = await db
    .select({
      attemptCount: jobsTable.attemptCount,
      currentPhase: jobsTable.currentPhase,
      id: jobsTable.id,
      maxAttempts: jobsTable.maxAttempts,
      payload: jobsTable.payload,
      status: jobsTable.status,
    })
    .from(jobsTable)
    .where(
      and(
        inArray(jobsTable.status, ["claimed", "running"]),
        lte(jobsTable.lockedAt, expiredBefore),
      ),
    );

  const recovered: StaleJobRecoveryResult[] = [];

  for (const staleJob of staleJobs) {
    const previousState = staleJob.status as "claimed" | "running";
    const transitionAt = new Date();
    const currentPhase = staleJob.currentPhase ?? previousState;
    const nextAttemptCount = staleJob.attemptCount + 1;
    const deploymentId = getDeploymentId(staleJob.payload);

    if (nextAttemptCount >= staleJob.maxAttempts) {
      assertValidTransition(previousState, "failed");
      const [failed] = await db
        .update(jobsTable)
        .set({
          attemptCount: nextAttemptCount,
          attempts: nextAttemptCount,
          completedAt: transitionAt,
          currentPhase,
          lastError: STALE_JOB_MESSAGE,
          lastErrorCode: STALE_JOB_ERROR_CODE,
          lastTransitionAt: transitionAt,
          lockedAt: null,
          lockedBy: null,
          nextAttemptAt: null,
          status: "failed",
        })
        .where(
          and(
            eq(jobsTable.id, staleJob.id),
            eq(jobsTable.status, previousState),
            lte(jobsTable.lockedAt, expiredBefore),
          ),
        )
        .returning();

      if (!failed) {
        continue;
      }

      recovered.push({
        attemptCount: nextAttemptCount,
        currentPhase,
        delayMs: null,
        deploymentId,
        errorCode: STALE_JOB_ERROR_CODE,
        jobId: staleJob.id,
        maxAttempts: staleJob.maxAttempts,
        nextAttemptAt: null,
        nextState: "failed",
        previousState,
        transitionAt,
      });
      continue;
    }

    assertValidTransition(previousState, "retrying");
    const delayMs = computeJobRetryDelayMs(nextAttemptCount);
    const nextAttemptAt = computeNextAttemptAt(delayMs, transitionAt);
    const [retried] = await db
      .update(jobsTable)
      .set({
        attemptCount: nextAttemptCount,
        attempts: nextAttemptCount,
        availableAt: nextAttemptAt,
        completedAt: transitionAt,
        currentPhase,
        lastError: STALE_JOB_MESSAGE,
        lastErrorCode: STALE_JOB_ERROR_CODE,
        lastTransitionAt: transitionAt,
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt,
        status: "retrying",
      })
      .where(
        and(
          eq(jobsTable.id, staleJob.id),
          eq(jobsTable.status, previousState),
          lte(jobsTable.lockedAt, expiredBefore),
        ),
      )
      .returning();

    if (!retried) {
      continue;
    }

    recovered.push({
      attemptCount: nextAttemptCount,
      currentPhase,
      delayMs,
      deploymentId,
      errorCode: STALE_JOB_ERROR_CODE,
      jobId: staleJob.id,
      maxAttempts: staleJob.maxAttempts,
      nextAttemptAt,
      nextState: "retrying",
      previousState,
      transitionAt,
    });
  }

  return recovered;
}

export async function claimNextJob(
  db: QueueDb,
  workerId: string,
): Promise<JobTransitionResult<"claimed"> | null> {
  const now = new Date();
  const [candidate] = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        inArray(jobsTable.status, ["queued", "retrying"]),
        isNull(jobsTable.lockedAt),
        or(
          and(isNull(jobsTable.nextAttemptAt), lte(jobsTable.availableAt, now)),
          lte(jobsTable.nextAttemptAt, now),
        ),
      ),
    )
    .orderBy(asc(jobsTable.nextAttemptAt), asc(jobsTable.availableAt), asc(jobsTable.createdAt))
    .limit(1);

  if (!candidate) {
    return null;
  }

  const previousState = candidate.status as "queued" | "retrying";
  assertValidTransition(previousState, "claimed");
  const transitionAt = new Date();
  const [claimed] = await db
    .update(jobsTable)
    .set({
      currentPhase: "claimed",
      lastTransitionAt: transitionAt,
      lockedAt: transitionAt,
      lockedBy: workerId,
      status: "claimed",
    })
    .where(
      and(
        eq(jobsTable.id, candidate.id),
        eq(jobsTable.status, previousState),
        isNull(jobsTable.lockedAt),
      ),
    )
    .returning();

  return claimed
    ? buildTransitionResult(claimed as Job, previousState, "claimed", transitionAt)
    : null;
}

export async function startJobRun(
  db: QueueDb,
  jobId: string,
  workerId: string,
): Promise<JobTransitionResult<"running"> | null> {
  assertValidTransition("claimed", "running");
  const transitionAt = new Date();
  const [running] = await db
    .update(jobsTable)
    .set({
      completedAt: null,
      currentPhase: "running",
      lastTransitionAt: transitionAt,
      startedAt: transitionAt,
      status: "running",
    })
    .where(
      and(
        eq(jobsTable.id, jobId),
        eq(jobsTable.status, "claimed"),
        eq(jobsTable.lockedBy, workerId),
      ),
    )
    .returning();

  return running
    ? buildTransitionResult(running as Job, "claimed", "running", transitionAt)
    : null;
}

export async function completeJob(
  db: QueueDb,
  jobId: string,
  workerId: string,
): Promise<JobTransitionResult<"succeeded"> | null> {
  assertValidTransition("running", "succeeded");
  const transitionAt = new Date();
  const [completed] = await db
    .update(jobsTable)
    .set({
      completedAt: transitionAt,
      currentPhase: "completed",
      lastError: null,
      lastErrorCode: null,
      lastTransitionAt: transitionAt,
      lockedAt: null,
      lockedBy: null,
      nextAttemptAt: null,
      status: "succeeded",
    })
    .where(
      and(
        eq(jobsTable.id, jobId),
        eq(jobsTable.status, "running"),
        eq(jobsTable.lockedBy, workerId),
      ),
    )
    .returning();

  return completed
    ? buildTransitionResult(completed as Job, "running", "succeeded", transitionAt)
    : null;
}

export async function renewJobLease(
  db: QueueDb,
  jobId: string,
  workerId: string,
): Promise<boolean> {
  const [renewed] = await db
    .update(jobsTable)
    .set({
      lockedAt: new Date(),
    })
    .where(
      and(
        eq(jobsTable.id, jobId),
        inArray(jobsTable.status, ["claimed", "running"]),
        eq(jobsTable.lockedBy, workerId),
      ),
    )
    .returning({ id: jobsTable.id });

  return Boolean(renewed);
}

async function transitionJobToRetrying(
  db: QueueDb,
  jobId: string,
  workerId: string,
  options: TransitionJobToRetryingOptions,
): Promise<JobTransitionResult<"retrying"> | null> {
  assertValidTransition("running", "retrying");
  const transitionAt = new Date();
  const currentPhase = options.phase ?? "running";
  const nextAttemptAt = options.nextAttemptAt ?? null;
  const releaseLease = options.releaseLease ?? true;
  const [retried] = await db
    .update(jobsTable)
    .set({
      attemptCount: options.attemptCount,
      attempts: options.attemptCount,
      availableAt: nextAttemptAt ?? transitionAt,
      completedAt: transitionAt,
      currentPhase,
      lastError: options.error,
      lastErrorCode: options.errorCode ?? null,
      lastTransitionAt: transitionAt,
      lockedAt: releaseLease ? null : transitionAt,
      lockedBy: releaseLease ? null : workerId,
      nextAttemptAt,
      status: "retrying",
    })
    .where(
      and(
        eq(jobsTable.id, jobId),
        eq(jobsTable.status, "running"),
        eq(jobsTable.lockedBy, workerId),
      ),
    )
    .returning();

  return retried
    ? buildTransitionResult(retried as Job, "running", "retrying", transitionAt)
    : null;
}

export async function failJob(
  db: QueueDb,
  jobId: string,
  workerId: string,
  error: string,
  options: FailJobOptions = {},
): Promise<JobTransitionResult<"failed"> | null> {
  const previousState = options.fromState ?? "running";
  assertValidTransition(previousState, "failed");
  const transitionAt = new Date();
  const currentPhase = options.phase ?? "running";
  const [failed] = await db
    .update(jobsTable)
    .set({
      attemptCount: options.attemptCount,
      attempts: options.attemptCount,
      completedAt: transitionAt,
      currentPhase,
      lastError: error,
      lastErrorCode: options.errorCode ?? null,
      lastTransitionAt: transitionAt,
      lockedAt: null,
      lockedBy: null,
      nextAttemptAt: null,
      status: "failed",
    })
    .where(
      and(
        eq(jobsTable.id, jobId),
        eq(jobsTable.status, previousState),
        eq(jobsTable.lockedBy, workerId),
      ),
    )
    .returning();

  return failed
    ? buildTransitionResult(failed as Job, previousState, "failed", transitionAt)
    : null;
}

export async function scheduleJobRetry(
  db: QueueDb,
  jobId: string,
  workerId: string,
  options: ScheduleJobRetryOptions,
): Promise<JobTransitionResult<"retrying"> | null> {
  return transitionJobToRetrying(db, jobId, workerId, {
    attemptCount: options.attemptCount,
    error: options.error,
    errorCode: options.errorCode,
    nextAttemptAt: options.nextAttemptAt,
    phase: options.phase,
    releaseLease: true,
  });
}

export async function deferJob(
  db: QueueDb,
  jobId: string,
  workerId: string,
  options: DeferJobOptions,
): Promise<JobTransitionResult<"retrying"> | null> {
  const nextAttemptAt = options.nextAttemptAt ?? computeNextAttemptAt(options.delayMs);
  return transitionJobToRetrying(db, jobId, workerId, {
    error: options.error,
    errorCode: options.errorCode,
    nextAttemptAt,
    phase: options.phase,
    releaseLease: true,
  });
}

export async function exhaustJobRetries(
  db: QueueDb,
  jobId: string,
  workerId: string,
  options: Omit<ScheduleJobRetryOptions, "delayMs" | "nextAttemptAt">,
): Promise<JobTransitionResult<"retrying"> | null> {
  return transitionJobToRetrying(db, jobId, workerId, {
    attemptCount: options.attemptCount,
    error: options.error,
    errorCode: options.errorCode,
    nextAttemptAt: null,
    phase: options.phase,
    releaseLease: false,
  });
}
