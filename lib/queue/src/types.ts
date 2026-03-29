export type JobType =
  | "build_requested"
  | "analyze_requested"
  | "rollback_requested";

export type JobState =
  | "queued"
  | "claimed"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed";

export type JobStatus = JobState;

export type JobPayload = Record<string, unknown>;

export type Job = {
  id: string;
  type: JobType;
  payload: JobPayload;
  status: JobState;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  lastTransitionAt: Date;
  currentPhase: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EnqueueJobInput = {
  type: JobType;
  payload: JobPayload;
  availableAt?: Date;
  maxAttempts?: number;
  nextAttemptAt?: Date;
};
