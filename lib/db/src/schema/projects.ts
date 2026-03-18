import { pgTable, timestamp, varchar, text, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  framework: varchar("framework", { length: 100 }).notNull(),
  repoUrl: varchar("repo_url", { length: 500 }),
  repoOwner: varchar("repo_owner", { length: 255 }),
  repoName: varchar("repo_name", { length: 255 }),
  repoBranch: varchar("repo_branch", { length: 255 }).default("main"),
  rootDirectory: varchar("root_directory", { length: 500 }).default(""),
  buildCommand: varchar("build_command", { length: 500 }),
  installCommand: varchar("install_command", { length: 500 }),
  autoDeploy: boolean("auto_deploy").default(true),
  githubToken: text("github_token"),
  webhookSecret: varchar("webhook_secret", { length: 64 }),
  customDomain: varchar("custom_domain", { length: 255 }),
  productionUrl: varchar("production_url", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
