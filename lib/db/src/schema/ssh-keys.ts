import { pgTable, timestamp, text, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projectsTable } from "./projects";

export const sshKeysTable = pgTable("ssh_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 255 }).notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  provider: varchar("provider", { length: 50 }).notNull().default("github"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SshKey = typeof sshKeysTable.$inferSelect;
