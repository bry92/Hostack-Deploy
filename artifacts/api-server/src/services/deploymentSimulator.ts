import { db } from "@workspace/db";
import { deploymentLogsTable, deploymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const SIMULATION_STEPS = [
  { status: "preparing", message: "Simulation mode: preparing deployment", delay: 200 },
  { status: "cloning", message: "Simulation mode: cloning repository snapshot", delay: 250 },
  { status: "detecting", message: "Simulation mode: detecting framework", delay: 250 },
  { status: "installing", message: "Simulation mode: installing dependencies", delay: 250 },
  { status: "building", message: "Simulation mode: building artifact", delay: 300 },
  { status: "packaging", message: "Simulation mode: packaging artifact", delay: 250 },
  { status: "deploying", message: "Simulation mode: deploying artifact", delay: 250 },
  { status: "verifying", message: "Simulation mode: verifying deployment", delay: 250 },
] as const;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateDeployment(deploymentId: string): Promise<void> {
  try {
    await db
      .update(deploymentsTable)
      .set({
        status: "queued",
        executionMode: "simulated",
        simulated: true,
        runtimeKind: "static",
        startedAt: new Date(),
        failureReason: null,
      })
      .where(eq(deploymentsTable.id, deploymentId));

    let stepOrder = 0;
    let cumulativeDelay = 0;

    for (const step of SIMULATION_STEPS) {
      await sleep(step.delay);
      cumulativeDelay += step.delay;

      await db
        .update(deploymentsTable)
        .set({ status: step.status })
        .where(eq(deploymentsTable.id, deploymentId));

      await db.insert(deploymentLogsTable).values({
        deploymentId,
        logLevel: "info",
        message: step.message,
        stepOrder: stepOrder++,
      });
    }

    const deploymentUrl = `https://simulated-${deploymentId.slice(0, 8)}.hostack.app`;
    const completedAt = new Date();

    await db
      .update(deploymentsTable)
      .set({
        status: "ready",
        completedAt,
        durationSeconds: Math.round(cumulativeDelay / 1000),
        deploymentUrl,
        executionMode: "simulated",
        simulated: true,
        runtimeKind: "static",
      })
      .where(eq(deploymentsTable.id, deploymentId));

    await db.insert(deploymentLogsTable).values({
      deploymentId,
      logLevel: "success",
      message: "Simulation mode: deployment marked ready",
      stepOrder: stepOrder,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db
      .update(deploymentsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureReason: reason,
        executionMode: "simulated",
        simulated: true,
      })
      .where(eq(deploymentsTable.id, deploymentId));
  }
}
