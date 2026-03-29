import { db } from "@workspace/db";
import {
  deploymentStateTransitionsTable,
  deploymentsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { DeploymentExecutionPhase } from "./deploymentExecutionErrors.js";
import { generateAndStoreDeploymentAiSummary } from "./deploymentLogAnalyzer.js";
import { syncDeploymentToNotion } from "./notionDeploymentSync.js";

export type DeploymentLifecycleState =
  | "pending"
  | "building"
  | "deploying"
  | "ready"
  | "failed";

type DeploymentStateUpdateValues = Partial<typeof deploymentsTable.$inferInsert>;

type DeploymentStateTransitionOptions = {
  currentPhase?: DeploymentExecutionPhase | null;
  jobId?: string | null;
  message?: string | null;
  updates?: DeploymentStateUpdateValues;
};

const ALLOWED_DEPLOYMENT_STATE_TRANSITIONS: Record<
  DeploymentLifecycleState,
  ReadonlySet<DeploymentLifecycleState>
> = {
  pending: new Set<DeploymentLifecycleState>(["building", "deploying", "failed"]),
  building: new Set<DeploymentLifecycleState>(["deploying", "failed"]),
  deploying: new Set<DeploymentLifecycleState>(["ready", "failed"]),
  ready: new Set<DeploymentLifecycleState>(["failed"]),
  failed: new Set<DeploymentLifecycleState>(["pending"]),
};

export function normalizeDeploymentLifecycleState(
  status: string | null | undefined,
): DeploymentLifecycleState {
  switch (status) {
    case "pending":
    case "queued":
      return "pending";
    case "building":
    case "preparing":
    case "cloning":
    case "detecting":
    case "installing":
    case "packaging":
      return "building";
    case "deploying":
    case "verifying":
      return "deploying";
    case "ready":
    case "deployed":
      return "ready";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

export function mapDeploymentPhaseToState(
  phase: DeploymentExecutionPhase,
): DeploymentLifecycleState {
  switch (phase) {
    case "deploying":
    case "verifying":
      return "deploying";
    case "simulating":
    case "preparing":
    case "cloning":
    case "detecting":
    case "installing":
    case "building":
    case "packaging":
      return "building";
    default:
      return "pending";
  }
}

export function normalizeDeploymentExecutionPhase(
  phase: string | null | undefined,
): DeploymentExecutionPhase | undefined {
  switch (phase) {
    case "preparing":
    case "cloning":
    case "detecting":
    case "installing":
    case "building":
    case "packaging":
    case "deploying":
    case "verifying":
    case "simulating":
      return phase;
    default:
      return undefined;
  }
}

export function assertTransition(
  previousState: DeploymentLifecycleState,
  nextState: DeploymentLifecycleState,
): void {
  if (previousState === nextState) {
    return;
  }

  const allowedStates = ALLOWED_DEPLOYMENT_STATE_TRANSITIONS[previousState];
  if (!allowedStates.has(nextState)) {
    throw new Error(
      `Invalid deployment state transition: ${previousState} -> ${nextState}`,
    );
  }
}

function shouldSkipIdempotentWrite(params: {
  currentPhase: string | null;
  nextPhase: string | null;
  previousState: DeploymentLifecycleState;
  nextState: DeploymentLifecycleState;
  updates?: DeploymentStateUpdateValues;
}): boolean {
  if (params.previousState !== params.nextState) {
    return false;
  }

  if (params.currentPhase !== params.nextPhase) {
    return false;
  }

  return Object.keys(params.updates ?? {}).length === 0;
}

function resolveCurrentPhase(
  nextState: DeploymentLifecycleState,
  phase: DeploymentExecutionPhase | null | undefined,
  existingPhase: string | null,
): string | null {
  if (phase !== undefined) {
    return phase;
  }

  if (nextState === "pending" || nextState === "ready") {
    return null;
  }

  return existingPhase ?? null;
}

async function transitionDeploymentState(
  deploymentId: string,
  nextState: DeploymentLifecycleState,
  options: DeploymentStateTransitionOptions = {},
): Promise<void> {
  const [deployment] = await db
    .select({
      currentPhase: deploymentsTable.currentPhase,
      status: deploymentsTable.status,
    })
    .from(deploymentsTable)
    .where(eq(deploymentsTable.id, deploymentId));

  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  const previousState = normalizeDeploymentLifecycleState(deployment.status);
  assertTransition(previousState, nextState);

  const currentPhase = resolveCurrentPhase(
    nextState,
    options.currentPhase,
    deployment.currentPhase,
  );

  if (
    shouldSkipIdempotentWrite({
      currentPhase: deployment.currentPhase,
      nextPhase: currentPhase,
      nextState,
      previousState,
      updates: options.updates,
    })
  ) {
    return;
  }

  await db
    .update(deploymentsTable)
    .set({
      ...options.updates,
      currentPhase,
      status: nextState,
    })
    .where(eq(deploymentsTable.id, deploymentId));

  if (previousState === nextState) {
    return;
  }

  await db.insert(deploymentStateTransitionsTable).values({
    deploymentId,
    jobId: options.jobId ?? null,
    message: options.message ?? null,
    nextState,
    phase: currentPhase,
    previousState,
  });
}

export async function setDeploymentExecutionPhase(
  deploymentId: string,
  phase: DeploymentExecutionPhase,
  options: Omit<DeploymentStateTransitionOptions, "currentPhase"> = {},
): Promise<void> {
  await transitionDeploymentState(deploymentId, mapDeploymentPhaseToState(phase), {
    ...options,
    currentPhase: phase,
  });
}

export async function markDeploymentPending(
  deploymentId: string,
  options: Omit<DeploymentStateTransitionOptions, "currentPhase"> = {},
): Promise<void> {
  await transitionDeploymentState(deploymentId, "pending", {
    ...options,
    currentPhase: null,
    updates: {
      aiSummary: null,
      completedAt: null,
      currentPhase: null,
      durationSeconds: null,
      failureReason: null,
      ...options.updates,
    },
  });
}

export async function markDeploymentReady(
  deploymentId: string,
  options: Omit<DeploymentStateTransitionOptions, "currentPhase"> = {},
): Promise<void> {
  await transitionDeploymentState(deploymentId, "ready", {
    ...options,
    currentPhase: null,
    updates: {
      aiSummary: null,
      failureReason: null,
      ...options.updates,
    },
  });

  try {
    await syncDeploymentToNotion(deploymentId, { status: "success" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[notion] failed to sync ready deployment ${deploymentId}: ${message}`);
  }
}

export async function markDeploymentFailed(
  deploymentId: string,
  reason: string,
  options: Omit<DeploymentStateTransitionOptions, "message"> & {
    phase?: DeploymentExecutionPhase | null;
  } = {},
): Promise<void> {
  await transitionDeploymentState(deploymentId, "failed", {
    currentPhase: options.phase ?? null,
    jobId: options.jobId,
    message: reason,
    updates: {
      failureReason: reason,
      ...options.updates,
    },
  });

  try {
    await generateAndStoreDeploymentAiSummary(deploymentId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[deployment-ai] failed to store aiSummary for deployment ${deploymentId}: ${message}`);
  }

  try {
    await syncDeploymentToNotion(deploymentId, { status: "failed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[notion] failed to sync failed deployment ${deploymentId}: ${message}`);
  }
}
