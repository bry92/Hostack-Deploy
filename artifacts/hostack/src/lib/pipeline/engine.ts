/**
 * Pipeline Engine
 * Orchestrates deployment pipeline execution with realistic logs
 */

import type {
  PipelineLog,
  StageState,
  PipelineState,
  PipelineContext,
  PipelineResult,
  PipelineStage,
  LogType,
} from "./types";
import { STAGE_CONFIG, PIPELINE_STAGES } from "./constants";

/**
 * Sleep utility for realistic delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate unique log ID
 */
const generateLogId = (): string => `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Create a log entry
 */
const createLog = (
  type: LogType,
  message: string,
  stage: PipelineStage
): PipelineLog => ({
  id: generateLogId(),
  type,
  message,
  stage,
  timestamp: Date.now(),
});

/**
 * Initialize pipeline state
 */
const initializePipelineState = (): PipelineState => ({
  status: "idle",
  stages: {
    prepare: {
      stage: "prepare",
      status: "pending",
      progress: 0,
    },
    install: {
      stage: "install",
      status: "pending",
      progress: 0,
    },
    build: {
      stage: "build",
      status: "pending",
      progress: 0,
    },
    package: {
      stage: "package",
      status: "pending",
      progress: 0,
    },
    deploy: {
      stage: "deploy",
      status: "pending",
      progress: 0,
    },
    verify: {
      stage: "verify",
      status: "pending",
      progress: 0,
    },
  },
  logs: [],
  overallProgress: 0,
});

/**
 * Run a single pipeline stage
 * Emits logs with realistic timing
 */
async function runStage(
  stage: PipelineStage,
  context: PipelineContext,
  state: PipelineState
): Promise<boolean> {
  const config = STAGE_CONFIG[stage];
  const stageState: StageState = {
    stage,
    status: "running",
    progress: 0,
    startTime: Date.now(),
  };

  // Update stage status
  context.onStageChange(stageState);

  try {
    // Emit initial thinking log
    const initLog = createLog("thinking", config.logs[0] || `Starting ${stage}...`, stage);
    context.onLogEmit(initLog);
    await sleep(300);

    // Emit action logs throughout stage
    const actionLogs = config.logs.slice(1, -1);
    const logDelayMs = config.durationMs / Math.max(actionLogs.length, 1);

    for (const logMessage of actionLogs) {
      const actionLog = createLog("action", logMessage, stage);
      context.onLogEmit(actionLog);
      await sleep(logDelayMs);
    }

    // Emit success log
    const successLog = createLog("success", config.logs[config.logs.length - 1] || `${stage} complete`, stage);
    context.onLogEmit(successLog);

    // Update final state
    const endTime = Date.now();
    const durationMs = endTime - (stageState.startTime || Date.now());
    stageState.status = "success";
    stageState.progress = config.progressTarget;
    stageState.endTime = endTime;
    stageState.durationMs = durationMs;

    state.stages[stage] = stageState;
    state.overallProgress = config.progressTarget;

    context.onStageChange(stageState);

    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    const errorLog = createLog(
      "error",
      `${stage} failed: ${errorMessage}`,
      stage
    );
    context.onLogEmit(errorLog);

    stageState.status = "error";
    stageState.error = errorMessage;
    stageState.endTime = Date.now();
    stageState.durationMs = stageState.endTime - (stageState.startTime || Date.now());

    state.stages[stage] = stageState;
    context.onStageChange(stageState);

    return false;
  }
}

/**
 * Main deployment pipeline runner
 * Orchestrates all stages and emits real-time logs
 */
export async function runDeploymentPipeline(
  context: PipelineContext
): Promise<PipelineResult> {
  const state = initializePipelineState();
  const pipelineStartTime = Date.now();
  state.startTime = pipelineStartTime;
  state.status = "running";

  try {
    // Emit initial pipeline start
    const startLog = createLog(
      "thinking",
      `🚀 Starting deployment pipeline for ${context.projectName}...`,
      "prepare"
    );
    context.onLogEmit(startLog);
    state.logs.push(startLog);

    // Run each stage
    for (const stage of PIPELINE_STAGES) {
      const success = await runStage(stage, context, state);

      if (!success) {
        // Pipeline failed at this stage
        state.status = "failed";
        state.endTime = Date.now();
        state.totalDurationMs = state.endTime - pipelineStartTime;

        const failureLog = createLog(
          "error",
          `Pipeline failed at ${stage} stage`,
          stage
        );
        context.onLogEmit(failureLog);
        state.logs.push(failureLog);

        return {
          status: "failed",
          totalDurationMs: state.totalDurationMs,
          buildTime: state.totalDurationMs,
          failureReason: state.stages[stage].error || `Failed during ${stage}`,
          logs: state.logs,
        };
      }

      state.logs.push(...collectStageLogs(context));
    }

    // Pipeline succeeded
    state.status = "success";
    state.endTime = Date.now();
    state.totalDurationMs = state.endTime - pipelineStartTime;
    state.buildTime = state.totalDurationMs;

    // Generate deployment URL
    const appName = context.projectName.toLowerCase().replace(/\s+/g, "-");
    state.deploymentUrl = `https://${appName}.hostack.dev`;

    // Emit final success message
    const finalLog = createLog(
      "success",
      `✨ Deployment complete! Live at ${state.deploymentUrl}`,
      "verify"
    );
    context.onLogEmit(finalLog);
    state.logs.push(finalLog);

    return {
      status: "success",
      totalDurationMs: state.totalDurationMs,
      buildTime: state.buildTime,
      deploymentUrl: state.deploymentUrl,
      logs: state.logs,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    state.status = "failed";
    state.endTime = Date.now();
    state.totalDurationMs = state.endTime - pipelineStartTime;

    const errorLog = createLog("error", `Pipeline error: ${errorMessage}`, "prepare");
    context.onLogEmit(errorLog);
    state.logs.push(errorLog);

    return {
      status: "failed",
      totalDurationMs: state.totalDurationMs,
      buildTime: state.totalDurationMs,
      failureReason: errorMessage,
      logs: state.logs,
    };
  }
}

/**
 * Collect all logs emitted during a stage
 * Helper to maintain log history
 */
function collectStageLogs(context: PipelineContext): PipelineLog[] {
  // In a real implementation, we'd track these differently
  // For now, return empty array as logs are emitted via callback
  return [];
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Calculate progress percentage based on stage
 */
export function getProgressForStage(stage: PipelineStage): number {
  return STAGE_CONFIG[stage].progressTarget;
}
