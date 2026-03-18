import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, deploymentsTable } from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;

  const userProjects = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));

  const projectIds = userProjects.map((p) => p.id);
  const totalProjects = projectIds.length;

  if (totalProjects === 0) {
    res.json({
      totalProjects: 0,
      totalDeployments: 0,
      latestDeploymentStatus: null,
      recentDeployments: [],
    });
    return;
  }

  const allDeployments = await db
    .select({
      id: deploymentsTable.id,
      projectId: deploymentsTable.projectId,
      projectName: projectsTable.name,
      status: deploymentsTable.status,
      environment: deploymentsTable.environment,
      commitMessage: deploymentsTable.commitMessage,
      branch: deploymentsTable.branch,
      deploymentUrl: deploymentsTable.deploymentUrl,
      createdAt: deploymentsTable.createdAt,
      startedAt: deploymentsTable.startedAt,
      completedAt: deploymentsTable.completedAt,
      durationSeconds: deploymentsTable.durationSeconds,
    })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(5);

  const totalDeployments = await db
    .select({ count: count() })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(deploymentsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, userId));

  res.json({
    totalProjects,
    totalDeployments: totalDeployments[0]?.count ?? 0,
    latestDeploymentStatus: allDeployments[0]?.status ?? null,
    recentDeployments: allDeployments,
  });
});

export default router;
