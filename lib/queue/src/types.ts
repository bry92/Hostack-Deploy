export type JobType =
  | "build_requested"
  | "analyze_requested"
  | "rollback_requested";

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type JobPayload = Record<string, unknown>;

export type Job = {
  id: string;
  type: JobType;
  payload: JobPayload;
  status: JobStatus;
  attempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EnqueueJobInput = {
  type: JobType;
  payload: JobPayload;
  availableAt?: Date;
};
