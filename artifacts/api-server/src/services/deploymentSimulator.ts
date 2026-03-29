import { db } from "@workspace/db";
import { deploymentLogsTable, deploymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { classifyDeploymentExecutionError } from "./deploymentExecutionErrors.js";
import {
  markDeploymentFailed,
  markDeploymentReady,
  setDeploymentExecutionPhase,
} from "./deploymentStateMachine.js";

const SIMULATION_STEPS = [
  { phase: "preparing", message: "Simulation mode: preparing deployment", delay: 200 },
  { phase: "cloning", message: "Simulation mode: cloning repository snapshot", delay: 250 },
  { phase: "detecting", message: "Simulation mode: detecting framework", delay: 250 },
  { phase: "installing", message: "Simulation mode: installing dependencies", delay: 250 },
  { phase: "building", message: "Simulation mode: building artifact", delay: 300 },
  { phase: "packaging", message: "Simulation mode: packaging artifact", delay: 250 },
  { phase: "deploying", message: "Simulation mode: deploying artifact", delay: 250 },
  { phase: "verifying", message: "Simulation mode: verifying deployment", delay: 250 },
] as const;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateDeployment(deploymentId: string): Promise<void> {
  try {
    await setDeploymentExecutionPhase(deploymentId, "preparing", {
      updates: {
        completedAt: null,
        durationSeconds: null,
        executionMode: "simulated",
        failureReason: null,
        runtimeKind: "static",
        simulated: true,
        startedAt: new Date(),
      },
    });

    let stepOrder = 0;
    let cumulativeDelay = 0;

    for (const step of SIMULATION_STEPS) {
      await sleep(step.delay);
      cumulativeDelay += step.delay;

      await setDeploymentExecutionPhase(deploymentId, step.phase);

      await db.insert(deploymentLogsTable).values({
        deploymentId,
        logLevel: "info",
        message: step.message,
        stepOrder: stepOrder++,
      });
    }

    const deploymentUrl = `https://simulated-${deploymentId.slice(0, 8)}.hostack.app`;
    const completedAt = new Date();

    await markDeploymentReady(deploymentId, {
      message: "Simulation completed successfully",
      updates: {
        completedAt,
        currentPhase: null,
        deploymentUrl,
        durationSeconds: Math.round(cumulativeDelay / 1000),
        executionMode: "simulated",
        runtimeKind: "static",
        simulated: true,
      },
    });

    await db.insert(deploymentLogsTable).values({
      deploymentId,
      logLevel: "success",
      message: "Simulation mode: deployment marked ready",
      stepOrder: stepOrder,
    });
  } catch (error) {
    const classifiedError = classifyDeploymentExecutionError(error, {
      phase: "simulating",
    });
    const reason = classifiedError.message;
    await markDeploymentFailed(deploymentId, reason, {
      phase: "simulating",
      updates: {
        completedAt: new Date(),
        executionMode: "simulated",
        simulated: true,
      },
    });

    await db.insert(deploymentLogsTable).values({
      deploymentId,
      logLevel: "error",
      message: `Simulation mode: deployment failed: ${reason}`,
      stepOrder: SIMULATION_STEPS.length + 1,
    });

    throw classifiedError;
  }
}
