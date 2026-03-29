import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const jobsTable = pgTable(
  "jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    type: varchar("type", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull().default({}).$type<Record<string, unknown>>(),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastTransitionAt: timestamp("last_transition_at", { withTimezone: true }).notNull().defaultNow(),
    currentPhase: varchar("current_phase", { length: 64 }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: varchar("locked_by", { length: 255 }),
    lastError: text("last_error"),
    lastErrorCode: varchar("last_error_code", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("jobs_status_available_at_idx").on(table.status, table.availableAt),
    index("jobs_status_next_attempt_at_idx").on(table.status, table.nextAttemptAt),
    index("jobs_type_status_idx").on(table.type, table.status),
    index("jobs_locked_at_idx").on(table.lockedAt),
  ],
).enableRLS();

export type QueueJobRecord = typeof jobsTable.$inferSelect;
export type InsertQueueJobRecord = typeof jobsTable.$inferInsert;
