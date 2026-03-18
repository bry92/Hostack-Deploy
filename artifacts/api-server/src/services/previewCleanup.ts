import { db } from "@workspace/db";
import { deploymentsTable, deploymentLogsTable } from "@workspace/db/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function cleanupOldPreviews(): Promise<void> {
  const cutoff = new Date(Date.now() - FOURTEEN_DAYS_MS);

  try {
    const staleDeployments = await db
      .select({ id: deploymentsTable.id })
      .from(deploymentsTable)
      .where(
        and(
          eq(deploymentsTable.environment, "preview"),
          lt(deploymentsTable.createdAt, cutoff),
        ),
      );

    if (staleDeployments.length === 0) {
      console.log("[preview-cleanup] No stale preview deployments found.");
      return;
    }

    const ids = staleDeployments.map((d) => d.id);

    const logsResult = await db
      .delete(deploymentLogsTable)
      .where(inArray(deploymentLogsTable.deploymentId, ids));

    const deploymentsResult = await db
      .delete(deploymentsTable)
      .where(inArray(deploymentsTable.id, ids));

    console.log(
      `[preview-cleanup] Removed ${ids.length} stale preview deployments and their logs (older than 14 days).`,
    );
  } catch (err) {
    console.error("[preview-cleanup] Error during cleanup:", err);
  }
}

export function schedulePreviewCleanup(): void {
  console.log("[preview-cleanup] Scheduled daily preview deployment cleanup.");
  cleanupOldPreviews();
  setInterval(cleanupOldPreviews, ONE_DAY_MS);
}
