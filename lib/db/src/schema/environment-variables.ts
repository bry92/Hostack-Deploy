import { pgTable, timestamp, varchar, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const environmentVariablesTable = pgTable("environment_variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  environment: varchar("environment", { length: 50 }).notNull().default("production"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEnvVarSchema = createInsertSchema(environmentVariablesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEnvVar = z.infer<typeof insertEnvVarSchema>;
export type EnvVar = typeof environmentVariablesTable.$inferSelect;
