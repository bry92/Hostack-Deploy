import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectNotificationSettingsTable, projectsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sendTestNotification, validateWebhookUrl } from "../services/notificationDispatcher.js";

const router: IRouter = Router();

router.get("/projects/:projectId/notification-settings", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const settings = await db
    .select()
    .from(projectNotificationSettingsTable)
    .where(eq(projectNotificationSettingsTable.projectId, projectId));

  res.json({ settings });
});

router.put("/projects/:projectId/notification-settings", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { channelType, webhookUrl, eventTypes, enabled } = req.body;

  if (!channelType || !["slack", "discord", "webhook"].includes(channelType)) {
    res.status(400).json({ error: "channelType must be one of: slack, discord, webhook" });
    return;
  }

  if (channelType === "webhook" && !webhookUrl) {
    res.status(400).json({ error: "webhookUrl is required when channelType is webhook" });
    return;
  }

  if (channelType === "webhook" && webhookUrl) {
    const urlValidation = validateWebhookUrl(webhookUrl);
    if (!urlValidation.valid) {
      res.status(400).json({ error: urlValidation.error });
      return;
    }
  }

  const validEventTypes = ["deploy_started", "deploy_succeeded", "deploy_failed"];
  const events = Array.isArray(eventTypes) ? eventTypes.filter((e: string) => validEventTypes.includes(e)) : validEventTypes;

  const [existing] = await db
    .select()
    .from(projectNotificationSettingsTable)
    .where(
      and(
        eq(projectNotificationSettingsTable.projectId, projectId),
        eq(projectNotificationSettingsTable.channelType, channelType),
      ),
    );

  if (existing) {
    const [updated] = await db
      .update(projectNotificationSettingsTable)
      .set({
        webhookUrl: channelType === "webhook" ? webhookUrl : null,
        eventTypes: events,
        enabled: enabled !== undefined ? enabled : existing.enabled,
        updatedAt: new Date(),
      })
      .where(eq(projectNotificationSettingsTable.id, existing.id))
      .returning();

    res.json({ setting: updated });
  } else {
    const [created] = await db
      .insert(projectNotificationSettingsTable)
      .values({
        projectId,
        channelType,
        webhookUrl: channelType === "webhook" ? webhookUrl : null,
        eventTypes: events,
        enabled: enabled !== undefined ? enabled : true,
      })
      .returning();

    res.status(201).json({ setting: created });
  }
});

router.delete("/projects/:projectId/notification-settings/:settingId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId, settingId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db
    .delete(projectNotificationSettingsTable)
    .where(
      and(
        eq(projectNotificationSettingsTable.id, settingId),
        eq(projectNotificationSettingsTable.projectId, projectId),
      ),
    );

  res.json({ success: true });
});

router.post("/projects/:projectId/notification-settings/test", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { projectId } = req.params;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const result = await sendTestNotification(projectId, userId);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

export default router;
