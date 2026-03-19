import { pgTable, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const buildRulesTable = pgTable("build_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  branchPattern: varchar("branch_pattern", { length: 255 }).notNull(),
  environment: varchar("environment", { length: 50 }).notNull().default("production"),
  autoDeploy: boolean("auto_deploy").notNull().default(true),
  buildCommandOverride: varchar("build_command_override", { length: 500 }),
  installCommandOverride: varchar("install_command_override", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const deployWebhooksTable = pgTable("deploy_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  secret: varchar("secret", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }).notNull().default("Default"),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBuildRuleSchema = createInsertSchema(buildRulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBuildRule = z.infer<typeof insertBuildRuleSchema>;
export type BuildRule = typeof buildRulesTable.$inferSelect;

export const insertDeployWebhookSchema = createInsertSchema(deployWebhooksTable).omit({
  id: true,
  createdAt: true,
  lastTriggeredAt: true,
});
export type InsertDeployWebhook = z.infer<typeof insertDeployWebhookSchema>;
export type DeployWebhook = typeof deployWebhooksTable.$inferSelect;
