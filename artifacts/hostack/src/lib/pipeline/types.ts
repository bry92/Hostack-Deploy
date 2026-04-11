/**
 * Pipeline System Types
 * Real-time deployment pipeline visualization
 */

export type LogType = "thinking" | "action" | "success" | "error";
export type PipelineStage = "prepare" | "install" | "build" | "package" | "deploy" | "verify";
export type StageStatus = "pending" | "running" | "success" | "error";

/**
 * Individual log entry
 * Emitted during pipeline execution
 */
export interface PipelineLog {
  id: string;
  type: LogType;
  message: string;
  stage: PipelineStage;
  timestamp: number;
}

/**
 * Stage status tracker
 * Maintains current state of a single pipeline stage
 */
export interface StageState {
  stage: PipelineStage;
  status: StageStatus;
  progress: number; // 0-100
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  error?: string;
}

/**
 * Overall pipeline state
 * Tracks all stages and logs
 */
export interface PipelineState {
  status: "idle" | "running" | "success" | "failed";
  stages: Record<PipelineStage, StageState>;
  logs: PipelineLog[];
  overallProgress: number; // 0-100
  totalDurationMs?: number;
  startTime?: number;
  endTime?: number;
  deploymentUrl?: string;
  buildTime?: number;
}

/**
 * Stage configuration
 * Metadata for each pipeline stage
 */
export interface StageConfig {
  stage: PipelineStage;
  progressTarget: number; // % when stage completes
  durationMs: number; // Realistic duration for this stage
  successMessage: string;
  logs: string[]; // Predefined log messages with emojis
}

/**
 * Pipeline context passed to engine
 */
export interface PipelineContext {
  projectName: string;
  repositoryUrl: string;
  branch: string;
  commitSha: string;
  framework?: string;
  onLogEmit: (log: PipelineLog) => void;
  onStageChange: (stage: StageState) => void;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  status: "success" | "failed";
  totalDurationMs: number;
  buildTime: number;
  deploymentUrl?: string;
  failureReason?: string;
  logs: PipelineLog[];
}
