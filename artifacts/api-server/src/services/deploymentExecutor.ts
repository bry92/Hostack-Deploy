import type { InferSelectModel } from "drizzle-orm";
import { db } from "@workspace/db";
import { deploymentsTable, projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { buildDeployment } from "./deploymentBuilder.js";
import { simulateDeployment } from "./deploymentSimulator.js";

type ProjectRecord = InferSelectModel<typeof projectsTable>;
type ExecutionMode = "real" | "simulated";

export function determineExecutionMode(project: Pick<ProjectRecord, "repoUrl">, simulate = false): ExecutionMode {
  if (simulate || !project.repoUrl) {
    return "simulated";
  }
  return "real";
}

export async function startDeploymentExecution(deploymentId: string): Promise<void> {
  const [deployment] = await db
    .select({ executionMode: deploymentsTable.executionMode })
    .from(deploymentsTable)
    .where(eq(deploymentsTable.id, deploymentId));

  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  if (deployment.executionMode === "real") {
    await buildDeployment(deploymentId);
    return;
  }

  await simulateDeployment(deploymentId);
}
