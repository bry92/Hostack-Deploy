import { pgTable, timestamp, varchar, text, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const runtimeLogsTable = pgTable("runtime_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  deploymentId: varchar("deployment_id"),
  level: varchar("level", { length: 20 }).notNull().default("info"),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }).default("app"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const deploymentMetricsTable = pgTable("deployment_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  deploymentId: varchar("deployment_id"),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  metricValue: numeric("metric_value", { precision: 18, scale: 4 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type RuntimeLog = typeof runtimeLogsTable.$inferSelect;
export type DeploymentMetric = typeof deploymentMetricsTable.$inferSelect;
