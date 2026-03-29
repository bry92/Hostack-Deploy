import type { InferSelectModel } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { deploymentsTable, projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { buildDeployment } from "./deploymentBuilder.js";
import {
  DeploymentExecutionBusyError,
  DeploymentExecutionError,
} from "./deploymentExecutionErrors.js";
import {
  normalizeDeploymentExecutionPhase,
  normalizeDeploymentLifecycleState,
} from "./deploymentStateMachine.js";
import { simulateDeployment } from "./deploymentSimulator.js";

type ProjectRecord = InferSelectModel<typeof projectsTable>;
type ExecutionMode = "real" | "simulated";
type DeploymentExecutionResult =
  | { outcome: "completed"; status: string }
  | { outcome: "skipped"; reason: string; status: string };

async function withDeploymentExecutionLock<T>(
  deploymentId: string,
  task: () => Promise<T>,
): Promise<T> {
  if (!pool) {
    throw new DeploymentExecutionError({
      code: "database_unavailable",
      message: "Database pool unavailable for deployment execution lock",
      retryable: true,
      phase: "preparing",
    });
  }

  const client = await pool.connect();
  const lockKey = `deployment:${deploymentId}`;

  try {
    const result = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as acquired",
      [lockKey],
    );

    if (!result.rows[0]?.acquired) {
      throw new DeploymentExecutionBusyError(deploymentId);
    }

    try {
      return await task();
    } finally {
      await client
        .query("select pg_advisory_unlock(hashtext($1))", [lockKey])
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            `[deploymentExecutor] failed to release execution lock for ${deploymentId}: ${message}`,
          );
        });
    }
  } finally {
    client.release();
  }
}

export function determineExecutionMode(project: Pick<ProjectRecord, "repoUrl">, simulate = false): ExecutionMode {
  if (simulate || !project.repoUrl) {
    return "simulated";
  }
  return "real";
}

export async function startDeploymentExecution(
  deploymentId: string,
): Promise<DeploymentExecutionResult> {
  return withDeploymentExecutionLock(deploymentId, async () => {
    const [deployment] = await db
      .select({
        executionMode: deploymentsTable.executionMode,
        failureReason: deploymentsTable.failureReason,
        status: deploymentsTable.status,
      })
      .from(deploymentsTable)
      .where(eq(deploymentsTable.id, deploymentId));

    if (!deployment) {
      throw new DeploymentExecutionError({
        code: "deployment_not_found",
        message: `Deployment ${deploymentId} not found`,
        retryable: false,
      });
    }

    const currentState = normalizeDeploymentLifecycleState(deployment.status);
    if (currentState === "ready") {
      return {
        outcome: "skipped",
        reason: `Deployment already reached terminal status '${deployment.status}'`,
        status: deployment.status,
      };
    }

    if (deployment.executionMode === "real") {
      await buildDeployment(deploymentId);
    } else {
      await simulateDeployment(deploymentId);
    }

    const [updatedDeployment] = await db
      .select({
        currentPhase: deploymentsTable.currentPhase,
        failureReason: deploymentsTable.failureReason,
        status: deploymentsTable.status,
      })
      .from(deploymentsTable)
      .where(eq(deploymentsTable.id, deploymentId));

    if (!updatedDeployment) {
      throw new DeploymentExecutionError({
        code: "deployment_not_found",
        message: `Deployment ${deploymentId} not found after execution`,
        retryable: false,
      });
    }

    const finalState = normalizeDeploymentLifecycleState(updatedDeployment.status);
    if (finalState === "failed") {
      throw new DeploymentExecutionError({
        code: "deployment_failed",
        message:
          updatedDeployment.failureReason?.trim() ||
          `Deployment ${deploymentId} failed during execution`,
        retryable: false,
      });
    }

    if (finalState !== "ready") {
      throw new DeploymentExecutionError({
        code: "deployment_failed",
        message:
          `Deployment ${deploymentId} finished job execution without reaching ready state (current state '${updatedDeployment.status}')`,
        retryable: false,
        phase: normalizeDeploymentExecutionPhase(updatedDeployment.currentPhase),
      });
    }

    return {
      outcome: "completed",
      status: updatedDeployment.status,
    };
  });
}
