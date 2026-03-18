import { pgTable, timestamp, varchar, integer, text, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deploymentsTable = pgTable("deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("queued"),
  environment: varchar("environment", { length: 50 }).notNull().default("production"),
  triggerType: varchar("trigger_type", { length: 50 }).notNull().default("manual"),
  executionMode: varchar("execution_mode", { length: 20 }).notNull().default("simulated"),
  runtimeKind: varchar("runtime_kind", { length: 20 }),
  simulated: boolean("simulated").notNull().default(false),
  isCurrent: boolean("is_current").notNull().default(false),
  activeEnvironment: varchar("active_environment", { length: 50 }),
  sourceDeploymentId: varchar("source_deployment_id"),
  commitMessage: varchar("commit_message", { length: 500 }),
  commitHash: varchar("commit_hash", { length: 80 }),
  branch: varchar("branch", { length: 255 }).default("main"),
  deploymentUrl: varchar("deployment_url", { length: 500 }),
  outputDirectory: varchar("output_directory", { length: 1000 }),
  artifactPath: varchar("artifact_path", { length: 2000 }),
  buildRoot: varchar("build_root", { length: 2000 }),
  installCommandUsed: varchar("install_command_used", { length: 1000 }),
  buildCommandUsed: varchar("build_command_used", { length: 1000 }),
  runtimeCommand: varchar("runtime_command", { length: 1000 }),
  runtimePort: integer("runtime_port"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  prNumber: integer("pr_number"),
});

export const deploymentLogsTable = pgTable("deployment_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deploymentId: varchar("deployment_id").notNull(),
  logLevel: varchar("log_level", { length: 20 }).notNull().default("info"),
  message: text("message").notNull(),
  stepOrder: integer("step_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeploymentSchema = createInsertSchema(deploymentsTable).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  durationSeconds: true,
});
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deploymentsTable.$inferSelect;
export type DeploymentLog = typeof deploymentLogsTable.$inferSelect;
