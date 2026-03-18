import { pgTable, timestamp, varchar, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const projectNotificationSettingsTable = pgTable("project_notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  channelType: varchar("channel_type", { length: 32 }).notNull(),
  webhookUrl: varchar("webhook_url", { length: 2048 }),
  eventTypes: jsonb("event_types").default(["deploy_started", "deploy_succeeded", "deploy_failed"]).$type<string[]>(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique("uq_project_channel").on(table.projectId, table.channelType),
]);

export const notificationEventTypesSchema = z.array(
  z.enum(["deploy_started", "deploy_succeeded", "deploy_failed"])
);

export const channelTypeSchema = z.enum(["slack", "discord", "webhook"]);

export type ProjectNotificationSetting = typeof projectNotificationSettingsTable.$inferSelect;
