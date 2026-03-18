import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projectsTable } from "./projects";

export const customDomainsTable = pgTable("custom_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 255 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  domain: varchar("domain", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  verificationToken: varchar("verification_token", { length: 64 }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomDomain = typeof customDomainsTable.$inferSelect;
